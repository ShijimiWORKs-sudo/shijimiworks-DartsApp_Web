import { createGameId } from '../../domain/ids';
import { calculateCricketDart, CRICKET_TARGETS, type CricketTarget } from '../../domain/cricket';
import {
  MATCH_GAME_MAX_ROUNDS,
  type MatchChoiceInput,
  type MatchDart,
  type MatchDartInput,
  type MatchGameMode,
  type MatchGameNo,
  type MatchGameState,
  type MatchManualWinnerInput,
  type MatchPlayerSlot,
  type MatchStartInput,
  type MatchState,
  type MatchTurn,
} from '../../domain/match';
import { calculateZeroOneDartScore, evaluateZeroOneTurn } from '../../domain/zeroOne';
import type { BullRule, DartArea, GameStatus, MatchStatus, PlayerKind } from '../../domain/types';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
} from '../../infrastructure/sqlite/types';
import { runGameDatabaseTransaction } from '../../infrastructure/sqlite/transaction';
import type {
  MatchDiagnosticDart,
  MatchDiagnosticGame,
  MatchDiagnosticRawRow,
  MatchDiagnosticReport,
  MatchDiagnosticSummary,
  MatchDiagnosticTurn,
  MatchRepairResult,
} from './MatchDiagnostics';
import type { MatchGameServicePort } from './MatchGameServicePort';

export type {
  MatchDiagnosticDart,
  MatchDiagnosticGame,
  MatchDiagnosticRawRow,
  MatchDiagnosticReport,
  MatchDiagnosticSummary,
  MatchDiagnosticTurn,
  MatchRepairResult,
} from './MatchDiagnostics';

export class MatchActiveExistsError extends Error {
  constructor(readonly matchId: string) {
    super('An active match already exists.');
    this.name = 'MatchActiveExistsError';
  }
}

export class MatchManualWinnerRequiredError extends Error {
  constructor() {
    super('Manual winner is required.');
    this.name = 'MatchManualWinnerRequiredError';
  }
}

export class MatchGameService implements MatchGameServicePort {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLastSettings() {
    const row = await this.db.getFirstAsync<{
      zero_one_start_score: 501 | 701;
      out_rule: 'single_out' | 'master_out';
      bull_rule: BullRule;
    }>(
      `SELECT zero_one_start_score, out_rule, bull_rule
       FROM matches
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    return {
      zeroOneStartScore: row?.zero_one_start_score ?? 501,
      outRule: row?.out_rule ?? 'single_out',
      bullRule: row?.bull_rule ?? 'fat_bull',
    };
  }

  async getActiveMatch(): Promise<MatchState | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM matches
       WHERE status IN ('in_progress', 'paused') AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    return row ? this.loadMatch(row.id) : null;
  }

  async listRecentResults(limit = 5): Promise<MatchState[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM matches
       WHERE status = 'completed' AND deleted_at IS NULL
       ORDER BY completed_at DESC, updated_at DESC
       LIMIT ?`,
      limit,
    );
    return Promise.all(rows.map((row) => this.loadMatch(row.id)));
  }

  async startMatch(input: MatchStartInput): Promise<MatchState> {
    validateStartInput(input);
    let matchId: string | null = null;
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const active = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM matches
         WHERE status IN ('in_progress', 'paused') AND deleted_at IS NULL
         LIMIT 1`,
      );
      if (active) {
        throw new MatchActiveExistsError(active.id);
      }
      const activeGame = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM game_sessions
         WHERE status IN ('in_progress', 'paused') AND deleted_at IS NULL
         LIMIT 1`,
      );
      if (activeGame) {
        throw new Error('An active game already exists.');
      }

      const players = await loadPlayers(transaction, [input.player1Id, input.player2Id]);
      const now = new Date().toISOString();
      matchId = createGameId();
      await transaction.runAsync(
        `INSERT INTO matches(
           id, status, zero_one_start_score, out_rule, bull_rule, first_throw_player_id,
           current_game_no, row_version, started_at, created_at, updated_at
         )
         VALUES (?, 'in_progress', ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
        matchId,
        input.zeroOneStartScore,
        input.outRule,
        input.bullRule,
        input.game1FirstThrowPlayerId,
        now,
        now,
        now,
      );
      for (const [index, player] of players.entries()) {
        await transaction.runAsync(
          `INSERT INTO match_players(
             match_id, player_id, slot_no, display_name_snapshot, player_type_snapshot,
             games_won, result, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?)`,
          matchId,
          player.id,
          index + 1,
          player.display_name,
          player.player_type,
          now,
          now,
        );
      }
      await createMatchGame(transaction, {
        matchId,
        gameNo: 1,
        mode: 'zero_one',
        firstThrowPlayerId: input.game1FirstThrowPlayerId,
        zeroOneStartScore: input.zeroOneStartScore,
        outRule: input.outRule,
        bullRule: input.bullRule,
        now,
      });
      await appendDomainEvent(transaction, 'match', matchId, 'match_started', { matchId });
    });

    if (!matchId) {
      throw new Error('MATCH was not created.');
    }
    return this.loadMatch(matchId);
  }

  async loadMatch(matchId: string): Promise<MatchState> {
    const match = await loadMatchRow(this.db, matchId);
    const players = await loadMatchPlayers(this.db, matchId);
    const games = await loadMatchGames(this.db, matchId);
    const activeGame =
      games.find((game) => ['in_progress', 'paused'].includes(game.status)) ?? null;
    const result = match.status === 'completed' ? await buildMatchResult(this.db, matchId) : null;
    const phase = deriveMatchPhase(match.status, games, players);

    return {
      matchId: match.id,
      status: match.status,
      phase,
      zeroOneStartScore: match.zero_one_start_score,
      outRule: match.out_rule,
      bullRule: match.bull_rule,
      currentGameNo: match.current_game_no as MatchState['currentGameNo'],
      players: players.map((player) => ({
        playerId: player.player_id,
        slotNo: player.slot_no,
        displayName: player.display_name_snapshot,
        playerType: player.player_type_snapshot,
        gamesWon: player.games_won,
        result: player.result,
      })),
      games,
      activeGame,
      choice:
        match.choice_selected_by_player_id && match.choice_game_mode && match.choice_selected_at
          ? {
              selectedByPlayerId: match.choice_selected_by_player_id,
              mode: match.choice_game_mode,
              reason: 'manual_choice',
              selectedAt: match.choice_selected_at,
            }
          : null,
      winnerPlayerId: match.winner_player_id,
      loserPlayerId: match.loser_player_id,
      completionReason: match.completion_reason,
      manualWinnerReason: match.manual_winner_reason,
      startedAt: match.started_at,
      pausedAt: match.paused_at,
      completedAt: match.completed_at,
      result,
    };
  }

  async recordDart(matchId: string, input: MatchDartInput): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, matchId);
      const existing = input.clientActionId
        ? await transaction.getFirstAsync<{ id: string }>(
            'SELECT id FROM darts WHERE client_action_id = ? LIMIT 1',
            input.clientActionId,
          )
        : null;
      if (existing) {
        return;
      }
      const activeCount = await countActiveDarts(transaction, context.turnId);
      if (activeCount >= 3) {
        throw new Error('This turn already has three darts.');
      }

      const dartNo = activeCount + 1;
      const now = new Date().toISOString();
      const calculated =
        context.mode === 'zero_one'
          ? { ...calculateZeroOneDartScore(input, context.bullRule), cricketMarks: 0 }
          : calculateMatchCricketDart(transaction, context, input);
      const resolved = await Promise.resolve(calculated);
      const dartId = createGameId();
      await transaction.runAsync(
        `INSERT INTO darts(
           id, game_id, turn_id, game_player_id, round_no, dart_no, segment_number,
           area, multiplier, score, cricket_marks, input_source, status,
           is_rating_eligible, correction_count, client_action_id, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?, ?)`,
        dartId,
        context.gameId,
        context.turnId,
        context.gamePlayerId,
        context.roundNo,
        dartNo,
        input.segmentNumber,
        input.area,
        resolved.multiplier,
        resolved.score,
        resolved.cricketMarks,
        input.inputSource ?? 'manual_segment',
        input.clientActionId ??
          `${context.gameId}:${context.turnSequenceNo}:${dartNo}:${Date.now()}`,
        now,
        now,
      );

      if (context.mode === 'zero_one') {
        await updateZeroOneTurnAfterDart(transaction, context);
      } else {
        await updateCricketTurnAfterDart(transaction, context, input, resolved.cricketMarks);
      }
    });
    return this.loadMatch(matchId);
  }

  async undoDart(matchId: string): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, matchId);
      const dart = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM darts
         WHERE turn_id = ? AND status = 'active'
         ORDER BY dart_no DESC
         LIMIT 1`,
        context.turnId,
      );
      if (dart) {
        const now = new Date().toISOString();
        await transaction.runAsync(
          `UPDATE darts SET status = 'voided', updated_at = ? WHERE id = ?`,
          now,
          dart.id,
        );
        await recomputeCurrentTurn(transaction, context);
      }
    });
    return this.loadMatch(matchId);
  }

  async redoDart(matchId: string, dartId: string): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, matchId);
      const dart = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM darts
         WHERE id = ? AND turn_id = ? AND status = 'voided'
         LIMIT 1`,
        dartId,
        context.turnId,
      );
      if (dart) {
        const now = new Date().toISOString();
        await transaction.runAsync(
          `UPDATE darts SET status = 'active', updated_at = ? WHERE id = ?`,
          now,
          dart.id,
        );
        await recomputeCurrentTurn(transaction, context);
      }
    });
    return this.loadMatch(matchId);
  }

  async confirmTurn(matchId: string): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, matchId);
      if (context.mode === 'zero_one') {
        await confirmZeroOneTurn(transaction, context, false);
      } else {
        await confirmCricketTurn(transaction, context);
      }
    });
    return this.loadMatch(matchId);
  }

  async completeCurrentGameByManualWinner(
    matchId: string,
    input: MatchManualWinnerInput,
  ): Promise<MatchState> {
    validateManualReason(input.reason);
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadCurrentGameContext(transaction, matchId);
      await completeGame(
        transaction,
        context.gameId,
        input.winnerPlayerId,
        'manual_winner',
        input.reason,
      );
    });
    return this.loadMatch(matchId);
  }

  async startNextGame(matchId: string): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const match = await loadMatchRow(transaction, matchId);
      const games = await loadGameRows(transaction, matchId);
      const players = await loadMatchPlayers(transaction, matchId);
      if (games.some((game) => ['in_progress', 'paused'].includes(game.status))) {
        return;
      }
      if (
        match.current_game_no === 1 &&
        games.some((game) => game.match_game_no === 1 && game.status === 'completed')
      ) {
        const first = players.find((player) => player.player_id !== match.first_throw_player_id);
        if (!first) throw new Error('Second first thrower was not found.');
        await createMatchGame(transaction, {
          matchId,
          gameNo: 2,
          mode: 'cricket',
          firstThrowPlayerId: first.player_id,
          zeroOneStartScore: match.zero_one_start_score,
          outRule: match.out_rule,
          bullRule: match.bull_rule,
          now: new Date().toISOString(),
        });
        return;
      }
      throw new Error('Next game is not available.');
    });
    return this.loadMatch(matchId);
  }

  async chooseFinalGame(matchId: string, input: MatchChoiceInput): Promise<MatchState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const match = await loadMatchRow(transaction, matchId);
      const games = await loadGameRows(transaction, matchId);
      const players = await loadMatchPlayers(transaction, matchId);
      if (!isOneOne(players) || games.some((game) => game.match_game_no === 3)) {
        throw new Error('CHOICE is not available.');
      }
      if (!players.some((player) => player.player_id === input.selectedByPlayerId)) {
        throw new Error('Choice selector must be a match player.');
      }
      if (!players.some((player) => player.player_id === input.firstThrowPlayerId)) {
        throw new Error('First thrower must be a match player.');
      }
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE matches
         SET choice_game_mode = ?, choice_selected_by_player_id = ?, choice_reason = 'manual_choice',
             choice_selected_at = ?, current_game_no = 3, updated_at = ?
         WHERE id = ?`,
        input.mode,
        input.selectedByPlayerId,
        now,
        now,
        matchId,
      );
      await createMatchGame(transaction, {
        matchId,
        gameNo: 3,
        mode: input.mode,
        firstThrowPlayerId: input.firstThrowPlayerId,
        zeroOneStartScore: match.zero_one_start_score,
        outRule: match.out_rule,
        bullRule: match.bull_rule,
        now,
      });
    });
    return this.loadMatch(matchId);
  }

  async pauseMatch(matchId: string): Promise<MatchState> {
    const now = new Date().toISOString();
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await transaction.runAsync(
        `UPDATE matches SET status = 'paused', paused_at = ?, updated_at = ? WHERE id = ?`,
        now,
        now,
        matchId,
      );
      await transaction.runAsync(
        `UPDATE game_sessions SET status = 'paused', paused_at = ?, updated_at = ? WHERE match_id = ? AND status = 'in_progress'`,
        now,
        now,
        matchId,
      );
    });
    return this.loadMatch(matchId);
  }

  async resumeMatch(matchId: string): Promise<MatchState> {
    const now = new Date().toISOString();
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await transaction.runAsync(
        `UPDATE matches SET status = 'in_progress', paused_at = NULL, updated_at = ? WHERE id = ?`,
        now,
        matchId,
      );
      await transaction.runAsync(
        `UPDATE game_sessions SET status = 'in_progress', paused_at = NULL, updated_at = ? WHERE match_id = ? AND status = 'paused'`,
        now,
        matchId,
      );
    });
    return this.loadMatch(matchId);
  }

  async abortMatch(matchId: string): Promise<void> {
    const now = new Date().toISOString();
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await transaction.runAsync(
        `UPDATE matches
         SET status = 'aborted', completion_reason = 'aborted', completed_at = ?, updated_at = ?
         WHERE id = ? AND status IN ('in_progress', 'paused')`,
        now,
        now,
        matchId,
      );
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = 'aborted', completion_reason = 'aborted', completed_at = ?, aborted_at = ?, updated_at = ?
         WHERE match_id = ? AND status IN ('in_progress', 'paused')`,
        now,
        now,
        now,
        matchId,
      );
    });
  }

  async getMatchDiagnostics(matchId: string): Promise<MatchDiagnosticReport> {
    return buildMatchDiagnosticReport(this.db, matchId);
  }

  async ensureRatingEvaluationCurrent(matchId: string): Promise<MatchRepairResult> {
    const holder: { result: MatchRepairResult | null } = { result: null };

    await runGameDatabaseTransaction(this.db, async (transaction) => {
      holder.result = await ensureMatchRatingEvaluationCurrent(transaction, matchId);
    });

    if (!holder.result) {
      throw new Error('MATCH rating repair did not return a result.');
    }
    console.log('[MATCH repair before]', holder.result.before);
    console.log('[MATCH repair after]', holder.result.after);
    return holder.result;
  }
}

type PlayerRow = {
  id: string;
  player_type: PlayerKind;
  display_name: string;
  account_id?: string | null;
};

type MatchRow = {
  id: string;
  status: MatchStatus;
  zero_one_start_score: 501 | 701;
  out_rule: 'single_out' | 'master_out';
  bull_rule: BullRule;
  first_throw_player_id: string | null;
  current_game_no: number;
  choice_game_mode: MatchGameMode | null;
  choice_selected_by_player_id: string | null;
  choice_selected_at: string | null;
  winner_player_id: string | null;
  loser_player_id: string | null;
  completion_reason: MatchState['completionReason'];
  manual_winner_reason: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
};

type MatchPlayerRow = {
  player_id: string;
  slot_no: MatchPlayerSlot;
  display_name_snapshot: string;
  player_type_snapshot: 'owner' | 'guest';
  games_won: number;
  result: 'pending' | 'win' | 'loss' | 'no_result';
};

type GameRow = {
  id: string;
  match_game_no: MatchGameNo;
  mode: MatchGameMode;
  status: GameStatus;
  current_round_no: number;
  current_turn_sequence_no: number;
  current_player_id: string | null;
  winner_player_id: string | null;
  completion_reason: string | null;
  manual_winner_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type MutableTurnContext = {
  matchId: string;
  gameId: string;
  mode: MatchGameMode;
  bullRule: BullRule;
  outRule: 'single_out' | 'master_out' | null;
  zeroOneStartScore: 501 | 701 | null;
  gamePlayerId: string;
  playerId: string;
  turnId: string;
  turnSequenceNo: number;
  roundId: string;
  roundNo: number;
  playerTurnOrder: MatchPlayerSlot;
  startRemainingScore: number | null;
};

function validateStartInput(input: MatchStartInput) {
  if (![501, 701].includes(input.zeroOneStartScore)) {
    throw new Error('MATCH GAME 1 must be 501 or 701.');
  }
  if (input.player1Id === input.player2Id) {
    throw new Error('MATCH requires two different players.');
  }
  if (![input.player1Id, input.player2Id].includes(input.game1FirstThrowPlayerId)) {
    throw new Error('First throw player must be in the match.');
  }
}

function validateManualReason(reason: string) {
  const length = reason.trim().length;
  if (length < 1 || length > 100) {
    throw new Error('Manual winner reason must be 1-100 characters.');
  }
}

async function loadPlayers(db: GameDatabaseExecutor, playerIds: string[]): Promise<PlayerRow[]> {
  const rows = await db.getAllAsync<PlayerRow>(
    `SELECT id, player_type, display_name, account_id
     FROM players
     WHERE id IN (?, ?) AND is_archived = 0`,
    playerIds[0],
    playerIds[1],
  );
  if (rows.length !== 2) {
    throw new Error('MATCH players were not found.');
  }
  return playerIds.map((id) => {
    const player = rows.find((row) => row.id === id);
    if (!player) throw new Error('MATCH player order could not be resolved.');
    return player;
  });
}

async function loadMatchRow(db: GameDatabaseExecutor, matchId: string): Promise<MatchRow> {
  const row = await db.getFirstAsync<MatchRow>(
    `SELECT id, status, zero_one_start_score, out_rule, bull_rule, first_throw_player_id,
            current_game_no, choice_game_mode, choice_selected_by_player_id, choice_selected_at,
            winner_player_id, loser_player_id, completion_reason, manual_winner_reason,
            started_at, paused_at, completed_at
     FROM matches
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    matchId,
  );
  if (!row) {
    throw new Error('MATCH was not found.');
  }
  return row;
}

async function loadMatchPlayers(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchPlayerRow[]> {
  return db.getAllAsync<MatchPlayerRow>(
    `SELECT player_id, slot_no, display_name_snapshot, player_type_snapshot, games_won, result
     FROM match_players
     WHERE match_id = ?
     ORDER BY slot_no`,
    matchId,
  );
}

async function loadGameRows(db: GameDatabaseExecutor, matchId: string): Promise<GameRow[]> {
  return db.getAllAsync<GameRow>(
    `SELECT id, match_game_no, mode, status, current_round_no, current_turn_sequence_no,
            current_player_id, winner_player_id, completion_reason, manual_winner_reason,
            started_at, completed_at
     FROM game_sessions
     WHERE match_id = ? AND deleted_at IS NULL
     ORDER BY match_game_no`,
    matchId,
  );
}

async function loadMatchGames(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchGameState[]> {
  const games = await loadGameRows(db, matchId);
  return Promise.all(
    games.map(async (game) => {
      const [players, turns, cricketTargets] = await Promise.all([
        db.getAllAsync<{
          player_id: string;
          slot_no: MatchPlayerSlot;
          turn_order: MatchPlayerSlot;
          display_name_snapshot: string;
          starting_score: number | null;
          current_remaining_score: number | null;
          current_cricket_score: number;
          darts_thrown: number;
          turns_confirmed: number;
          is_winner: number;
          result: MatchGameState['players'][number]['result'];
        }>(
          `SELECT player_id, slot_no, turn_order, display_name_snapshot, starting_score,
                  current_remaining_score, current_cricket_score, darts_thrown, turns_confirmed,
                  is_winner, result
           FROM game_players
           WHERE game_id = ?
           ORDER BY slot_no`,
          game.id,
        ),
        loadTurns(db, game.id),
        loadCricketTargets(db, game.id),
      ]);
      const currentTurn =
        turns.find((turn) => turn.turnSequenceNo === game.current_turn_sequence_no) ?? null;
      return {
        gameId: game.id,
        gameNo: game.match_game_no,
        mode: game.mode,
        status: game.status,
        currentRoundNo: game.current_round_no,
        currentTurnSequenceNo: game.current_turn_sequence_no,
        currentPlayerId: game.current_player_id,
        winnerPlayerId: game.winner_player_id,
        completionReason: game.completion_reason as MatchGameState['completionReason'],
        manualWinnerReason: game.manual_winner_reason,
        players: players.map((player) => ({
          playerId: player.player_id,
          slotNo: player.slot_no,
          turnOrder: player.turn_order,
          displayName: player.display_name_snapshot,
          startingScore: player.starting_score,
          currentRemainingScore: player.current_remaining_score,
          currentCricketScore: player.current_cricket_score,
          dartsThrown: player.darts_thrown,
          turnsConfirmed: player.turns_confirmed,
          isWinner: player.is_winner === 1,
          result: player.result,
        })),
        turns,
        currentTurn,
        cricketTargets,
        startedAt: game.started_at,
        completedAt: game.completed_at,
      };
    }),
  );
}

async function loadTurns(db: GameDatabaseExecutor, gameId: string): Promise<MatchTurn[]> {
  const rows = await db.getAllAsync<{
    id: string;
    game_player_id: string;
    player_id: string;
    turn_sequence_no: number;
    round_no: number;
    player_turn_order: MatchPlayerSlot;
    status: MatchTurn['status'];
    start_remaining_score: number | null;
    end_remaining_score: number | null;
    raw_score: number;
    applied_score: number;
    cricket_marks_total: number;
    cricket_points_scored: number;
    is_bust: number;
    is_checkout: number;
    dart_count: number;
  }>(
    `SELECT t.id, t.game_player_id, gp.player_id, t.turn_sequence_no, t.round_no,
            t.player_turn_order, t.status, t.start_remaining_score, t.end_remaining_score,
            t.raw_score, t.applied_score, t.cricket_marks_total, t.cricket_points_scored,
            t.is_bust, t.is_checkout, t.dart_count
     FROM turns t
     JOIN game_players gp ON gp.id = t.game_player_id
     WHERE t.game_id = ?
     ORDER BY t.turn_sequence_no`,
    gameId,
  );
  const darts = await db.getAllAsync<MatchDart & { turn_id: string }>(
    `SELECT d.id, gp.player_id AS playerId, d.turn_id, d.round_no AS roundNo,
            t.turn_sequence_no AS turnSequenceNo, d.dart_no AS dartNo, d.area,
            d.segment_number AS segmentNumber, d.multiplier, d.score,
            d.cricket_marks AS cricketMarks, d.status, d.input_source AS inputSource,
            d.client_action_id AS clientActionId, d.created_at AS createdAt
     FROM darts d
     JOIN turns t ON t.id = d.turn_id
     JOIN game_players gp ON gp.id = d.game_player_id
     WHERE d.game_id = ?
     ORDER BY t.turn_sequence_no, d.dart_no`,
    gameId,
  );
  return rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    roundNo: row.round_no,
    turnSequenceNo: row.turn_sequence_no,
    playerTurnOrder: row.player_turn_order,
    status: row.status,
    startRemainingScore: row.start_remaining_score,
    endRemainingScore: row.end_remaining_score,
    rawScore: row.raw_score,
    appliedScore: row.applied_score,
    cricketMarksTotal: row.cricket_marks_total,
    cricketPointsScored: row.cricket_points_scored,
    dartCount: row.dart_count,
    isBust: row.is_bust === 1,
    isCheckout: row.is_checkout === 1,
    darts: darts.filter((dart) => dart.turn_id === row.id),
  }));
}

async function loadCricketTargets(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<MatchGameState['cricketTargets']> {
  return db.getAllAsync<MatchGameState['cricketTargets'][number]>(
    `SELECT gp.player_id AS playerId, c.target, c.marks_total AS marksTotal,
            c.is_closed AS isClosed, c.points_scored AS pointsScored
     FROM cricket_number_states c
     JOIN game_players gp ON gp.id = c.game_player_id
     WHERE c.game_id = ?
     ORDER BY gp.slot_no, c.target`,
    gameId,
  );
}

function deriveMatchPhase(
  status: MatchStatus,
  games: MatchGameState[],
  players: MatchPlayerRow[],
): MatchState['phase'] {
  if (status === 'completed') return 'completed';
  if (status === 'aborted') return 'aborted';
  if (status === 'invalid') return 'invalid';
  if (games.some((game) => ['in_progress', 'paused'].includes(game.status)))
    return 'game_in_progress';
  if (isOneOne(players) && !games.some((game) => game.gameNo === 3)) return 'choice_required';
  return 'next_game_available';
}

function isOneOne(players: Pick<MatchPlayerRow, 'games_won'>[]) {
  return players.length === 2 && players.every((player) => player.games_won === 1);
}

async function createMatchGame(
  db: GameDatabaseExecutor,
  input: {
    matchId: string;
    gameNo: MatchGameNo;
    mode: MatchGameMode;
    firstThrowPlayerId: string;
    zeroOneStartScore: 501 | 701;
    outRule: 'single_out' | 'master_out';
    bullRule: BullRule;
    now: string;
  },
) {
  const players = await loadMatchPlayers(db, input.matchId);
  const gameId = createGameId();
  const roundId = createGameId();
  const first = players.find((player) => player.player_id === input.firstThrowPlayerId);
  const second = players.find((player) => player.player_id !== input.firstThrowPlayerId);
  if (!first || !second) {
    throw new Error('First throw player must be a match player.');
  }
  await db.runAsync(
    `INSERT INTO game_sessions(
       id, match_id, match_game_no, mode, status, completion_reason, max_rounds, bull_rule,
       out_rule, zero_one_start_score, player_count, current_round_no, current_turn_sequence_no,
       current_player_id, rating_candidate, config_json, row_version, started_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, 'in_progress', NULL, ?, ?, ?, ?, 2, 1, 1, ?, 1, ?, 0, ?, ?, ?)`,
    gameId,
    input.matchId,
    input.gameNo,
    input.mode,
    MATCH_GAME_MAX_ROUNDS,
    input.bullRule,
    input.mode === 'zero_one' ? input.outRule : null,
    input.mode === 'zero_one' ? input.zeroOneStartScore : null,
    input.firstThrowPlayerId,
    JSON.stringify({ version: 1, matchGameNo: input.gameNo }),
    input.now,
    input.now,
    input.now,
  );
  const ordered = [first, second];
  for (const [index, player] of ordered.entries()) {
    const gamePlayerId = createGameId();
    await db.runAsync(
      `INSERT INTO game_players(
         id, game_id, player_id, slot_no, turn_order, display_name_snapshot,
         player_type_snapshot, starting_score, current_remaining_score, current_total_score,
         current_cricket_score, darts_thrown, turns_confirmed, is_winner, result,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending', ?, ?)`,
      gamePlayerId,
      gameId,
      player.player_id,
      player.slot_no,
      (index + 1) as MatchPlayerSlot,
      player.display_name_snapshot,
      player.player_type_snapshot,
      input.mode === 'zero_one' ? input.zeroOneStartScore : null,
      input.mode === 'zero_one' ? input.zeroOneStartScore : null,
      input.now,
      input.now,
    );
    if (index === 0) {
      await db.runAsync(
        `INSERT INTO rounds(id, game_id, round_no, status, started_at, created_at, updated_at)
         VALUES (?, ?, 1, 'in_progress', ?, ?, ?)`,
        roundId,
        gameId,
        input.now,
        input.now,
        input.now,
      );
      await db.runAsync(
        `INSERT INTO turns(
           id, game_id, round_id, game_player_id, turn_sequence_no, round_no, player_turn_order,
           status, start_remaining_score, end_remaining_score, started_at, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 1, 1, 1, 'in_progress', ?, ?, ?, ?, ?)`,
        createGameId(),
        gameId,
        roundId,
        gamePlayerId,
        input.mode === 'zero_one' ? input.zeroOneStartScore : null,
        input.mode === 'zero_one' ? input.zeroOneStartScore : null,
        input.now,
        input.now,
        input.now,
      );
    }
    if (input.mode === 'cricket') {
      for (const target of CRICKET_TARGETS) {
        await db.runAsync(
          `INSERT INTO cricket_number_states(
             game_id, game_player_id, target, marks_total, is_closed,
             closed_at_turn_id, closed_at_round_no, points_scored, updated_at
           )
           VALUES (?, ?, ?, 0, 0, NULL, NULL, 0, ?)`,
          gameId,
          gamePlayerId,
          target,
          input.now,
        );
      }
    }
  }
  await db.runAsync(
    `UPDATE matches SET current_game_no = ?, updated_at = ? WHERE id = ?`,
    input.gameNo,
    input.now,
    input.matchId,
  );
  await appendDomainEvent(db, 'game', gameId, 'match_game_started', {
    matchId: input.matchId,
    gameNo: input.gameNo,
    mode: input.mode,
  });
}

async function loadMutableTurnContext(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MutableTurnContext> {
  const row = await db.getFirstAsync<MutableTurnContext>(
    `SELECT m.id AS matchId, g.id AS gameId, g.mode, g.bull_rule AS bullRule,
            g.out_rule AS outRule, g.zero_one_start_score AS zeroOneStartScore,
            gp.id AS gamePlayerId, gp.player_id AS playerId, t.id AS turnId,
            t.turn_sequence_no AS turnSequenceNo, t.round_id AS roundId, t.round_no AS roundNo,
            t.player_turn_order AS playerTurnOrder, t.start_remaining_score AS startRemainingScore
     FROM matches m
     JOIN game_sessions g ON g.match_id = m.id AND g.status = 'in_progress'
     JOIN turns t ON t.game_id = g.id AND t.status = 'in_progress'
     JOIN game_players gp ON gp.id = t.game_player_id
     WHERE m.id = ? AND m.status = 'in_progress'
     LIMIT 1`,
    matchId,
  );
  if (!row) {
    throw new Error('No mutable MATCH turn is available.');
  }
  return row;
}

async function loadCurrentGameContext(db: GameDatabaseExecutor, matchId: string) {
  const row = await db.getFirstAsync<{ gameId: string }>(
    `SELECT id AS gameId FROM game_sessions
     WHERE match_id = ? AND status = 'in_progress'
     LIMIT 1`,
    matchId,
  );
  if (!row) throw new Error('No active MATCH game is available.');
  return row;
}

async function countActiveDarts(db: GameDatabaseExecutor, turnId: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM darts WHERE turn_id = ? AND status = 'active'`,
    turnId,
  );
  return row?.count ?? 0;
}

async function calculateMatchCricketDart(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  input: MatchDartInput,
) {
  const calculated = calculateCricketDart(input, context.bullRule);
  if (!calculated.target || calculated.cricketMarks <= 0) {
    return calculated;
  }
  const rows = await db.getAllAsync<{
    game_player_id: string;
    marks_total: number;
    is_closed: number;
  }>(
    `SELECT game_player_id, marks_total, is_closed
     FROM cricket_number_states
     WHERE game_id = ? AND target = ?`,
    context.gameId,
    calculated.target,
  );
  const mine = rows.find((row) => row.game_player_id === context.gamePlayerId);
  const opponent = rows.find((row) => row.game_player_id !== context.gamePlayerId);
  const marksNeeded = Math.max(3 - (mine?.marks_total ?? 0), 0);
  const scoringMarks = Math.max(calculated.cricketMarks - marksNeeded, 0);
  const points =
    opponent && opponent.is_closed === 0
      ? scoringMarks * getTargetPointValue(calculated.target)
      : 0;
  return { ...calculated, score: points };
}

async function updateZeroOneTurnAfterDart(db: GameDatabaseExecutor, context: MutableTurnContext) {
  const darts = await db.getAllAsync<{
    score: number;
    area: DartArea;
    status: 'active' | 'voided' | 'invalidated';
  }>(`SELECT score, area, status FROM darts WHERE turn_id = ? ORDER BY dart_no`, context.turnId);
  const evaluation = evaluateZeroOneTurn(
    context.startRemainingScore ?? 0,
    darts,
    context.outRule ?? 'single_out',
  );
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE turns
     SET raw_score = ?, applied_score = ?, end_remaining_score = ?, is_bust = ?,
         is_checkout = ?, dart_count = ?, updated_at = ?
     WHERE id = ?`,
    evaluation.rawScore,
    evaluation.appliedScore,
    evaluation.endRemainingScore,
    evaluation.isBust ? 1 : 0,
    evaluation.isCheckout ? 1 : 0,
    darts.filter((dart) => dart.status === 'active').length,
    now,
    context.turnId,
  );
  if (evaluation.isBust) {
    await confirmZeroOneTurn(db, context, true);
  } else if (evaluation.isCheckout) {
    await db.runAsync(
      `UPDATE turns SET status = 'checkout', confirmed_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      context.turnId,
    );
    await db.runAsync(
      `UPDATE game_players
       SET current_remaining_score = 0, darts_thrown = darts_thrown + ?, turns_confirmed = turns_confirmed + 1,
           updated_at = ?
       WHERE id = ?`,
      darts.filter((dart) => dart.status === 'active').length,
      now,
      context.gamePlayerId,
    );
    await completeGame(db, context.gameId, context.playerId, 'checkout', null);
  }
}

async function updateCricketTurnAfterDart(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  input: MatchDartInput,
  marks: number,
) {
  const target = getCricketTarget(input);
  const now = new Date().toISOString();
  if (target && marks > 0) {
    const state = await db.getFirstAsync<{
      marks_total: number;
      is_closed: number;
      points_scored: number;
    }>(
      `SELECT marks_total, is_closed, points_scored
       FROM cricket_number_states
       WHERE game_id = ? AND game_player_id = ? AND target = ?`,
      context.gameId,
      context.gamePlayerId,
      target,
    );
    const nextMarks = (state?.marks_total ?? 0) + marks;
    await db.runAsync(
      `UPDATE cricket_number_states
       SET marks_total = ?, is_closed = ?, closed_at_turn_id = CASE WHEN is_closed = 0 AND ? >= 3 THEN ? ELSE closed_at_turn_id END,
           closed_at_round_no = CASE WHEN is_closed = 0 AND ? >= 3 THEN ? ELSE closed_at_round_no END,
           points_scored = points_scored + ?, updated_at = ?
       WHERE game_id = ? AND game_player_id = ? AND target = ?`,
      nextMarks,
      nextMarks >= 3 ? 1 : 0,
      nextMarks,
      context.turnId,
      nextMarks,
      context.roundNo,
      await getLastDartScore(db, context.turnId),
      now,
      context.gameId,
      context.gamePlayerId,
      target,
    );
  }
  await recomputeCurrentTurn(db, context);
  const naturalWinner = await getNaturalCricketWinner(db, context.gameId);
  if (naturalWinner) {
    await db.runAsync(
      `UPDATE turns SET status = 'game_end', confirmed_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      context.turnId,
    );
    await completeGame(db, context.gameId, naturalWinner, 'cricket_all_closed_with_score', null);
  }
}

async function getLastDartScore(db: GameDatabaseExecutor, turnId: string): Promise<number> {
  const row = await db.getFirstAsync<{ score: number }>(
    `SELECT score FROM darts WHERE turn_id = ? AND status = 'active' ORDER BY dart_no DESC LIMIT 1`,
    turnId,
  );
  return row?.score ?? 0;
}

async function recomputeCurrentTurn(db: GameDatabaseExecutor, context: MutableTurnContext) {
  const row = await db.getFirstAsync<{
    raw_score: number;
    marks: number;
    points: number;
    darts: number;
  }>(
    `SELECT COALESCE(SUM(score), 0) AS raw_score,
            COALESCE(SUM(cricket_marks), 0) AS marks,
            COALESCE(SUM(score), 0) AS points,
            COUNT(*) AS darts
     FROM darts
     WHERE turn_id = ? AND status = 'active'`,
    context.turnId,
  );
  await db.runAsync(
    `UPDATE turns
     SET raw_score = ?, applied_score = ?, cricket_marks_total = ?, cricket_points_scored = ?,
         dart_count = ?, updated_at = ?
     WHERE id = ?`,
    row?.raw_score ?? 0,
    context.mode === 'zero_one' ? (row?.raw_score ?? 0) : 0,
    row?.marks ?? 0,
    context.mode === 'cricket' ? (row?.points ?? 0) : 0,
    row?.darts ?? 0,
    new Date().toISOString(),
    context.turnId,
  );
}

async function confirmZeroOneTurn(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  bustAlreadyEvaluated: boolean,
) {
  const darts = await db.getAllAsync<{
    score: number;
    area: DartArea;
    status: 'active' | 'voided' | 'invalidated';
  }>(`SELECT score, area, status FROM darts WHERE turn_id = ? ORDER BY dart_no`, context.turnId);
  const activeDarts = darts.filter((dart) => dart.status === 'active');
  const evaluation = bustAlreadyEvaluated
    ? evaluateZeroOneTurn(context.startRemainingScore ?? 0, darts, context.outRule ?? 'single_out')
    : evaluateZeroOneTurn(
        context.startRemainingScore ?? 0,
        darts,
        context.outRule ?? 'single_out',
        true,
      );
  const status = evaluation.isBust ? 'bust' : evaluation.isCheckout ? 'checkout' : 'confirmed';
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE turns
     SET status = ?, raw_score = ?, applied_score = ?, end_remaining_score = ?,
         is_bust = ?, is_checkout = ?, dart_count = ?, confirmed_at = ?, updated_at = ?
     WHERE id = ?`,
    status,
    evaluation.rawScore,
    evaluation.appliedScore,
    evaluation.endRemainingScore,
    evaluation.isBust ? 1 : 0,
    evaluation.isCheckout ? 1 : 0,
    activeDarts.length,
    now,
    now,
    context.turnId,
  );
  await db.runAsync(
    `UPDATE game_players
     SET current_remaining_score = ?, darts_thrown = darts_thrown + ?, turns_confirmed = turns_confirmed + 1,
         updated_at = ?
     WHERE id = ?`,
    evaluation.endRemainingScore,
    activeDarts.length,
    now,
    context.gamePlayerId,
  );
  if (context.roundNo >= MATCH_GAME_MAX_ROUNDS && context.playerTurnOrder === 2) {
    const winner = await getZeroOneRoundLimitWinner(db, context.gameId);
    if (!winner) throw new MatchManualWinnerRequiredError();
    await completeGame(db, context.gameId, winner, 'zero_one_round_limit', null);
    return;
  }
  await createNextTurn(db, context, now);
}

async function confirmCricketTurn(db: GameDatabaseExecutor, context: MutableTurnContext) {
  const now = new Date().toISOString();
  await recomputeCurrentTurn(db, context);
  const turn = await db.getFirstAsync<{
    dart_count: number;
    cricket_marks_total: number;
    cricket_points_scored: number;
  }>(
    `SELECT dart_count, cricket_marks_total, cricket_points_scored FROM turns WHERE id = ?`,
    context.turnId,
  );
  await db.runAsync(
    `UPDATE turns SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`,
    now,
    now,
    context.turnId,
  );
  await db.runAsync(
    `UPDATE game_players
     SET current_cricket_score = current_cricket_score + ?, darts_thrown = darts_thrown + ?,
         turns_confirmed = turns_confirmed + 1, updated_at = ?
     WHERE id = ?`,
    turn?.cricket_points_scored ?? 0,
    turn?.dart_count ?? 0,
    now,
    context.gamePlayerId,
  );
  if (context.roundNo >= MATCH_GAME_MAX_ROUNDS && context.playerTurnOrder === 2) {
    const winner = await getCricketRoundLimitWinner(db, context.gameId);
    if (!winner) throw new MatchManualWinnerRequiredError();
    await completeGame(db, context.gameId, winner, 'cricket_round_limit', null);
    return;
  }
  await createNextTurn(db, context, now);
}

async function createNextTurn(db: GameDatabaseExecutor, context: MutableTurnContext, now: string) {
  const nextOrder = context.playerTurnOrder === 1 ? 2 : 1;
  const nextRound = nextOrder === 1 ? context.roundNo + 1 : context.roundNo;
  let roundId = context.roundId;
  if (nextOrder === 1) {
    roundId = createGameId();
    await db.runAsync(
      `UPDATE rounds SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      context.roundId,
    );
    await db.runAsync(
      `INSERT INTO rounds(id, game_id, round_no, status, started_at, created_at, updated_at)
       VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`,
      roundId,
      context.gameId,
      nextRound,
      now,
      now,
      now,
    );
  }
  const nextPlayer = await db.getFirstAsync<{
    id: string;
    player_id: string;
    current_remaining_score: number | null;
  }>(
    `SELECT id, player_id, current_remaining_score
     FROM game_players
     WHERE game_id = ? AND turn_order = ?
     LIMIT 1`,
    context.gameId,
    nextOrder,
  );
  if (!nextPlayer) throw new Error('Next player was not found.');
  await db.runAsync(
    `INSERT INTO turns(
       id, game_id, round_id, game_player_id, turn_sequence_no, round_no, player_turn_order,
       status, start_remaining_score, end_remaining_score, started_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)`,
    createGameId(),
    context.gameId,
    roundId,
    nextPlayer.id,
    context.turnSequenceNo + 1,
    nextRound,
    nextOrder,
    context.mode === 'zero_one' ? nextPlayer.current_remaining_score : null,
    context.mode === 'zero_one' ? nextPlayer.current_remaining_score : null,
    now,
    now,
    now,
  );
  await db.runAsync(
    `UPDATE game_sessions
     SET current_round_no = ?, current_turn_sequence_no = ?, current_player_id = ?, updated_at = ?
     WHERE id = ?`,
    nextRound,
    context.turnSequenceNo + 1,
    nextPlayer.player_id,
    now,
    context.gameId,
  );
}

async function getZeroOneRoundLimitWinner(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<string | null> {
  const rows = await db.getAllAsync<{ player_id: string; current_remaining_score: number }>(
    `SELECT player_id, current_remaining_score FROM game_players WHERE game_id = ? ORDER BY current_remaining_score ASC`,
    gameId,
  );
  if (rows.length !== 2 || rows[0].current_remaining_score === rows[1].current_remaining_score) {
    return null;
  }
  return rows[0].player_id;
}

async function getNaturalCricketWinner(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<string | null> {
  const rows = await db.getAllAsync<{ player_id: string; score: number; closed: number }>(
    `SELECT gp.player_id, gp.current_cricket_score + COALESCE(SUM(c.points_scored), 0) AS score,
            SUM(CASE WHEN c.is_closed = 1 THEN 1 ELSE 0 END) AS closed
     FROM game_players gp
     JOIN cricket_number_states c ON c.game_player_id = gp.id
     WHERE gp.game_id = ?
     GROUP BY gp.player_id, gp.current_cricket_score`,
    gameId,
  );
  for (const row of rows) {
    const opponent = rows.find((item) => item.player_id !== row.player_id);
    if (
      row.closed === CRICKET_TARGETS.length &&
      row.score > 0 &&
      (!opponent || row.score >= opponent.score)
    ) {
      return row.player_id;
    }
  }
  return null;
}

async function getCricketRoundLimitWinner(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<string | null> {
  const rows = await db.getAllAsync<{
    player_id: string;
    score: number;
    closed: number;
    marks: number;
  }>(
    `SELECT gp.player_id, COALESCE(SUM(c.points_scored), 0) AS score,
            SUM(CASE WHEN c.is_closed = 1 THEN 1 ELSE 0 END) AS closed,
            COALESCE(SUM(c.marks_total), 0) AS marks
     FROM game_players gp
     JOIN cricket_number_states c ON c.game_player_id = gp.id
     WHERE gp.game_id = ?
     GROUP BY gp.player_id
     ORDER BY score DESC, closed DESC, marks DESC`,
    gameId,
  );
  if (
    rows.length !== 2 ||
    (rows[0].score === rows[1].score &&
      rows[0].closed === rows[1].closed &&
      rows[0].marks === rows[1].marks)
  ) {
    return null;
  }
  return rows[0].player_id;
}

async function completeGame(
  db: GameDatabaseExecutor,
  gameId: string,
  winnerPlayerId: string,
  completionReason: string,
  manualReason: string | null,
) {
  const now = new Date().toISOString();
  const game = await db.getFirstAsync<{
    match_id: string;
    match_game_no: number;
    mode: MatchGameMode;
  }>(`SELECT match_id, match_game_no, mode FROM game_sessions WHERE id = ?`, gameId);
  if (!game) throw new Error('Game was not found.');
  const players = await db.getAllAsync<{ id: string; player_id: string }>(
    `SELECT id, player_id FROM game_players WHERE game_id = ?`,
    gameId,
  );
  const loser = players.find((player) => player.player_id !== winnerPlayerId);
  const winner = players.find((player) => player.player_id === winnerPlayerId);
  if (!winner || !loser) throw new Error('Winner must be a game player.');
  await db.runAsync(
    `UPDATE game_sessions
     SET status = 'completed', completion_reason = ?, winner_player_id = ?,
         manual_winner_reason = ?, completed_at = ?, updated_at = ?
     WHERE id = ? AND status = 'in_progress'`,
    completionReason,
    winnerPlayerId,
    manualReason,
    now,
    now,
    gameId,
  );
  await db.runAsync(
    `UPDATE game_players SET is_winner = 1, result = 'win', updated_at = ? WHERE id = ?`,
    now,
    winner.id,
  );
  await db.runAsync(
    `UPDATE game_players SET is_winner = 0, result = 'loss', updated_at = ? WHERE id = ?`,
    now,
    loser.id,
  );
  await insertGamePlayerResults(db, gameId, completionReason);
  await db.runAsync(
    `UPDATE match_players SET games_won = games_won + 1, updated_at = ? WHERE match_id = ? AND player_id = ?`,
    now,
    game.match_id,
    winnerPlayerId,
  );
  const matchPlayers = await loadMatchPlayers(db, game.match_id);
  const leading = matchPlayers.find((player) => player.player_id === winnerPlayerId);
  if (leading && leading.games_won >= 2) {
    await completeMatch(db, game.match_id, winnerPlayerId, loser.player_id, manualReason !== null);
  }
}

async function insertGamePlayerResults(
  db: GameDatabaseExecutor,
  gameId: string,
  completionReason: string,
) {
  const players = await db.getAllAsync<{
    id: string;
    player_id: string;
    result: 'win' | 'loss';
    is_winner: number;
    current_remaining_score: number | null;
  }>(
    `SELECT id, player_id, result, is_winner, current_remaining_score FROM game_players WHERE game_id = ?`,
    gameId,
  );
  for (const player of players) {
    const stats = await getPlayerGameStats(db, gameId, player.id);
    await db.runAsync(
      `INSERT OR REPLACE INTO game_player_results(
         game_id, game_player_id, player_id, result, rank_no, is_final, final_total_score,
         final_remaining_score, effective_score, rounds_count, turns_count, darts_thrown,
         bull_count, inner_bull_count, outer_bull_count, triple_count, double_count, miss_count,
         bust_count, checkout_flag, ppd_milli, three_dart_average_milli, cricket_marks_total,
         mpr_milli, closed_number_count, extra_stats_json, calculation_version, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?)`,
      gameId,
      player.id,
      player.player_id,
      player.result,
      player.is_winner === 1 ? 1 : 2,
      stats.totalScore,
      player.current_remaining_score,
      stats.effectiveScore,
      stats.rounds,
      stats.turns,
      stats.darts,
      stats.bull,
      stats.innerBull,
      stats.outerBull,
      stats.triple,
      stats.double,
      stats.miss,
      stats.bust,
      stats.checkout,
      stats.ppdMilli,
      stats.threeDartAverageMilli,
      stats.marks,
      stats.mprMilli,
      stats.closed,
      JSON.stringify({
        schemaVersion: 3,
        completionReason,
        zeroOneRatingEffectiveScore: stats.zeroOneRatingEffectiveScore,
        zeroOneRatingDarts: stats.zeroOneRatingDarts,
        legacyDartCountFallbackUsed: stats.legacyDartCountFallbackUsed,
        legacyDartCountFallbacks: stats.legacyDartCountFallbacks,
      }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
}

async function getPlayerGameStats(db: GameDatabaseExecutor, gameId: string, gamePlayerId: string) {
  const game = await db.getFirstAsync<{
    mode: MatchGameMode;
    completion_reason: string | null;
  }>('SELECT mode, completion_reason FROM game_sessions WHERE id = ?', gameId);
  const turnDartCounts = await getCanonicalTurnDartCounts(db, gameId, gamePlayerId);
  const resolvedTurns = turnDartCounts.map((turn) => ({
    ...turn,
    ratingTurnKind: resolveRatingTurnKind(turn, game),
  }));
  const canonicalDarts = turnDartCounts.reduce((sum, row) => sum + row.canonicalDarts, 0);
  const legacyDartCountFallbacks = turnDartCounts
    .filter((row) => row.legacyFallbackUsed || row.invalidPersistedDartCount)
    .map((row) => ({
      turnId: row.id,
      roundNo: row.round_no,
      turnSequenceNo: row.turn_sequence_no,
      status: row.status,
      persistedDartCount: row.persisted_dart_count,
      activeDartRows: row.active_darts,
      canonicalDarts: row.canonicalDarts,
      invalidPersistedDartCount: row.invalidPersistedDartCount,
    }));
  if (legacyDartCountFallbacks.length > 0) {
    console.warn('MATCH legacy dart count fallback used.', {
      gameId,
      gamePlayerId,
      turns: legacyDartCountFallbacks,
    });
  }
  const countedTurns = resolvedTurns.filter((turn) => turn.ratingTurnKind !== 'ignored');
  const effectiveScore = countedTurns.reduce((sum, turn) => sum + turn.applied_score, 0);
  const rounds = countedTurns.reduce((max, turn) => Math.max(max, turn.round_no), 0);
  const turns = countedTurns.length;
  const bust = resolvedTurns.filter((turn) => turn.ratingTurnKind === 'bust').length;
  const checkout = resolvedTurns.some((turn) => turn.ratingTurnKind === 'checkout') ? 1 : 0;
  const row = await db.getFirstAsync<{
    totalScore: number;
    darts: number;
    bull: number;
    innerBull: number;
    outerBull: number;
    triple: number;
    double: number;
    miss: number;
    marks: number;
  }>(
    `SELECT COALESCE(SUM(d.score), 0) AS totalScore,
            COUNT(d.id) AS darts,
            SUM(CASE WHEN d.area IN ('outer_bull', 'inner_bull') THEN 1 ELSE 0 END) AS bull,
            SUM(CASE WHEN d.area = 'inner_bull' THEN 1 ELSE 0 END) AS innerBull,
            SUM(CASE WHEN d.area = 'outer_bull' THEN 1 ELSE 0 END) AS outerBull,
            SUM(CASE WHEN d.area = 'triple' THEN 1 ELSE 0 END) AS triple,
            SUM(CASE WHEN d.area = 'double' THEN 1 ELSE 0 END) AS double,
            SUM(CASE WHEN d.area = 'miss' THEN 1 ELSE 0 END) AS miss,
            COALESCE(SUM(d.cricket_marks), 0) AS marks
     FROM turns t
     LEFT JOIN darts d ON d.turn_id = t.id AND d.status = 'active'
     WHERE t.game_id = ? AND t.game_player_id = ?
       AND t.status NOT IN ('voided', 'invalid')`,
    gameId,
    gamePlayerId,
  );
  const zeroOneRating =
    game?.mode === 'zero_one'
      ? await getZeroOneRatingTotalsForGamePlayer(db, gameId, gamePlayerId)
      : { effectiveScore: 0, ratingDarts: 0, legacyDartCountFallbackUsed: false };
  const closed = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM cricket_number_states WHERE game_id = ? AND game_player_id = ? AND is_closed = 1`,
    gameId,
    gamePlayerId,
  );
  return {
    totalScore: row?.totalScore ?? 0,
    effectiveScore,
    rounds,
    turns,
    darts: canonicalDarts,
    bull: row?.bull ?? 0,
    innerBull: row?.innerBull ?? 0,
    outerBull: row?.outerBull ?? 0,
    triple: row?.triple ?? 0,
    double: row?.double ?? 0,
    miss: row?.miss ?? 0,
    bust,
    checkout,
    marks: row?.marks ?? 0,
    closed: closed?.count ?? 0,
    zeroOneRatingEffectiveScore: zeroOneRating.effectiveScore,
    zeroOneRatingDarts: zeroOneRating.ratingDarts,
    legacyDartCountFallbackUsed:
      legacyDartCountFallbacks.length > 0 || zeroOneRating.legacyDartCountFallbackUsed,
    legacyDartCountFallbacks,
    ppdMilli:
      game?.mode === 'zero_one'
        ? calculatePpdMilli(zeroOneRating.effectiveScore, zeroOneRating.ratingDarts)
        : null,
    threeDartAverageMilli:
      game?.mode === 'zero_one'
        ? calculateThreeDartAverageMilli(zeroOneRating.effectiveScore, zeroOneRating.ratingDarts)
        : null,
    mprMilli:
      game?.mode === 'cricket' && turns > 0 ? Math.round(((row?.marks ?? 0) * 1000) / turns) : null,
  };
}

type RatingTurnKind = 'normal' | 'bust' | 'checkout' | 'ignored';

type CanonicalTurnDartCount = {
  id: string;
  round_no: number;
  turn_sequence_no: number;
  status: MatchTurn['status'] | 'voided' | 'invalid';
  start_remaining_score: number | null;
  end_remaining_score: number | null;
  applied_score: number;
  is_bust: number;
  is_checkout: number;
  persisted_dart_count: number;
  active_darts: number;
  canonicalDarts: number;
  invalidPersistedDartCount: boolean;
  legacyFallbackUsed: boolean;
};

async function getCanonicalTurnDartCounts(
  db: GameDatabaseExecutor,
  gameId: string,
  gamePlayerId: string,
): Promise<CanonicalTurnDartCount[]> {
  const rows = await db.getAllAsync<
    Omit<
      CanonicalTurnDartCount,
      'canonicalDarts' | 'invalidPersistedDartCount' | 'legacyFallbackUsed'
    >
  >(
    `SELECT t.id, t.round_no, t.turn_sequence_no, t.status, t.start_remaining_score,
            t.end_remaining_score, t.applied_score, t.is_bust, t.is_checkout,
            t.dart_count AS persisted_dart_count, COUNT(d.id) AS active_darts
     FROM turns t
     LEFT JOIN darts d ON d.turn_id = t.id AND d.status = 'active'
     WHERE t.game_id = ? AND t.game_player_id = ?
     GROUP BY t.id
     ORDER BY t.turn_sequence_no`,
    gameId,
    gamePlayerId,
  );

  return rows.map((row) => {
    const invalidPersistedDartCount = row.persisted_dart_count < 0 || row.persisted_dart_count > 3;
    const validPersistedDartCount = invalidPersistedDartCount ? 0 : row.persisted_dart_count;
    const countableTurn = !['in_progress', 'voided', 'invalid'].includes(row.status);
    const canonicalDarts = countableTurn ? Math.max(validPersistedDartCount, row.active_darts) : 0;
    return {
      ...row,
      canonicalDarts,
      invalidPersistedDartCount,
      legacyFallbackUsed: countableTurn && validPersistedDartCount > row.active_darts,
    };
  });
}

function resolveRatingTurnKind(
  turn: Pick<CanonicalTurnDartCount, 'status' | 'is_bust' | 'is_checkout' | 'end_remaining_score'>,
  game: { mode: MatchGameMode; completion_reason: string | null } | null,
): RatingTurnKind {
  if (['in_progress', 'voided', 'invalid'].includes(turn.status)) {
    return 'ignored';
  }
  if (turn.status === 'bust' || turn.is_bust === 1) {
    return 'bust';
  }
  if (turn.status === 'checkout' || turn.is_checkout === 1) {
    return 'checkout';
  }
  if (turn.status === 'game_end') {
    if (
      game?.mode === 'zero_one' &&
      (turn.end_remaining_score === 0 || game.completion_reason === 'checkout')
    ) {
      return 'checkout';
    }
    if (game?.mode === 'cricket') {
      return 'normal';
    }
    return 'ignored';
  }
  return 'normal';
}

async function getZeroOneRatingTotalsForGamePlayer(
  db: GameDatabaseExecutor,
  gameId: string,
  gamePlayerId: string,
) {
  const game = await db.getFirstAsync<{
    mode: MatchGameMode;
    completion_reason: string | null;
  }>('SELECT mode, completion_reason FROM game_sessions WHERE id = ?', gameId);
  const rows = await getCanonicalTurnDartCounts(db, gameId, gamePlayerId);

  return rows.reduce(
    (sum, row) => {
      const ratingTurnKind = resolveRatingTurnKind(row, game);
      if (ratingTurnKind === 'ignored' || row.canonicalDarts === 0) {
        return sum;
      }
      const ratingDarts =
        ratingTurnKind === 'bust'
          ? row.canonicalDarts
          : ratingTurnKind === 'checkout'
            ? row.canonicalDarts
            : 3;
      return {
        effectiveScore: sum.effectiveScore + (ratingTurnKind === 'bust' ? 0 : row.applied_score),
        ratingDarts: sum.ratingDarts + ratingDarts,
        legacyDartCountFallbackUsed:
          sum.legacyDartCountFallbackUsed ||
          row.legacyFallbackUsed ||
          row.invalidPersistedDartCount,
      };
    },
    { effectiveScore: 0, ratingDarts: 0, legacyDartCountFallbackUsed: false },
  );
}

async function completeMatch(
  db: GameDatabaseExecutor,
  matchId: string,
  winnerPlayerId: string,
  loserPlayerId: string,
  manualWinner: boolean,
) {
  const now = new Date().toISOString();
  const players = await loadMatchPlayers(db, matchId);
  const reason = players.some(
    (player) => player.games_won === 1 && player.player_id === loserPlayerId,
  )
    ? 'two_one'
    : 'two_zero';
  await db.runAsync(
    `UPDATE matches
     SET status = 'completed', winner_player_id = ?, loser_player_id = ?,
         completion_reason = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
    winnerPlayerId,
    loserPlayerId,
    reason,
    now,
    now,
    matchId,
  );
  await db.runAsync(
    `UPDATE match_players SET result = 'win', updated_at = ? WHERE match_id = ? AND player_id = ?`,
    now,
    matchId,
    winnerPlayerId,
  );
  await db.runAsync(
    `UPDATE match_players SET result = 'loss', updated_at = ? WHERE match_id = ? AND player_id = ?`,
    now,
    matchId,
    loserPlayerId,
  );
  await insertMatchPlayerResults(db, matchId);
  await insertMatchRatingEvaluation(db, matchId, winnerPlayerId, loserPlayerId, manualWinner);
  await appendDomainEvent(db, 'match', matchId, 'match_completed', { matchId, winnerPlayerId });
}

async function insertMatchPlayerResults(db: GameDatabaseExecutor, matchId: string) {
  const players = await loadMatchPlayers(db, matchId);
  for (const player of players) {
    const aggregate = await getMatchPlayerAggregate(db, matchId, player.player_id);
    await db.runAsync(
      `INSERT OR REPLACE INTO match_player_results(
         match_id, player_id, result, games_won, games_lost, zero_one_game_count,
         zero_one_ppd_milli, zero_one_three_dart_average_milli, cricket_game_count,
         cricket_mpr_milli, total_darts, bull_count, triple_count, double_count,
         bust_count, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      matchId,
      player.player_id,
      player.result,
      player.games_won,
      2 - player.games_won,
      aggregate.zeroOneGameCount,
      aggregate.zeroOnePpdMilli,
      aggregate.zeroOneThreeDartAverageMilli,
      aggregate.cricketGameCount,
      aggregate.cricketMprMilli,
      aggregate.totalDarts,
      aggregate.bullCount,
      aggregate.tripleCount,
      aggregate.doubleCount,
      aggregate.bustCount,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
}

async function getMatchPlayerAggregate(
  db: GameDatabaseExecutor,
  matchId: string,
  playerId: string,
) {
  const rows = await db.getAllAsync<{
    mode: MatchGameMode;
    effective_score: number;
    darts_thrown: number;
    cricket_marks_total: number;
    turns_count: number;
    bull_count: number;
    triple_count: number;
    double_count: number;
    bust_count: number;
    extra_stats_json: string | null;
  }>(
    `SELECT g.mode, r.effective_score, r.darts_thrown, r.cricket_marks_total, r.turns_count,
            r.bull_count, r.triple_count, r.double_count, r.bust_count, r.extra_stats_json
     FROM game_player_results r
     JOIN game_sessions g ON g.id = r.game_id
     WHERE g.match_id = ? AND r.player_id = ?`,
    matchId,
    playerId,
  );
  const zeroOne = rows.filter((row) => row.mode === 'zero_one');
  const cricket = rows.filter((row) => row.mode === 'cricket');
  const zeroOneScore = zeroOne.reduce(
    (sum, row) => sum + getStoredZeroOneRatingEffectiveScore(row),
    0,
  );
  const zeroOneDarts = zeroOne.reduce((sum, row) => sum + getStoredZeroOneRatingDarts(row), 0);
  const cricketMarks = cricket.reduce((sum, row) => sum + row.cricket_marks_total, 0);
  const cricketTurns = cricket.reduce((sum, row) => sum + row.turns_count, 0);
  return {
    zeroOneGameCount: zeroOne.length,
    zeroOnePpdMilli: calculatePpdMilli(zeroOneScore, zeroOneDarts),
    zeroOneThreeDartAverageMilli: calculateThreeDartAverageMilli(zeroOneScore, zeroOneDarts),
    cricketGameCount: cricket.length,
    cricketMprMilli: cricketTurns > 0 ? Math.round((cricketMarks * 1000) / cricketTurns) : null,
    totalDarts: rows.reduce((sum, row) => sum + row.darts_thrown, 0),
    bullCount: rows.reduce((sum, row) => sum + row.bull_count, 0),
    tripleCount: rows.reduce((sum, row) => sum + row.triple_count, 0),
    doubleCount: rows.reduce((sum, row) => sum + row.double_count, 0),
    bustCount: rows.reduce((sum, row) => sum + row.bust_count, 0),
  };
}

type MatchPlayerAggregateStats = Awaited<ReturnType<typeof getMatchPlayerAggregate>>;

type CanonicalGamePlayerStats = Awaited<ReturnType<typeof getPlayerGameStats>> & {
  gameId: string;
  gameNo: MatchGameNo;
  mode: MatchGameMode;
};

async function getMatchPlayerCanonicalStats(
  db: GameDatabaseExecutor,
  matchId: string,
  playerId: string,
): Promise<{
  games: CanonicalGamePlayerStats[];
  aggregate: MatchPlayerAggregateStats;
}> {
  const games = await loadGameRows(db, matchId);
  const canonicalGames: CanonicalGamePlayerStats[] = [];

  for (const game of games) {
    const gamePlayer = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM game_players WHERE game_id = ? AND player_id = ? LIMIT 1`,
      game.id,
      playerId,
    );
    if (!gamePlayer) {
      continue;
    }
    canonicalGames.push({
      ...(await getPlayerGameStats(db, game.id, gamePlayer.id)),
      gameId: game.id,
      gameNo: game.match_game_no,
      mode: game.mode,
    });
  }

  const zeroOne = canonicalGames.filter((game) => game.mode === 'zero_one');
  const cricket = canonicalGames.filter((game) => game.mode === 'cricket');
  const zeroOneScore = zeroOne.reduce((sum, game) => sum + game.zeroOneRatingEffectiveScore, 0);
  const zeroOneDarts = zeroOne.reduce((sum, game) => sum + game.zeroOneRatingDarts, 0);
  const cricketMarks = cricket.reduce((sum, game) => sum + game.marks, 0);
  const cricketTurns = cricket.reduce((sum, game) => sum + game.turns, 0);

  return {
    games: canonicalGames,
    aggregate: {
      zeroOneGameCount: zeroOne.length,
      zeroOnePpdMilli: calculatePpdMilli(zeroOneScore, zeroOneDarts),
      zeroOneThreeDartAverageMilli: calculateThreeDartAverageMilli(zeroOneScore, zeroOneDarts),
      cricketGameCount: cricket.length,
      cricketMprMilli: cricketTurns > 0 ? Math.round((cricketMarks * 1000) / cricketTurns) : null,
      totalDarts: canonicalGames.reduce((sum, game) => sum + game.darts, 0),
      bullCount: canonicalGames.reduce((sum, game) => sum + game.bull, 0),
      tripleCount: canonicalGames.reduce((sum, game) => sum + game.triple, 0),
      doubleCount: canonicalGames.reduce((sum, game) => sum + game.double, 0),
      bustCount: canonicalGames.reduce((sum, game) => sum + game.bust, 0),
    },
  };
}

type GamePlayerResultRow = {
  effective_score: number;
  ppd_milli: number | null;
  three_dart_average_milli: number | null;
  mpr_milli: number | null;
  darts_thrown: number;
  rounds_count: number;
  checkout_flag: number;
  bust_count: number;
  cricket_marks_total: number;
  extra_stats_json: string | null;
};

async function getGamePlayerResult(
  db: GameDatabaseExecutor,
  gameId: string,
  playerId: string,
): Promise<GamePlayerResultRow | null> {
  return db.getFirstAsync<GamePlayerResultRow>(
    `SELECT effective_score, ppd_milli, three_dart_average_milli, mpr_milli,
            darts_thrown, rounds_count, checkout_flag, bust_count,
            cricket_marks_total, extra_stats_json
     FROM game_player_results
     WHERE game_id = ? AND player_id = ?
     LIMIT 1`,
    gameId,
    playerId,
  );
}

function gamePlayerResultMatchesCanonical(
  row: GamePlayerResultRow | null,
  canonical: CanonicalGamePlayerStats,
) {
  if (!row) return false;
  const extra = parseExtraStats(row.extra_stats_json);
  const zeroOneMatches =
    canonical.mode !== 'zero_one' ||
    (row.effective_score === canonical.effectiveScore &&
      row.ppd_milli === canonical.ppdMilli &&
      row.three_dart_average_milli === canonical.threeDartAverageMilli &&
      extra.zeroOneRatingEffectiveScore === canonical.zeroOneRatingEffectiveScore &&
      extra.zeroOneRatingDarts === canonical.zeroOneRatingDarts);
  const cricketMatches =
    canonical.mode !== 'cricket' ||
    (row.mpr_milli === canonical.mprMilli && row.cricket_marks_total === canonical.marks);
  const fallbackMatches =
    Boolean(extra.legacyDartCountFallbackUsed) === canonical.legacyDartCountFallbackUsed;

  return (
    zeroOneMatches &&
    cricketMatches &&
    fallbackMatches &&
    row.darts_thrown === canonical.darts &&
    row.rounds_count === canonical.rounds &&
    row.checkout_flag === canonical.checkout &&
    row.bust_count === canonical.bust
  );
}

type MatchPlayerResultRow = {
  zero_one_game_count: number;
  zero_one_ppd_milli: number | null;
  zero_one_three_dart_average_milli: number | null;
  cricket_game_count: number;
  cricket_mpr_milli: number | null;
  total_darts: number;
  bull_count: number;
  triple_count: number;
  double_count: number;
  bust_count: number;
};

type RatingEvaluationGameRow = {
  game_id: string;
  mode: MatchGameMode;
  game_no: MatchGameNo;
  ppd_milli: number | null;
  three_dart_average_milli: number | null;
  mpr_milli: number | null;
  darts_thrown: number;
  rounds_count: number;
  checkout_flag: number;
  bust_count: number;
  marks_total: number;
};

async function getMatchPlayerResult(
  db: GameDatabaseExecutor,
  matchId: string,
  playerId: string,
): Promise<MatchPlayerResultRow | null> {
  return db.getFirstAsync<MatchPlayerResultRow>(
    `SELECT zero_one_game_count, zero_one_ppd_milli, zero_one_three_dart_average_milli,
            cricket_game_count, cricket_mpr_milli, total_darts, bull_count,
            triple_count, double_count, bust_count
     FROM match_player_results
     WHERE match_id = ? AND player_id = ?
     LIMIT 1`,
    matchId,
    playerId,
  );
}

async function getRatingEvaluationGames(
  db: GameDatabaseExecutor,
  evaluationId: string,
): Promise<RatingEvaluationGameRow[]> {
  return db.getAllAsync<RatingEvaluationGameRow>(
    `SELECT game_id, mode, game_no, ppd_milli, three_dart_average_milli,
            mpr_milli, darts_thrown, rounds_count, checkout_flag,
            bust_count, marks_total
     FROM rating_evaluation_games
     WHERE evaluation_id = ?
     ORDER BY game_no ASC, game_id ASC`,
    evaluationId,
  );
}

function matchPlayerResultMatchesCanonical(
  row: MatchPlayerResultRow | null,
  canonical: MatchPlayerAggregateStats,
) {
  return (
    row !== null &&
    row.zero_one_game_count === canonical.zeroOneGameCount &&
    row.zero_one_ppd_milli === canonical.zeroOnePpdMilli &&
    row.zero_one_three_dart_average_milli === canonical.zeroOneThreeDartAverageMilli &&
    row.cricket_game_count === canonical.cricketGameCount &&
    row.cricket_mpr_milli === canonical.cricketMprMilli &&
    row.total_darts === canonical.totalDarts &&
    row.bull_count === canonical.bullCount &&
    row.triple_count === canonical.tripleCount &&
    row.double_count === canonical.doubleCount &&
    row.bust_count === canonical.bustCount
  );
}

function ratingEvaluationGamesMatchCanonical(
  rows: RatingEvaluationGameRow[],
  canonicalGames: CanonicalGamePlayerStats[],
) {
  if (rows.length !== canonicalGames.length) return false;
  return canonicalGames.every((canonical) => {
    const row = rows.find((entry) => entry.game_id === canonical.gameId);
    if (!row) return false;
    const zeroOneMatches =
      canonical.mode !== 'zero_one' ||
      (row.ppd_milli === canonical.ppdMilli &&
        row.three_dart_average_milli === canonical.threeDartAverageMilli &&
        row.mpr_milli === null &&
        row.marks_total === 0);
    const cricketMatches =
      canonical.mode !== 'cricket' ||
      (row.ppd_milli === null &&
        row.three_dart_average_milli === null &&
        row.mpr_milli === canonical.mprMilli &&
        row.marks_total === canonical.marks);

    return (
      zeroOneMatches &&
      cricketMatches &&
      row.mode === canonical.mode &&
      row.game_no === canonical.gameNo &&
      row.darts_thrown === canonical.darts &&
      row.rounds_count === canonical.rounds &&
      row.checkout_flag === canonical.checkout &&
      row.bust_count === canonical.bust
    );
  });
}

function calculatePpdMilli(effectiveScore: number, ratingDarts: number) {
  return ratingDarts > 0 ? Math.round((effectiveScore * 1000) / ratingDarts) : null;
}

function calculateThreeDartAverageMilli(effectiveScore: number, ratingDarts: number) {
  return ratingDarts > 0 ? Math.round((effectiveScore * 3 * 1000) / ratingDarts) : null;
}

function getStoredZeroOneRatingEffectiveScore(row: {
  effective_score: number;
  extra_stats_json: string | null;
}) {
  const extra = parseExtraStats(row.extra_stats_json);
  return typeof extra.zeroOneRatingEffectiveScore === 'number'
    ? extra.zeroOneRatingEffectiveScore
    : row.effective_score;
}

function getStoredZeroOneRatingDarts(row: {
  darts_thrown: number;
  extra_stats_json: string | null;
}) {
  const extra = parseExtraStats(row.extra_stats_json);
  return typeof extra.zeroOneRatingDarts === 'number' ? extra.zeroOneRatingDarts : row.darts_thrown;
}

function parseExtraStats(value: string | null): {
  zeroOneRatingEffectiveScore?: number;
  zeroOneRatingDarts?: number;
  legacyDartCountFallbackUsed?: boolean;
} {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as {
      zeroOneRatingEffectiveScore?: unknown;
      zeroOneRatingDarts?: unknown;
      legacyDartCountFallbackUsed?: unknown;
    };
    return {
      zeroOneRatingEffectiveScore:
        typeof parsed.zeroOneRatingEffectiveScore === 'number'
          ? parsed.zeroOneRatingEffectiveScore
          : undefined,
      zeroOneRatingDarts:
        typeof parsed.zeroOneRatingDarts === 'number' ? parsed.zeroOneRatingDarts : undefined,
      legacyDartCountFallbackUsed:
        typeof parsed.legacyDartCountFallbackUsed === 'boolean'
          ? parsed.legacyDartCountFallbackUsed
          : undefined,
    };
  } catch {
    return {};
  }
}

async function insertMatchRatingEvaluation(
  db: GameDatabaseExecutor,
  matchId: string,
  winnerPlayerId: string,
  loserPlayerId: string,
  manualWinner: boolean,
) {
  const owner = await db.getFirstAsync<{ id: string; account_id: string }>(
    `SELECT id, account_id FROM players
     WHERE id IN (?, ?) AND player_type = 'owner' AND account_id IS NOT NULL
     LIMIT 1`,
    winnerPlayerId,
    loserPlayerId,
  );
  if (!owner) return;
  const aggregate = await getMatchPlayerAggregate(db, matchId, owner.id);
  const evaluationId = createGameId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO rating_evaluations(
       id, account_id, player_id, source_type, source_match_id, source_game_id,
       source_revision, status, candidate_flag, match_result, zero_one_game_count,
       zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
       total_rounds, source_weight_milli, auto_detected_darts, adjusted_darts,
       fully_manual_darts, correction_count, input_payload_json, created_at
     )
     VALUES (?, ?, ?, 'match', ?, NULL, 1, 'pending', 1, ?, ?, ?, ?, ?, ?, 0, 1000, 0, 0, ?, 0, ?, ?)`,
    evaluationId,
    owner.account_id,
    owner.id,
    matchId,
    owner.id === winnerPlayerId ? 'win' : 'loss',
    aggregate.zeroOneGameCount,
    aggregate.zeroOnePpdMilli,
    aggregate.cricketGameCount,
    aggregate.cricketMprMilli,
    aggregate.totalDarts,
    aggregate.totalDarts,
    JSON.stringify({
      manualOutcomeAdjustment: manualWinner,
      outcomeDelta: manualWinner ? 0 : null,
    }),
    now,
  );
  const games = await loadGameRows(db, matchId);
  for (const game of games) {
    const stats = await getGamePlayerResult(db, game.id, owner.id);
    await db.runAsync(
      `INSERT OR IGNORE INTO rating_evaluation_games(
         evaluation_id, game_id, mode, game_no, ppd_milli, three_dart_average_milli,
         mpr_milli, darts_thrown, rounds_count, checkout_flag, bust_count, marks_total, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      evaluationId,
      game.id,
      game.mode,
      game.match_game_no,
      game.mode === 'zero_one' ? (stats?.ppd_milli ?? null) : null,
      game.mode === 'zero_one' ? (stats?.three_dart_average_milli ?? null) : null,
      game.mode === 'cricket' ? (stats?.mpr_milli ?? null) : null,
      stats?.darts_thrown ?? 0,
      stats?.rounds_count ?? 0,
      stats?.checkout_flag ?? 0,
      stats?.bust_count ?? 0,
      stats?.cricket_marks_total ?? 0,
      now,
    );
  }
  await db.runAsync(
    `INSERT INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key, payload_json,
       status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'rating_recalculate', 'match', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    createGameId(),
    matchId,
    `match:${matchId}:rating_recalculate`,
    JSON.stringify({ matchId, evaluationId }),
    now,
    now,
    now,
  );
  await insertCommonMatchOutbox(db, owner.account_id, matchId, now);
}

const MATCH_DIAGNOSTIC_TARGET_MATCH_ID = 'f5a5b1ac-6558-4470-a07f-d686a6135af8';
const MATCH_DIAGNOSTIC_TARGET_EXPECTED = {
  totalDarts: 18,
  ppdMilli: 55667,
  threeDartAverageMilli: 167000,
  mprMilli: 7333,
};

async function buildMatchDiagnosticReport(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchDiagnosticReport> {
  const generatedAt = new Date().toISOString();
  const match = await db.getFirstAsync<MatchDiagnosticRawRow>(
    'SELECT * FROM matches WHERE id = ? LIMIT 1',
    matchId,
  );
  const players = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT mp.*, p.player_type, p.account_id
     FROM match_players mp
     LEFT JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id = ?
     ORDER BY mp.slot_no ASC`,
    matchId,
  );
  const games = await loadDiagnosticGames(db, matchId);
  const gameSessions = await db.getAllAsync<MatchDiagnosticRawRow>(
    'SELECT * FROM game_sessions WHERE match_id = ? ORDER BY match_game_no ASC',
    matchId,
  );
  const gamePlayers = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT gp.*, g.match_game_no, g.mode
     FROM game_players gp
     JOIN game_sessions g ON g.id = gp.game_id
     WHERE g.match_id = ?
     ORDER BY g.match_game_no ASC, gp.turn_order ASC`,
    matchId,
  );
  const turns = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT t.*, g.match_game_no, g.mode, gp.player_id
     FROM turns t
     JOIN game_sessions g ON g.id = t.game_id
     JOIN game_players gp ON gp.id = t.game_player_id
     WHERE g.match_id = ?
     ORDER BY g.match_game_no ASC, t.turn_sequence_no ASC`,
    matchId,
  );
  const rawDarts = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT d.*, g.match_game_no, g.mode
     FROM darts d
     JOIN game_sessions g ON g.id = d.game_id
     WHERE g.match_id = ?
     ORDER BY g.match_game_no ASC, d.round_no ASC, d.turn_id ASC, d.dart_no ASC`,
    matchId,
  );
  const owner = players.find(
    (player) => player.player_type_snapshot === 'owner' || player.player_type === 'owner',
  );
  const ownerPlayerId = typeof owner?.player_id === 'string' ? owner.player_id : null;
  const canonical = ownerPlayerId
    ? await getMatchPlayerCanonicalStats(db, matchId, ownerPlayerId)
    : null;
  const ownerTurns = ownerPlayerId
    ? await loadOwnerDiagnosticTurns(db, matchId, ownerPlayerId)
    : [];
  const darts = await loadDiagnosticDarts(db, matchId);
  const saved = await loadDiagnosticSavedRows(db, matchId, ownerPlayerId);
  const summary = await buildMatchDiagnosticSummary({
    db,
    matchId,
    ownerPlayerId,
    ownerTurns,
    canonical,
    saved,
  });

  return {
    generatedAt,
    match,
    players,
    games,
    ownerTurns,
    darts,
    saved,
    raw: {
      gameSessions,
      gamePlayers,
      turns,
      darts: rawDarts,
    },
    summary,
    repairTarget: matchId === MATCH_DIAGNOSTIC_TARGET_MATCH_ID,
    repairEligible:
      Boolean(match) &&
      match?.status === 'completed' &&
      ownerPlayerId !== null &&
      summary.mismatches.length > 0,
    error: null,
  };
}

async function loadDiagnosticGames(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchDiagnosticGame[]> {
  const rows = await db.getAllAsync<{
    id: string;
    match_game_no: MatchGameNo;
    mode: MatchGameMode;
    status: string;
    completion_reason: string | null;
    winner_player_id: string | null;
    completed_at: string | null;
  }>(
    `SELECT id, match_game_no, mode, status, completion_reason, winner_player_id, completed_at
     FROM game_sessions
     WHERE match_id = ?
     ORDER BY match_game_no ASC`,
    matchId,
  );
  return rows.map((row) => ({
    gameId: row.id,
    gameNo: row.match_game_no,
    mode: row.mode,
    status: row.status,
    completionReason: row.completion_reason,
    winnerPlayerId: row.winner_player_id,
    completedAt: row.completed_at,
  }));
}

async function loadOwnerDiagnosticTurns(
  db: GameDatabaseExecutor,
  matchId: string,
  ownerPlayerId: string,
): Promise<MatchDiagnosticTurn[]> {
  const rows = await db.getAllAsync<{
    game_id: string;
    game_no: MatchGameNo;
    mode: MatchGameMode;
    completion_reason: string | null;
    turn_id: string;
    round_no: number;
    turn_sequence_no: number;
    status: MatchTurn['status'] | 'voided' | 'invalid';
    applied_score: number;
    raw_score: number;
    start_remaining_score: number | null;
    end_remaining_score: number | null;
    is_checkout: number;
    is_bust: number;
    persisted_dart_count: number;
    active_dart_count: number;
    voided_dart_count: number;
    invalid_dart_count: number;
  }>(
    `SELECT g.id AS game_id, g.match_game_no AS game_no, g.mode, g.completion_reason,
            t.id AS turn_id, t.round_no, t.turn_sequence_no, t.status,
            t.applied_score, t.raw_score, t.start_remaining_score, t.end_remaining_score,
            t.is_checkout, t.is_bust, t.dart_count AS persisted_dart_count,
            SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS active_dart_count,
            SUM(CASE WHEN d.status = 'voided' THEN 1 ELSE 0 END) AS voided_dart_count,
            SUM(CASE WHEN d.status = 'invalidated' THEN 1 ELSE 0 END) AS invalid_dart_count
     FROM turns t
     JOIN game_sessions g ON g.id = t.game_id
     JOIN game_players gp ON gp.id = t.game_player_id
     LEFT JOIN darts d ON d.turn_id = t.id
     WHERE g.match_id = ? AND gp.player_id = ?
     GROUP BY t.id
     ORDER BY g.match_game_no ASC, t.turn_sequence_no ASC`,
    matchId,
    ownerPlayerId,
  );

  return rows.map((row) => {
    const invalidPersistedDartCount = row.persisted_dart_count < 0 || row.persisted_dart_count > 3;
    const validPersistedDartCount = invalidPersistedDartCount ? 0 : row.persisted_dart_count;
    const countableTurn = !['in_progress', 'voided', 'invalid'].includes(row.status);
    const canonicalTotalDarts = countableTurn
      ? Math.max(validPersistedDartCount, row.active_dart_count)
      : 0;
    const resolvedRatingTurnKind = resolveRatingTurnKind(
      {
        status: row.status,
        is_bust: row.is_bust,
        is_checkout: row.is_checkout,
        end_remaining_score: row.end_remaining_score,
      },
      { mode: row.mode, completion_reason: row.completion_reason },
    );
    const canonicalRatingDarts =
      row.mode === 'zero_one' && resolvedRatingTurnKind !== 'ignored'
        ? resolvedRatingTurnKind === 'normal'
          ? 3
          : canonicalTotalDarts
        : canonicalTotalDarts;
    const canonicalEffectiveScore =
      resolvedRatingTurnKind === 'ignored' || resolvedRatingTurnKind === 'bust'
        ? 0
        : row.applied_score;

    return {
      gameNo: row.game_no,
      mode: row.mode,
      turnId: row.turn_id,
      roundNo: row.round_no,
      turnSequenceNo: row.turn_sequence_no,
      status: row.status,
      appliedScore: row.applied_score,
      rawScore: row.raw_score,
      startRemainingScore: row.start_remaining_score,
      endRemainingScore: row.end_remaining_score,
      isCheckout: row.is_checkout === 1,
      isBust: row.is_bust === 1,
      persistedDartCount: row.persisted_dart_count,
      activeDartCount: row.active_dart_count,
      voidedDartCount: row.voided_dart_count,
      invalidDartCount: row.invalid_dart_count,
      resolvedRatingTurnKind,
      canonicalRatingDarts,
      canonicalTotalDarts,
      canonicalEffectiveScore,
    };
  });
}

async function loadDiagnosticDarts(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchDiagnosticDart[]> {
  const rows = await db.getAllAsync<{
    turn_id: string;
    dart_no: number;
    area: string;
    segment_number: number | null;
    multiplier: number;
    score: number;
    cricket_marks: number;
    status: string;
    client_action_id: string | null;
  }>(
    `SELECT d.turn_id, d.dart_no, d.area, d.segment_number, d.multiplier,
            d.score, d.cricket_marks, d.status, d.client_action_id
     FROM darts d
     JOIN game_sessions g ON g.id = d.game_id
     WHERE g.match_id = ?
     ORDER BY g.match_game_no ASC, d.round_no ASC, d.turn_id ASC, d.dart_no ASC`,
    matchId,
  );
  return rows.map((row) => ({
    turnId: row.turn_id,
    dartNo: row.dart_no,
    area: row.area,
    segment: row.segment_number,
    multiplier: row.multiplier,
    score: row.score,
    cricketMarks: row.cricket_marks,
    status: row.status,
    clientActionId: row.client_action_id,
  }));
}

async function loadDiagnosticSavedRows(
  db: GameDatabaseExecutor,
  matchId: string,
  ownerPlayerId: string | null,
) {
  const gamePlayerResults = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT r.*, g.match_game_no, g.mode
     FROM game_player_results r
     JOIN game_sessions g ON g.id = r.game_id
     WHERE g.match_id = ?
     ORDER BY g.match_game_no ASC, r.player_id ASC`,
    matchId,
  );
  const matchPlayerResults = await db.getAllAsync<MatchDiagnosticRawRow>(
    'SELECT * FROM match_player_results WHERE match_id = ? ORDER BY player_id ASC',
    matchId,
  );
  const ratingEvaluations = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT * FROM rating_evaluations
     WHERE source_match_id = ?
     ORDER BY source_revision ASC, created_at ASC`,
    matchId,
  );
  const ratingEvaluationGames = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT rg.*
     FROM rating_evaluation_games rg
     JOIN rating_evaluations re ON re.id = rg.evaluation_id
     WHERE re.source_match_id = ?
     ORDER BY re.source_revision ASC, rg.game_no ASC, rg.game_id ASC`,
    matchId,
  );
  const ratingSnapshots = await db.getAllAsync<MatchDiagnosticRawRow>(
    `SELECT s.*
     FROM rating_snapshots s
     JOIN rating_evaluations re ON re.id = s.evaluation_id
     WHERE re.source_match_id = ?
     ORDER BY s.created_at ASC`,
    matchId,
  );
  const ratingProfiles = ownerPlayerId
    ? await db.getAllAsync<MatchDiagnosticRawRow>(
        'SELECT * FROM rating_profiles WHERE owner_player_id = ? ORDER BY updated_at DESC',
        ownerPlayerId,
      )
    : [];

  return {
    gamePlayerResults,
    matchPlayerResults,
    ratingEvaluations,
    ratingEvaluationGames,
    ratingSnapshots,
    ratingProfiles,
  };
}

async function buildMatchDiagnosticSummary({
  db,
  matchId,
  ownerPlayerId,
  ownerTurns,
  canonical,
  saved,
}: {
  db: GameDatabaseExecutor;
  matchId: string;
  ownerPlayerId: string | null;
  ownerTurns: MatchDiagnosticTurn[];
  canonical: Awaited<ReturnType<typeof getMatchPlayerCanonicalStats>> | null;
  saved: Awaited<ReturnType<typeof loadDiagnosticSavedRows>>;
}): Promise<MatchDiagnosticSummary> {
  const ownerGamePlayerIds = ownerPlayerId
    ? (
        await db.getAllAsync<{ id: string }>(
          `SELECT gp.id
           FROM game_players gp
           JOIN game_sessions g ON g.id = gp.game_id
           WHERE g.match_id = ? AND gp.player_id = ?
           ORDER BY g.match_game_no ASC`,
          matchId,
          ownerPlayerId,
        )
      ).map((row) => row.id)
    : [];
  const zeroOneRawEffectiveScore = canonical
    ? canonical.games
        .filter((game) => game.mode === 'zero_one')
        .reduce((sum, game) => sum + game.zeroOneRatingEffectiveScore, 0)
    : 0;
  const zeroOneCanonicalRatingDarts = canonical
    ? canonical.games
        .filter((game) => game.mode === 'zero_one')
        .reduce((sum, game) => sum + game.zeroOneRatingDarts, 0)
    : 0;
  const cricketMarks = canonical
    ? canonical.games
        .filter((game) => game.mode === 'cricket')
        .reduce((sum, game) => sum + game.marks, 0)
    : 0;
  const cricketTurns = canonical
    ? canonical.games
        .filter((game) => game.mode === 'cricket')
        .reduce((sum, game) => sum + game.turns, 0)
    : 0;
  const matchPlayerRow = ownerPlayerId
    ? await getMatchPlayerResult(db, matchId, ownerPlayerId)
    : null;
  const latestEvaluation = getLatestDiagnosticRow(saved.ratingEvaluations);
  const latestSnapshot = getLatestDiagnosticRow(
    saved.ratingSnapshots.filter((row) => row.invalidated_at === null),
  );
  const latestProfile = getLatestDiagnosticRow(saved.ratingProfiles);
  const mismatches = canonical
    ? await collectMatchDiagnosticMismatches(db, matchId, ownerPlayerId, canonical, saved)
    : ['owner_player'];
  const expectedMismatches = collectExpectedMismatches(matchId, {
    totalDarts: canonical?.aggregate.totalDarts ?? null,
    ppdMilli: canonical?.aggregate.zeroOnePpdMilli ?? null,
    threeDartAverageMilli: canonical?.aggregate.zeroOneThreeDartAverageMilli ?? null,
    mprMilli: canonical?.aggregate.cricketMprMilli ?? null,
  });

  return {
    matchId,
    ownerPlayerId,
    ownerGamePlayerIds,
    zeroOneRawEffectiveScore,
    zeroOneCanonicalRatingDarts,
    zeroOneCalculatedPpd:
      zeroOneCanonicalRatingDarts > 0
        ? zeroOneRawEffectiveScore / zeroOneCanonicalRatingDarts
        : null,
    zeroOneCalculatedThreeDartAverage:
      zeroOneCanonicalRatingDarts > 0
        ? (zeroOneRawEffectiveScore * 3) / zeroOneCanonicalRatingDarts
        : null,
    zeroOnePpdMilli: canonical?.aggregate.zeroOnePpdMilli ?? null,
    zeroOneThreeDartAverageMilli: canonical?.aggregate.zeroOneThreeDartAverageMilli ?? null,
    cricketMarks,
    cricketTurns,
    cricketMpr: cricketTurns > 0 ? cricketMarks / cricketTurns : null,
    cricketMprMilli: canonical?.aggregate.cricketMprMilli ?? null,
    ownerCanonicalTotalDarts: canonical?.aggregate.totalDarts ?? 0,
    savedPpdMilli: matchPlayerRow?.zero_one_ppd_milli ?? null,
    savedThreeDartAverageMilli: matchPlayerRow?.zero_one_three_dart_average_milli ?? null,
    savedMprMilli: matchPlayerRow?.cricket_mpr_milli ?? null,
    savedTotalDarts: matchPlayerRow?.total_darts ?? null,
    latestEvaluationId: typeof latestEvaluation?.id === 'string' ? latestEvaluation.id : null,
    latestSourceRevision:
      typeof latestEvaluation?.source_revision === 'number'
        ? latestEvaluation.source_revision
        : null,
    latestEvaluationStatus:
      typeof latestEvaluation?.status === 'string' ? latestEvaluation.status : null,
    latestSnapshotId: typeof latestSnapshot?.id === 'string' ? latestSnapshot.id : null,
    latestProfileSnapshotId: null,
    mismatches,
    expectedMismatches,
    causeFindings: collectDiagnosticCauseFindings({
      ownerPlayerId,
      ownerTurns,
      canonicalTotalDarts: canonical?.aggregate.totalDarts ?? 0,
      savedTotalDarts: matchPlayerRow?.total_darts ?? null,
      latestEvaluation,
      latestSnapshot,
      latestProfile,
    }),
  };
}

async function collectMatchDiagnosticMismatches(
  db: GameDatabaseExecutor,
  matchId: string,
  ownerPlayerId: string | null,
  canonical: Awaited<ReturnType<typeof getMatchPlayerCanonicalStats>>,
  saved: Awaited<ReturnType<typeof loadDiagnosticSavedRows>>,
) {
  if (!ownerPlayerId) return ['owner_player'];
  const mismatches = new Set<string>();
  for (const game of canonical.games) {
    if (
      !gamePlayerResultMatchesCanonical(
        await getGamePlayerResult(db, game.gameId, ownerPlayerId),
        game,
      )
    ) {
      mismatches.add('game_player_results');
    }
  }
  if (
    !matchPlayerResultMatchesCanonical(
      await getMatchPlayerResult(db, matchId, ownerPlayerId),
      canonical.aggregate,
    )
  ) {
    mismatches.add('match_player_results');
  }
  const latestEvaluation = getLatestDiagnosticRow(saved.ratingEvaluations);
  if (!latestEvaluation || latestEvaluation.status === 'invalidated') {
    mismatches.add('rating_evaluations');
  } else {
    if (
      latestEvaluation.zero_one_game_count !== canonical.aggregate.zeroOneGameCount ||
      latestEvaluation.zero_one_ppd_milli !== canonical.aggregate.zeroOnePpdMilli ||
      latestEvaluation.cricket_game_count !== canonical.aggregate.cricketGameCount ||
      latestEvaluation.cricket_mpr_milli !== canonical.aggregate.cricketMprMilli ||
      latestEvaluation.total_darts !== canonical.aggregate.totalDarts
    ) {
      mismatches.add('rating_evaluations');
    }
    const evaluationGames = await getRatingEvaluationGames(db, String(latestEvaluation.id));
    if (!ratingEvaluationGamesMatchCanonical(evaluationGames, canonical.games)) {
      mismatches.add('rating_evaluation_games');
    }
  }
  const latestSnapshot = getLatestDiagnosticRow(
    saved.ratingSnapshots.filter((row) => row.invalidated_at === null),
  );
  if (latestSnapshot && latestEvaluation && latestSnapshot.evaluation_id !== latestEvaluation.id) {
    mismatches.add('Snapshot');
  }
  const latestProfile = getLatestDiagnosticRow(saved.ratingProfiles);
  if (
    latestSnapshot &&
    latestProfile &&
    !ratingProfileMatchesSnapshot(latestProfile, latestSnapshot)
  ) {
    mismatches.add('Profile');
  }
  return Array.from(mismatches);
}

function ratingProfileMatchesSnapshot(
  profile: MatchDiagnosticRawRow,
  snapshot: MatchDiagnosticRawRow,
) {
  return (
    profile.measurement_status === snapshot.measurement_status &&
    profile.rating_tenths === snapshot.rating_tenths &&
    profile.precise_rating_milli === snapshot.precise_rating_milli &&
    profile.confidence_bp === snapshot.confidence_bp &&
    profile.eligible_match_count === snapshot.evaluated_match_count &&
    profile.eligible_standalone_zero_one_count === snapshot.evaluated_standalone_zero_one_count &&
    profile.eligible_standalone_cricket_count === snapshot.evaluated_standalone_cricket_count &&
    profile.zero_one_index_milli === snapshot.zero_one_index_milli &&
    profile.cricket_index_milli === snapshot.cricket_index_milli &&
    profile.match_index_milli === snapshot.match_index_milli
  );
}

function collectExpectedMismatches(
  matchId: string,
  values: {
    totalDarts: number | null;
    ppdMilli: number | null;
    threeDartAverageMilli: number | null;
    mprMilli: number | null;
  },
) {
  if (matchId !== MATCH_DIAGNOSTIC_TARGET_MATCH_ID) return [];
  const mismatches: string[] = [];
  if (values.totalDarts !== MATCH_DIAGNOSTIC_TARGET_EXPECTED.totalDarts) {
    mismatches.push('OWNER totalDarts');
  }
  if (values.ppdMilli !== MATCH_DIAGNOSTIC_TARGET_EXPECTED.ppdMilli) {
    mismatches.push('PPD milli');
  }
  if (values.threeDartAverageMilli !== MATCH_DIAGNOSTIC_TARGET_EXPECTED.threeDartAverageMilli) {
    mismatches.push('3DA milli');
  }
  if (values.mprMilli !== MATCH_DIAGNOSTIC_TARGET_EXPECTED.mprMilli) {
    mismatches.push('MPR milli');
  }
  return mismatches;
}

function collectDiagnosticCauseFindings({
  ownerPlayerId,
  ownerTurns,
  canonicalTotalDarts,
  savedTotalDarts,
  latestEvaluation,
  latestSnapshot,
  latestProfile,
}: {
  ownerPlayerId: string | null;
  ownerTurns: MatchDiagnosticTurn[];
  canonicalTotalDarts: number;
  savedTotalDarts: number | null;
  latestEvaluation: MatchDiagnosticRawRow | null;
  latestSnapshot: MatchDiagnosticRawRow | null;
  latestProfile: MatchDiagnosticRawRow | null;
}) {
  const findings: string[] = [];
  if (!ownerPlayerId) findings.push('OWNER Playerを特定できません。');
  const persistedTotal = ownerTurns.reduce((sum, turn) => sum + turn.persistedDartCount, 0);
  const activeTotal = ownerTurns.reduce((sum, turn) => sum + turn.activeDartCount, 0);
  findings.push(`turns.dart_count合計=${persistedTotal}`);
  findings.push(`active DART行数合計=${activeTotal}`);
  findings.push(`canonical total darts=${canonicalTotalDarts}`);
  if (savedTotalDarts !== null) findings.push(`保存済みtotalDarts=${savedTotalDarts}`);
  const gameEndTurns = ownerTurns.filter((turn) => turn.status === 'game_end');
  findings.push(`OWNER game_end TURN数=${gameEndTurns.length}`);
  for (const turn of gameEndTurns) {
    findings.push(
      `game_end ${turn.turnId}: kind=${turn.resolvedRatingTurnKind}, persisted=${turn.persistedDartCount}, active=${turn.activeDartCount}, canonical=${turn.canonicalTotalDarts}, endRemaining=${turn.endRemainingScore}`,
    );
  }
  if (latestEvaluation) {
    findings.push(
      `最新Evaluation revision=${latestEvaluation.source_revision}, status=${latestEvaluation.status}, totalDarts=${latestEvaluation.total_darts}`,
    );
  }
  if (latestSnapshot) {
    findings.push(`最新Snapshot=${latestSnapshot.id}, evaluation=${latestSnapshot.evaluation_id}`);
  }
  if (latestProfile) {
    findings.push(
      `Profile rating=${latestProfile.rating_tenths}, confidence=${latestProfile.confidence_bp}, eligibleMatch=${latestProfile.eligible_match_count}`,
    );
  }
  return findings;
}

function getLatestDiagnosticRow(rows: MatchDiagnosticRawRow[]) {
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

async function ensureMatchRatingEvaluationCurrent(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchRepairResult> {
  const beforeReport = await buildMatchDiagnosticReport(db, matchId);
  const match = await loadMatchRow(db, matchId);
  if (match.status !== 'completed' || !match.winner_player_id || !match.loser_player_id) {
    const afterReport = await buildMatchDiagnosticReport(db, matchId);
    return {
      repaired: false,
      evaluationId: null,
      recalculationRequired: false,
      before: beforeReport.summary,
      after: afterReport.summary,
      mismatchesBefore: beforeReport.summary.mismatches,
      mismatchesAfter: afterReport.summary.mismatches,
      error: null,
    };
  }

  const owner = await db.getFirstAsync<{ id: string; account_id: string }>(
    `SELECT id, account_id FROM players
     WHERE id IN (?, ?) AND player_type = 'owner' AND account_id IS NOT NULL
     LIMIT 1`,
    match.winner_player_id,
    match.loser_player_id,
  );
  if (!owner) {
    const afterReport = await buildMatchDiagnosticReport(db, matchId);
    return {
      repaired: false,
      evaluationId: null,
      recalculationRequired: false,
      before: beforeReport.summary,
      after: afterReport.summary,
      mismatchesBefore: beforeReport.summary.mismatches,
      mismatchesAfter: afterReport.summary.mismatches,
      error: null,
    };
  }

  const canonical = await getMatchPlayerCanonicalStats(db, matchId, owner.id);
  const gameRowsCurrent = (
    await Promise.all(
      canonical.games.map(async (game) =>
        gamePlayerResultMatchesCanonical(
          await getGamePlayerResult(db, game.gameId, owner.id),
          game,
        ),
      ),
    )
  ).every(Boolean);
  const matchRowCurrent = matchPlayerResultMatchesCanonical(
    await getMatchPlayerResult(db, matchId, owner.id),
    canonical.aggregate,
  );

  const games = await loadGameRows(db, matchId);
  for (const game of games.filter((entry) => entry.status === 'completed')) {
    await insertGamePlayerResults(db, game.id, game.completion_reason ?? 'completed');
  }
  await insertMatchPlayerResults(db, matchId);

  const latest = await db.getFirstAsync<{
    id: string;
    source_revision: number;
    status: string;
    candidate_flag: number;
    match_result: 'win' | 'loss' | null;
    zero_one_game_count: number;
    zero_one_ppd_milli: number | null;
    cricket_game_count: number;
    cricket_mpr_milli: number | null;
    total_darts: number;
    source_weight_milli: number;
    input_payload_json: string;
  }>(
    `SELECT id, source_revision, status, candidate_flag, match_result, zero_one_game_count,
            zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
            source_weight_milli, input_payload_json
     FROM rating_evaluations
     WHERE source_match_id = ? AND player_id = ?
     ORDER BY source_revision DESC
     LIMIT 1`,
    matchId,
    owner.id,
  );
  if (!latest) {
    const afterReport = await buildMatchDiagnosticReport(db, matchId);
    return {
      repaired: false,
      evaluationId: null,
      recalculationRequired: false,
      before: beforeReport.summary,
      after: afterReport.summary,
      mismatchesBefore: beforeReport.summary.mismatches,
      mismatchesAfter: afterReport.summary.mismatches,
      error: null,
    };
  }

  const evaluationMatchesCanonical =
    latest.status !== 'invalidated' &&
    latest.zero_one_game_count === canonical.aggregate.zeroOneGameCount &&
    latest.zero_one_ppd_milli === canonical.aggregate.zeroOnePpdMilli &&
    latest.cricket_game_count === canonical.aggregate.cricketGameCount &&
    latest.cricket_mpr_milli === canonical.aggregate.cricketMprMilli &&
    latest.total_darts === canonical.aggregate.totalDarts;
  const evaluationGamesMatch = ratingEvaluationGamesMatchCanonical(
    await getRatingEvaluationGames(db, latest.id),
    canonical.games,
  );
  const rowsWereAlreadyCurrent = gameRowsCurrent && matchRowCurrent;
  if (rowsWereAlreadyCurrent && evaluationMatchesCanonical && evaluationGamesMatch) {
    const afterReport = await buildMatchDiagnosticReport(db, matchId);
    return {
      repaired: false,
      evaluationId: latest.id,
      recalculationRequired: false,
      before: beforeReport.summary,
      after: afterReport.summary,
      mismatchesBefore: beforeReport.summary.mismatches,
      mismatchesAfter: afterReport.summary.mismatches,
      error: null,
    };
  }
  if (evaluationMatchesCanonical && evaluationGamesMatch) {
    const afterReport = await buildMatchDiagnosticReport(db, matchId);
    return {
      repaired: true,
      evaluationId: latest.id,
      recalculationRequired: false,
      before: beforeReport.summary,
      after: afterReport.summary,
      mismatchesBefore: beforeReport.summary.mismatches,
      mismatchesAfter: afterReport.summary.mismatches,
      error: null,
    };
  }

  const evaluationId = createGameId();
  const now = new Date().toISOString();
  const sourceRevision = latest.source_revision + 1;
  await db.runAsync(
    `INSERT INTO rating_evaluations(
       id, account_id, player_id, source_type, source_match_id, source_game_id,
       source_revision, status, candidate_flag, match_result, zero_one_game_count,
       zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
       total_rounds, source_weight_milli, auto_detected_darts, adjusted_darts,
       fully_manual_darts, correction_count, input_payload_json, created_at
     )
     VALUES (?, ?, ?, 'match', ?, NULL, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?, 0, ?, ?)`,
    evaluationId,
    owner.account_id,
    owner.id,
    matchId,
    sourceRevision,
    latest.candidate_flag,
    latest.match_result,
    canonical.aggregate.zeroOneGameCount,
    canonical.aggregate.zeroOnePpdMilli,
    canonical.aggregate.cricketGameCount,
    canonical.aggregate.cricketMprMilli,
    canonical.aggregate.totalDarts,
    latest.source_weight_milli,
    canonical.aggregate.totalDarts,
    latest.input_payload_json,
    now,
  );

  for (const game of canonical.games) {
    await db.runAsync(
      `INSERT OR IGNORE INTO rating_evaluation_games(
         evaluation_id, game_id, mode, game_no, ppd_milli, three_dart_average_milli,
         mpr_milli, darts_thrown, rounds_count, checkout_flag, bust_count, marks_total, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      evaluationId,
      game.gameId,
      game.mode,
      game.gameNo,
      game.mode === 'zero_one' ? game.ppdMilli : null,
      game.mode === 'zero_one' ? game.threeDartAverageMilli : null,
      game.mode === 'cricket' ? game.mprMilli : null,
      game.darts,
      game.rounds,
      game.checkout,
      game.bust,
      game.mode === 'cricket' ? game.marks : 0,
      now,
    );
  }

  await db.runAsync(
    `INSERT INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key, payload_json,
       status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'rating_recalculate', 'match', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    createGameId(),
    matchId,
    `match:${matchId}:rating_recalculate:${sourceRevision}`,
    JSON.stringify({ matchId, evaluationId, sourceRevision }),
    now,
    now,
    now,
  );

  const afterReport = await buildMatchDiagnosticReport(db, matchId);
  return {
    repaired: true,
    evaluationId,
    recalculationRequired: true,
    before: beforeReport.summary,
    after: afterReport.summary,
    mismatchesBefore: beforeReport.summary.mismatches,
    mismatchesAfter: afterReport.summary.mismatches,
    error: null,
  };
}

async function insertCommonMatchOutbox(
  db: GameDatabaseExecutor,
  accountId: string,
  matchId: string,
  now: string,
) {
  const eventId = createGameId();
  await db.runAsync(
    `INSERT OR IGNORE INTO common_events(
       event_id, event_type, event_version, account_id, source_app, source_record_id,
       occurred_at, created_at, payload_json
     )
     VALUES (?, 'match_completed', 1, ?, 'darts_app', ?, ?, ?, ?)`,
    eventId,
    accountId,
    matchId,
    now,
    now,
    JSON.stringify({ match_id: matchId }),
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO common_outbox(
       outbox_id, event_id, sync_status, retry_count, last_error, created_at, updated_at
     )
     VALUES (?, ?, 'local_only', 0, NULL, ?, ?)`,
    createGameId(),
    eventId,
    now,
    now,
  );
}

async function buildMatchResult(
  db: GameDatabaseExecutor,
  matchId: string,
): Promise<MatchState['result']> {
  const players = await loadMatchPlayers(db, matchId);
  const gameIds = (await loadGameRows(db, matchId)).map((game) => game.id);
  const ownerEval = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM rating_evaluations WHERE source_match_id = ? LIMIT 1`,
    matchId,
  );
  const common = await db.getFirstAsync<{ sync_status: 'local_only' }>(
    `SELECT o.sync_status
     FROM common_outbox o
     JOIN common_events e ON e.event_id = o.event_id
     WHERE e.source_record_id = ? AND e.event_type = 'match_completed'
     LIMIT 1`,
    matchId,
  );
  const aggregate = await getMatchPlayerAggregate(db, matchId, players[0]?.player_id ?? '');
  return {
    gamesWon: Object.fromEntries(players.map((player) => [player.player_id, player.games_won])),
    gameIds,
    zeroOnePpdMilli: aggregate.zeroOnePpdMilli,
    zeroOneThreeDartAverageMilli: aggregate.zeroOneThreeDartAverageMilli,
    cricketMprMilli: aggregate.cricketMprMilli,
    totalDarts: aggregate.totalDarts,
    totalRounds: 0,
    bullCount: aggregate.bullCount,
    tripleCount: aggregate.tripleCount,
    doubleCount: aggregate.doubleCount,
    bustCount: aggregate.bustCount,
    manualWinner: false,
    ratingCandidate: Boolean(ownerEval),
    commonOutboxStatus: common?.sync_status ?? null,
  };
}

async function appendDomainEvent(
  db: GameDatabaseExecutor,
  scopeType: 'match' | 'game',
  scopeId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const row = await db.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next
     FROM domain_events
     WHERE scope_type = ? AND scope_id = ?`,
    scopeType,
    scopeId,
  );
  await db.runAsync(
    `INSERT INTO domain_events(
       id, scope_type, scope_id, match_id, game_id, sequence_no, event_type, payload_json, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createGameId(),
    scopeType,
    scopeId,
    scopeType === 'match' ? scopeId : null,
    scopeType === 'game' ? scopeId : null,
    row?.next ?? 1,
    eventType,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

function getCricketTarget(
  input: Pick<MatchDartInput, 'area' | 'segmentNumber'>,
): CricketTarget | null {
  if (input.area === 'outer_bull' || input.area === 'inner_bull') return 'BULL';
  if (
    (input.area === 'single' || input.area === 'double' || input.area === 'triple') &&
    input.segmentNumber !== null &&
    input.segmentNumber >= 15 &&
    input.segmentNumber <= 20
  ) {
    return String(input.segmentNumber) as CricketTarget;
  }
  return null;
}

function getTargetPointValue(target: CricketTarget): number {
  return target === 'BULL' ? 25 : Number(target);
}

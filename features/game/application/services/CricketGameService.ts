import { createGameId } from '../../domain/ids';
import {
  calculateCricketDart,
  CRICKET_MAX_ROUNDS,
  CRICKET_TARGETS,
  evaluateCricketProgress,
  isNaturalCricketFinish,
  summarizeCricketGame,
} from '../../domain/cricket';
import type {
  CricketDart,
  CricketDartInput,
  CricketGameState,
  CricketResult,
  CricketStartInput,
  CricketSummary,
  CricketTurn,
} from '../../domain/cricket';
import type { BullRule } from '../../domain/types';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
} from '../../infrastructure/sqlite/types';
import { StandaloneRatingCandidateService } from './StandaloneRatingCandidateService';
import type { CricketGameServicePort, CricketLastSettings } from './CricketGameServicePort';

export class CricketActiveGameExistsError extends Error {
  constructor(readonly gameId: string) {
    super('An active game already exists.');
    this.name = 'CricketActiveGameExistsError';
  }
}

export class CricketGameService implements CricketGameServicePort {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLastSettings(): Promise<CricketLastSettings> {
    const row = await this.db.getFirstAsync<{ bull_rule: BullRule }>(
      `SELECT bull_rule
       FROM game_sessions
       WHERE mode = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      'cricket',
    );
    return { bullRule: row?.bull_rule ?? 'fat_bull' };
  }

  async getActiveGame(): Promise<CricketGameState | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status IN (?, ?) AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      'cricket',
      'in_progress',
      'paused',
    );
    return row ? this.loadGame(row.id) : null;
  }

  async listRecentResults(limit = 5): Promise<CricketGameState[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status = ? AND deleted_at IS NULL
       ORDER BY completed_at DESC, updated_at DESC
       LIMIT ?`,
      'cricket',
      'completed',
      limit,
    );
    return Promise.all(rows.map((row) => this.loadGame(row.id)));
  }

  async startGame(input: CricketStartInput): Promise<CricketGameState> {
    let gameId: string | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const active = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM game_sessions
         WHERE status IN (?, ?) AND deleted_at IS NULL
         LIMIT 1`,
        'in_progress',
        'paused',
      );

      if (active) {
        throw new CricketActiveGameExistsError(active.id);
      }

      const owner = await getOrCreateOwner(transaction, input.ownerName ?? 'PLAYER 1');
      const now = new Date().toISOString();
      const ratingDecision = await new StandaloneRatingCandidateService(
        transaction,
      ).buildGameStartDecision({
        mode: 'cricket',
        ownerPlayerId: owner.id,
        gameStartedAt: now,
      });
      gameId = createGameId();
      const gamePlayerId = createGameId();
      const roundId = createGameId();
      const turnId = createGameId();

      await transaction.runAsync(
        `INSERT INTO game_sessions(
           id, mode, status, max_rounds, bull_rule, out_rule, zero_one_start_score,
           player_count, current_round_no, current_turn_sequence_no, current_player_id,
           rating_candidate, config_json, row_version, started_at, created_at, updated_at
         )
         VALUES (?, 'cricket', 'in_progress', ?, ?, NULL, NULL, 1, 1, 1, ?, ?, ?, 0, ?, ?, ?)`,
        gameId,
        CRICKET_MAX_ROUNDS,
        input.bullRule,
        owner.id,
        ratingDecision.ratingCandidate,
        JSON.stringify({
          version: 2,
          rating: ratingDecision.configJsonPatch.rating,
        }),
        now,
        now,
        now,
      );

      await transaction.runAsync(
        `INSERT INTO game_players(
           id, game_id, player_id, slot_no, turn_order, display_name_snapshot,
           player_type_snapshot, starting_score, current_remaining_score, current_total_score,
           current_cricket_score, darts_thrown, turns_confirmed, is_winner, result,
           created_at, updated_at
         )
         VALUES (?, ?, ?, 1, 1, ?, ?, NULL, NULL, 0, 0, 0, 0, 0, 'pending', ?, ?)`,
        gamePlayerId,
        gameId,
        owner.id,
        owner.display_name,
        owner.player_type,
        now,
        now,
      );

      await transaction.runAsync(
        `INSERT INTO rounds(id, game_id, round_no, status, started_at, created_at, updated_at)
         VALUES (?, ?, 1, 'in_progress', ?, ?, ?)`,
        roundId,
        gameId,
        now,
        now,
        now,
      );

      await transaction.runAsync(
        `INSERT INTO turns(
           id, game_id, round_id, game_player_id, turn_sequence_no, round_no,
           player_turn_order, status, started_at, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 1, 1, 1, 'in_progress', ?, ?, ?)`,
        turnId,
        gameId,
        roundId,
        gamePlayerId,
        now,
        now,
        now,
      );

      for (const target of CRICKET_TARGETS) {
        await transaction.runAsync(
          `INSERT INTO cricket_number_states(
             game_id, game_player_id, target, marks_total, is_closed,
             closed_at_turn_id, closed_at_round_no, points_scored, updated_at
           )
           VALUES (?, ?, ?, 0, 0, NULL, NULL, 0, ?)`,
          gameId,
          gamePlayerId,
          target,
          now,
        );
      }

      await appendDomainEvent(transaction, gameId, 'cricket_game_started', {
        bullRule: input.bullRule,
      });
    });

    if (!gameId) {
      throw new Error('CRICKET game was not created.');
    }
    return this.loadGame(gameId);
  }

  async loadGame(gameId: string): Promise<CricketGameState> {
    const row = await this.db.getFirstAsync<GameRow>(
      `SELECT
         g.id, g.status, g.bull_rule, g.current_round_no, g.current_turn_sequence_no,
         gp.display_name_snapshot, gp.current_cricket_score
       FROM game_sessions g
       JOIN game_players gp ON gp.game_id = g.id
       WHERE g.id = ? AND g.mode = ? AND g.deleted_at IS NULL
       LIMIT 1`,
      gameId,
      'cricket',
    );

    if (!row) {
      throw new Error('CRICKET game was not found.');
    }

    const turns = await loadTurns(this.db, gameId);
    const currentTurn =
      turns.find((turn) => turn.turnSequenceNo === row.current_turn_sequence_no) ?? null;
    const progress = evaluateCricketProgress(turns);
    const result = await loadResult(this.db, gameId);
    const currentTurnStats = currentTurn ? progress.turnStats.get(currentTurn.id) : null;
    const dartsThrown = turns
      .flatMap((turn) => turn.darts)
      .filter((dart) => dart.status === 'active').length;
    const closedTargetCount = progress.targetStates.filter((state) => state.isClosed).length;

    return {
      gameId: row.id,
      status: row.status,
      bullRule: row.bull_rule,
      playerName: row.display_name_snapshot,
      currentRoundNo: row.current_round_no,
      currentTurnId: currentTurn?.id ?? null,
      currentTurnMarks:
        currentTurn?.status === 'in_progress' ? (currentTurnStats?.marksTotal ?? 0) : 0,
      currentTurnPoints:
        currentTurn?.status === 'in_progress' ? (currentTurnStats?.pointsScored ?? 0) : 0,
      currentCricketScore: progress.currentScore,
      closedTargetCount,
      allClosedZeroScore:
        closedTargetCount === CRICKET_TARGETS.length && progress.currentScore === 0,
      mprMilli:
        turns.length === 0
          ? 0
          : Math.round(
              (turns
                .flatMap((turn) => turn.darts)
                .filter((dart) => dart.status === 'active')
                .reduce((sum, dart) => sum + dart.cricketMarks, 0) *
                1000) /
                turns.length,
            ),
      dartsThrown,
      turns,
      targetStates: progress.targetStates,
      currentTurn,
      result,
    };
  }

  async recordDart(gameId: string, input: CricketDartInput): Promise<CricketGameState> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId);
      const existing = input.clientActionId
        ? await transaction.getFirstAsync<{ id: string }>(
            `SELECT id FROM darts WHERE client_action_id = ? LIMIT 1`,
            input.clientActionId,
          )
        : null;
      if (existing) {
        return;
      }

      const activeCount = await countActiveDarts(transaction, context.turnId);
      if (activeCount >= 3) {
        throw new Error('This CRICKET turn already has three darts.');
      }

      const { multiplier, score, cricketMarks } = calculateCricketDart(input, context.bullRule);
      const dartNo = activeCount + 1;
      const now = new Date().toISOString();
      const reusable = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM darts
         WHERE turn_id = ? AND dart_no = ? AND status = ?
         LIMIT 1`,
        context.turnId,
        dartNo,
        'voided',
      );

      const dartId = reusable?.id ?? createGameId();
      const clientActionId = input.clientActionId ?? `${gameId}:${now}:${dartNo}`;
      if (reusable) {
        await transaction.runAsync(
          `UPDATE darts
           SET area = ?, segment_number = ?, multiplier = ?, score = ?, cricket_marks = ?,
               input_source = ?, status = 'active', correction_count = correction_count + 1,
               client_action_id = ?, updated_at = ?
           WHERE id = ?`,
          input.area,
          input.segmentNumber,
          multiplier,
          score,
          cricketMarks,
          input.inputSource ?? 'manual_segment',
          clientActionId,
          now,
          dartId,
        );
      } else {
        await transaction.runAsync(
          `INSERT INTO darts(
             id, game_id, turn_id, game_player_id, round_no, dart_no,
             segment_number, area, multiplier, score, cricket_marks, input_source, status,
             is_rating_eligible, correction_count, client_action_id, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, ?)`,
          dartId,
          gameId,
          context.turnId,
          context.gamePlayerId,
          context.roundNo,
          dartNo,
          input.segmentNumber,
          input.area,
          multiplier,
          score,
          cricketMarks,
          input.inputSource ?? 'manual_segment',
          context.ratingCandidate,
          clientActionId,
          now,
          now,
        );
      }

      const progress = await applyCricketProgress(transaction, context, 'in_progress', now);
      await appendDomainEvent(transaction, gameId, 'cricket_dart_recorded', { dartId });

      if (isNaturalCricketFinish(progress.targetStates)) {
        await applyCricketProgress(transaction, context, 'game_end', now);
        await completeGame(transaction, context, 'all_closed_with_score', null, now);
      }
    });

    return this.loadGame(gameId);
  }

  async undoDart(gameId: string): Promise<CricketGameState> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId);
      const dart = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM darts
         WHERE turn_id = ? AND status = ?
         ORDER BY dart_no DESC
         LIMIT 1`,
        context.turnId,
        'active',
      );

      if (!dart) {
        throw new Error('There is no dart to undo.');
      }

      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE darts SET status = 'voided', updated_at = ? WHERE id = ?`,
        now,
        dart.id,
      );
      await applyCricketProgress(transaction, context, 'in_progress', now);
      await appendDomainEvent(transaction, gameId, 'cricket_dart_undone', { dartId: dart.id });
    });

    return this.loadGame(gameId);
  }

  async redoDart(gameId: string, dartId: string): Promise<CricketGameState> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId);
      const activeCount = await countActiveDarts(transaction, context.turnId);
      const dart = await transaction.getFirstAsync<{ id: string; dart_no: number }>(
        `SELECT id, dart_no
         FROM darts
         WHERE id = ? AND game_id = ? AND turn_id = ? AND status = ?
         LIMIT 1`,
        dartId,
        gameId,
        context.turnId,
        'voided',
      );

      if (!dart || dart.dart_no !== activeCount + 1 || activeCount >= 3) {
        return;
      }

      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE darts SET status = 'active', updated_at = ? WHERE id = ?`,
        now,
        dart.id,
      );
      const progress = await applyCricketProgress(transaction, context, 'in_progress', now);
      await appendDomainEvent(transaction, gameId, 'cricket_dart_redone', { dartId: dart.id });

      if (isNaturalCricketFinish(progress.targetStates)) {
        await applyCricketProgress(transaction, context, 'game_end', now);
        await completeGame(transaction, context, 'all_closed_with_score', null, now);
      }
    });

    return this.loadGame(gameId);
  }

  async confirmTurn(
    gameId: string,
    input: { machineType?: string | null } = {},
  ): Promise<CricketGameState> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId);
      const activeCount = await countActiveDarts(transaction, context.turnId);
      if (activeCount === 0) {
        throw new Error('At least one dart is required to confirm a CRICKET turn.');
      }

      const now = new Date().toISOString();
      const progress = await applyCricketProgress(transaction, context, 'confirmed', now);
      await appendDomainEvent(transaction, gameId, 'cricket_turn_confirmed', {
        roundNo: context.roundNo,
      });

      if (isNaturalCricketFinish(progress.targetStates)) {
        await completeGame(
          transaction,
          context,
          'all_closed_with_score',
          input.machineType ?? null,
          now,
        );
        return;
      }

      if (context.roundNo >= CRICKET_MAX_ROUNDS) {
        await completeGame(transaction, context, 'round_limit', input.machineType ?? null, now);
        return;
      }

      await createNextRoundAndTurn(transaction, context, now);
    });

    return this.loadGame(gameId);
  }

  async pauseGame(gameId: string): Promise<CricketGameState> {
    await this.updateGameStatus(gameId, 'paused');
    return this.loadGame(gameId);
  }

  async resumeGame(gameId: string): Promise<CricketGameState> {
    await this.updateGameStatus(gameId, 'in_progress');
    return this.loadGame(gameId);
  }

  async abortGame(gameId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = 'aborted', completion_reason = 'aborted', aborted_at = ?,
             updated_at = ?, row_version = row_version + 1
         WHERE id = ? AND mode = ? AND status IN (?, ?)`,
        now,
        now,
        gameId,
        'cricket',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(transaction, gameId, 'cricket_game_aborted', {});
    });
  }

  private async updateGameStatus(gameId: string, status: 'in_progress' | 'paused') {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = ?, paused_at = ?, updated_at = ?, row_version = row_version + 1
         WHERE id = ? AND mode = ? AND status IN (?, ?)`,
        status,
        status === 'paused' ? now : null,
        now,
        gameId,
        'cricket',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(
        transaction,
        gameId,
        status === 'paused' ? 'cricket_game_paused' : 'cricket_game_resumed',
        {},
      );
    });
  }
}

type GameRow = {
  id: string;
  status: CricketGameState['status'];
  bull_rule: BullRule;
  current_round_no: number;
  current_turn_sequence_no: number;
  display_name_snapshot: string;
  current_cricket_score: number;
};

type OwnerRow = {
  id: string;
  player_type: 'owner';
  display_name: string;
};

type MutableTurnContext = {
  gameId: string;
  bullRule: BullRule;
  gamePlayerId: string;
  playerId: string | null;
  roundId: string;
  roundNo: number;
  turnId: string;
  turnSequenceNo: number;
  ratingCandidate: number;
};

async function getOrCreateOwner(db: GameDatabaseExecutor, displayName: string): Promise<OwnerRow> {
  const existing = await db.getFirstAsync<OwnerRow>(
    `SELECT id, player_type, display_name
     FROM players
     WHERE player_type = ? AND is_archived = 0
     ORDER BY created_at ASC
     LIMIT 1`,
    'owner',
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const id = createGameId();
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived,
       created_at, updated_at, last_used_at
     )
     VALUES (?, 'owner', ?, 'unknown', 0, ?, ?, ?)`,
    id,
    displayName,
    now,
    now,
    now,
  );
  return { id, player_type: 'owner', display_name: displayName };
}

async function loadMutableTurnContext(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<MutableTurnContext> {
  const row = await db.getFirstAsync<MutableTurnContext & { status: string }>(
    `SELECT
       g.id AS gameId,
       g.bull_rule AS bullRule,
       gp.id AS gamePlayerId,
       gp.player_id AS playerId,
       r.id AS roundId,
       t.round_no AS roundNo,
       t.id AS turnId,
       t.turn_sequence_no AS turnSequenceNo,
       g.rating_candidate AS ratingCandidate,
       g.status AS status
     FROM game_sessions g
     JOIN game_players gp ON gp.game_id = g.id
     JOIN turns t ON t.game_id = g.id AND t.turn_sequence_no = g.current_turn_sequence_no
     JOIN rounds r ON r.id = t.round_id
     WHERE g.id = ? AND g.mode = ? AND g.deleted_at IS NULL
     LIMIT 1`,
    gameId,
    'cricket',
  );

  if (!row || row.status !== 'in_progress') {
    throw new Error('CRICKET game is not accepting input.');
  }

  return row;
}

async function countActiveDarts(db: GameDatabaseExecutor, turnId: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM darts
     WHERE turn_id = ? AND status = ?`,
    turnId,
    'active',
  );
  return row?.count ?? 0;
}

async function applyCricketProgress(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  status: CricketTurn['status'],
  now: string,
) {
  const turns = await loadTurns(db, context.gameId);
  const progress = evaluateCricketProgress(turns);
  const turnStats = progress.turnStats.get(context.turnId) ?? { marksTotal: 0, pointsScored: 0 };
  const activeDartCount = await countActiveDarts(db, context.turnId);

  await db.runAsync(
    `UPDATE turns
     SET status = ?, raw_score = ?, applied_score = ?, cricket_marks_total = ?,
         cricket_points_scored = ?, dart_count = ?, confirmed_at = ?,
         updated_at = ?, revision_no = revision_no + 1
     WHERE id = ?`,
    status,
    turnStats.pointsScored,
    turnStats.pointsScored,
    turnStats.marksTotal,
    turnStats.pointsScored,
    activeDartCount,
    status === 'in_progress' ? null : now,
    now,
    context.turnId,
  );

  for (const state of progress.targetStates) {
    await db.runAsync(
      `UPDATE cricket_number_states
       SET marks_total = ?, is_closed = ?, closed_at_turn_id = ?,
           closed_at_round_no = ?, points_scored = ?, updated_at = ?
       WHERE game_id = ? AND game_player_id = ? AND target = ?`,
      state.marksTotal,
      state.isClosed ? 1 : 0,
      state.closedAtTurnId,
      state.closedAtRoundNo,
      state.pointsScored,
      now,
      context.gameId,
      context.gamePlayerId,
      state.target,
    );
  }

  await db.runAsync(
    `UPDATE game_players
     SET current_cricket_score = ?, updated_at = ?
     WHERE id = ?`,
    progress.currentScore,
    now,
    context.gamePlayerId,
  );

  if (status === 'in_progress') {
    return progress;
  }

  await db.runAsync(
    `UPDATE darts
     SET confirmed_at = ?, updated_at = ?
     WHERE turn_id = ? AND status = ?`,
    now,
    now,
    context.turnId,
    'active',
  );

  await db.runAsync(
    `UPDATE rounds SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
    now,
    now,
    context.roundId,
  );

  const confirmedTurns = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM turns WHERE game_id = ? AND status IN ('confirmed', 'game_end')`,
    context.gameId,
  );
  const activeDarts = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM darts WHERE game_id = ? AND status = 'active'`,
    context.gameId,
  );
  await db.runAsync(
    `UPDATE game_players
     SET darts_thrown = ?, turns_confirmed = ?, result = 'completed', updated_at = ?
     WHERE id = ?`,
    activeDarts?.count ?? 0,
    confirmedTurns?.count ?? 0,
    now,
    context.gamePlayerId,
  );

  return progress;
}

async function createNextRoundAndTurn(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  now: string,
) {
  const nextRoundNo = context.roundNo + 1;
  const nextTurnSequenceNo = context.turnSequenceNo + 1;
  const roundId = createGameId();
  const turnId = createGameId();

  await db.runAsync(
    `INSERT INTO rounds(id, game_id, round_no, status, started_at, created_at, updated_at)
     VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`,
    roundId,
    context.gameId,
    nextRoundNo,
    now,
    now,
    now,
  );

  await db.runAsync(
    `INSERT INTO turns(
       id, game_id, round_id, game_player_id, turn_sequence_no, round_no,
       player_turn_order, status, started_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, 1, 'in_progress', ?, ?, ?)`,
    turnId,
    context.gameId,
    roundId,
    context.gamePlayerId,
    nextTurnSequenceNo,
    nextRoundNo,
    now,
    now,
    now,
  );

  await db.runAsync(
    `UPDATE game_sessions
     SET current_round_no = ?, current_turn_sequence_no = ?, updated_at = ?,
         row_version = row_version + 1
     WHERE id = ?`,
    nextRoundNo,
    nextTurnSequenceNo,
    now,
    context.gameId,
  );
}

async function loadTurns(db: GameDatabaseExecutor, gameId: string): Promise<CricketTurn[]> {
  const turnRows = await db.getAllAsync<{
    id: string;
    round_no: number;
    turn_sequence_no: number;
    status: CricketTurn['status'];
    raw_score: number;
    applied_score: number;
    cricket_marks_total: number;
    cricket_points_scored: number;
    dart_count: number;
  }>(
    `SELECT
       id, round_no, turn_sequence_no, status, raw_score, applied_score,
       cricket_marks_total, cricket_points_scored, dart_count
     FROM turns
     WHERE game_id = ?
     ORDER BY turn_sequence_no ASC`,
    gameId,
  );

  const turns: CricketTurn[] = [];
  for (const turn of turnRows) {
    const darts = await loadTurnDarts(db, turn.id);
    turns.push({
      id: turn.id,
      roundNo: turn.round_no,
      turnSequenceNo: turn.turn_sequence_no,
      status: turn.status,
      darts,
      rawScore: turn.raw_score,
      appliedScore: turn.applied_score,
      cricketMarksTotal: turn.cricket_marks_total,
      cricketPointsScored: turn.cricket_points_scored,
      dartCount: turn.dart_count,
    });
  }
  return turns;
}

async function loadTurnDarts(db: GameDatabaseExecutor, turnId: string): Promise<CricketDart[]> {
  return db.getAllAsync<CricketDart>(
    `SELECT
       id,
       round_no AS roundNo,
       dart_no AS dartNo,
       area,
       segment_number AS segmentNumber,
       multiplier,
       score,
       cricket_marks AS cricketMarks,
       status,
       input_source AS inputSource,
       correction_count AS correctionCount,
       client_action_id AS clientActionId,
       created_at AS createdAt,
       (SELECT turn_sequence_no FROM turns WHERE turns.id = darts.turn_id) AS turnSequenceNo
     FROM darts
     WHERE turn_id = ?
     ORDER BY dart_no ASC`,
    turnId,
  );
}

async function loadResult(db: GameDatabaseExecutor, gameId: string): Promise<CricketResult | null> {
  const row = await db.getFirstAsync<{
    final_total_score: number;
    rounds_count: number;
    turns_count: number;
    darts_thrown: number;
    bull_count: number;
    inner_bull_count: number;
    outer_bull_count: number;
    triple_count: number;
    double_count: number;
    miss_count: number;
    cricket_marks_total: number;
    mpr_milli: number | null;
    closed_number_count: number;
    turns_5_marks_plus: number;
    turns_7_marks_plus: number;
    turns_9_marks: number;
    manual_correction_count: number;
    fully_manual_darts: number;
    extra_stats_json: string;
    outbox_status: 'pending' | 'linked' | 'error' | null;
  }>(
    `SELECT
       r.final_total_score, r.rounds_count, r.turns_count, r.darts_thrown,
       r.bull_count, r.inner_bull_count, r.outer_bull_count, r.triple_count,
       r.double_count, r.miss_count, r.cricket_marks_total, r.mpr_milli,
       r.closed_number_count, r.turns_5_marks_plus, r.turns_7_marks_plus,
       r.turns_9_marks, r.manual_correction_count, r.fully_manual_darts,
       r.extra_stats_json, l.sync_status AS outbox_status
     FROM game_player_results r
     LEFT JOIN practice_record_links l ON l.game_id = r.game_id
     WHERE r.game_id = ?
     LIMIT 1`,
    gameId,
  );

  if (!row) {
    return null;
  }

  const extra = JSON.parse(row.extra_stats_json || '{}') as {
    completionReason?: 'all_closed_with_score' | 'round_limit';
    targetStates?: CricketResult['targetStates'];
    clearFlag?: boolean;
    allClosedZeroScore?: boolean;
  };

  return {
    finalCricketScore: row.final_total_score,
    marksTotal: row.cricket_marks_total,
    mprMilli: row.mpr_milli ?? 0,
    closedTargetCount: row.closed_number_count,
    allTargetsClosed: row.closed_number_count === CRICKET_TARGETS.length,
    allClosedZeroScore: extra.allClosedZeroScore ?? false,
    clearFlag: extra.clearFlag ?? false,
    roundsPlayed: row.rounds_count,
    turnsPlayed: row.turns_count,
    dartsThrown: row.darts_thrown,
    bullCount: row.bull_count,
    innerBullCount: row.inner_bull_count,
    outerBullCount: row.outer_bull_count,
    tripleCount: row.triple_count,
    doubleCount: row.double_count,
    missCount: row.miss_count,
    turns5MarksPlus: row.turns_5_marks_plus,
    turns7MarksPlus: row.turns_7_marks_plus,
    turns9Marks: row.turns_9_marks,
    fullyManualDarts: row.fully_manual_darts,
    correctionCount: row.manual_correction_count,
    targetStates: extra.targetStates ?? [],
    completionReason: extra.completionReason ?? 'round_limit',
    outboxStatus: row.outbox_status,
  };
}

async function completeGame(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  completionReason: CricketResult['completionReason'],
  machineType: string | null,
  now: string,
) {
  const turns = await loadTurns(db, context.gameId);
  const result = summarizeCricketGame(turns);
  const highTurnScore = Math.max(...turns.map((turn) => turn.cricketPointsScored), 0);
  const lowTurnScore = Math.min(...turns.map((turn) => turn.cricketPointsScored), 0);
  const ratingState = await loadGameRatingState(db, context.gameId);

  await db.runAsync(
    `UPDATE game_sessions
     SET status = 'completed', completion_reason = ?, completed_at = ?, updated_at = ?,
         row_version = row_version + 1
     WHERE id = ?`,
    completionReason,
    now,
    now,
    context.gameId,
  );

  await db.runAsync(
    `UPDATE game_players
     SET current_cricket_score = ?, darts_thrown = ?, turns_confirmed = ?,
         is_winner = ?, result = 'completed', updated_at = ?
     WHERE id = ?`,
    result.finalCricketScore,
    result.dartsThrown,
    result.turnsPlayed,
    result.clearFlag ? 1 : 0,
    now,
    context.gamePlayerId,
  );

  await db.runAsync(
    `INSERT INTO game_player_results(
       game_id, game_player_id, player_id, result, rank_no, is_final,
       final_total_score, effective_score, rounds_count, turns_count, darts_thrown,
       bull_count, inner_bull_count, outer_bull_count, triple_count, double_count,
       miss_count, cricket_marks_total, mpr_milli, closed_number_count,
       high_turn_score, low_turn_score, turns_5_marks_plus, turns_7_marks_plus,
       turns_9_marks, manual_correction_count, fully_manual_darts, extra_stats_json,
       calculation_version, created_at, updated_at
     )
     VALUES (?, ?, ?, 'completed', 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?)
     ON CONFLICT(game_id, game_player_id) DO UPDATE SET
       final_total_score = excluded.final_total_score,
       effective_score = excluded.effective_score,
       rounds_count = excluded.rounds_count,
       turns_count = excluded.turns_count,
       darts_thrown = excluded.darts_thrown,
       bull_count = excluded.bull_count,
       inner_bull_count = excluded.inner_bull_count,
       outer_bull_count = excluded.outer_bull_count,
       triple_count = excluded.triple_count,
       double_count = excluded.double_count,
       miss_count = excluded.miss_count,
       cricket_marks_total = excluded.cricket_marks_total,
       mpr_milli = excluded.mpr_milli,
       closed_number_count = excluded.closed_number_count,
       high_turn_score = excluded.high_turn_score,
       low_turn_score = excluded.low_turn_score,
       turns_5_marks_plus = excluded.turns_5_marks_plus,
       turns_7_marks_plus = excluded.turns_7_marks_plus,
       turns_9_marks = excluded.turns_9_marks,
       manual_correction_count = excluded.manual_correction_count,
       fully_manual_darts = excluded.fully_manual_darts,
       extra_stats_json = excluded.extra_stats_json,
       updated_at = excluded.updated_at`,
    context.gameId,
    context.gamePlayerId,
    context.playerId,
    result.finalCricketScore,
    result.finalCricketScore,
    result.roundsPlayed,
    result.turnsPlayed,
    result.dartsThrown,
    result.bullCount,
    result.innerBullCount,
    result.outerBullCount,
    result.tripleCount,
    result.doubleCount,
    result.missCount,
    result.marksTotal,
    result.mprMilli,
    result.closedTargetCount,
    highTurnScore,
    lowTurnScore,
    result.turns5MarksPlus,
    result.turns7MarksPlus,
    result.turns9Marks,
    result.correctionCount,
    result.fullyManualDarts,
    JSON.stringify({
      version: 1,
      completionReason,
      clearFlag: result.clearFlag,
      allClosedZeroScore: result.allClosedZeroScore,
      finalCricketScore: result.finalCricketScore,
      targetStates: result.targetStates,
      machineType,
    }),
    now,
    now,
  );

  const payload = {
    version: 1,
    mode: 'cricket',
    completedAt: now,
    completionReason,
    clearFlag: result.clearFlag,
    finalCricketScore: result.finalCricketScore,
    marksTotal: result.marksTotal,
    mprMilli: result.mprMilli,
    bullRule: context.bullRule,
    machineType,
    ratingExcluded: ratingState.rating_candidate !== 1,
  };

  await db.runAsync(
    `INSERT OR IGNORE INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key,
       payload_json, status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'practice_record_upsert', 'game', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    createGameId(),
    context.gameId,
    `practice-record-upsert:${context.gameId}:completed`,
    JSON.stringify(payload),
    now,
    now,
    now,
  );

  await db.runAsync(
    `INSERT INTO practice_record_links(
       game_id, practice_record_id, payload_hash, sync_status, created_at, updated_at
     )
     VALUES (?, ?, ?, 'pending', ?, ?)
     ON CONFLICT(game_id) DO UPDATE SET
       payload_hash = excluded.payload_hash,
       updated_at = excluded.updated_at`,
    context.gameId,
    `pending:${context.gameId}`,
    `cricket:${context.gameId}:completed`,
    now,
    now,
  );

  await appendDomainEvent(db, context.gameId, 'cricket_game_completed', {
    completionReason,
    finalCricketScore: result.finalCricketScore,
    mprMilli: result.mprMilli,
  });

  await createPendingStandaloneCricketEvaluation(db, context, result, ratingState, now);
}

type GameRatingState = {
  rating_candidate: number;
  started_at: string;
};

async function loadGameRatingState(
  db: GameDatabaseExecutor,
  gameId: string,
): Promise<GameRatingState> {
  const row = await db.getFirstAsync<GameRatingState>(
    `SELECT rating_candidate, started_at
     FROM game_sessions
     WHERE id = ?
     LIMIT 1`,
    gameId,
  );

  return {
    rating_candidate: row?.rating_candidate ?? 0,
    started_at: row?.started_at ?? new Date().toISOString(),
  };
}

async function createPendingStandaloneCricketEvaluation(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  result: CricketSummary,
  ratingState: GameRatingState,
  now: string,
) {
  if (ratingState.rating_candidate !== 1 || !context.playerId) {
    return;
  }

  const eligibility = await new StandaloneRatingCandidateService(db).evaluateGameStart({
    mode: 'cricket',
    ownerPlayerId: context.playerId,
    gameStartedAt: ratingState.started_at,
  });

  if (!eligibility.eligible) {
    return;
  }

  const account = await db.getFirstAsync<{ account_id: string }>(
    `SELECT account_id
     FROM players
     WHERE id = ? AND player_type = 'owner' AND account_id IS NOT NULL
     LIMIT 1`,
    context.playerId,
  );

  if (!account?.account_id) {
    return;
  }

  const evaluationId = createGameId();
  await db.runAsync(
    `INSERT OR IGNORE INTO rating_evaluations(
       id, account_id, player_id, source_type, source_match_id, source_game_id,
       source_revision, status, candidate_flag, match_result, zero_one_game_count,
       zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
       total_rounds, source_weight_milli, auto_detected_darts, adjusted_darts,
       fully_manual_darts, correction_count, input_payload_json, created_at
     )
     VALUES (?, ?, ?, 'standalone_cricket', NULL, ?, 1, 'pending', 1, NULL, 0, NULL, 1, ?, ?, ?, 500, 0, 0, ?, ?, ?, ?)`,
    evaluationId,
    account.account_id,
    context.playerId,
    context.gameId,
    result.mprMilli,
    result.dartsThrown,
    result.turnsPlayed,
    result.fullyManualDarts,
    result.correctionCount,
    JSON.stringify({
      version: 1,
      sourceType: 'standalone_cricket',
      gameId: context.gameId,
      completionReason: result.clearFlag ? 'all_closed_with_score' : 'round_limit',
      finalCricketScore: result.finalCricketScore,
      marksTotal: result.marksTotal,
      mprMilli: result.mprMilli,
      clearFlag: result.clearFlag,
    }),
    now,
  );

  const existingEvaluation = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM rating_evaluations
     WHERE source_type = 'standalone_cricket'
       AND source_game_id = ?
       AND account_id = ?
       AND source_revision = 1
     LIMIT 1`,
    context.gameId,
    account.account_id,
  );

  const resolvedEvaluationId = existingEvaluation?.id ?? evaluationId;
  await db.runAsync(
    `INSERT OR IGNORE INTO rating_evaluation_games(
       evaluation_id, game_id, mode, game_no, mpr_milli, darts_thrown,
       rounds_count, marks_total, created_at
     )
     VALUES (?, ?, 'cricket', 1, ?, ?, ?, ?, ?)`,
    resolvedEvaluationId,
    context.gameId,
    result.mprMilli,
    result.dartsThrown,
    result.turnsPlayed,
    result.marksTotal,
    now,
  );

  await db.runAsync(
    `INSERT OR IGNORE INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key,
       payload_json, status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'rating_recalculate', 'game', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    createGameId(),
    context.gameId,
    `rating-recalculate:${context.gameId}:standalone-cricket:1`,
    JSON.stringify({
      version: 1,
      sourceType: 'standalone_cricket',
      gameId: context.gameId,
      evaluationId: resolvedEvaluationId,
      accountId: account.account_id,
    }),
    now,
    now,
    now,
  );
}

async function appendDomainEvent(
  db: GameDatabaseExecutor,
  gameId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const sequence = await db.getFirstAsync<{ next_sequence_no: number }>(
    `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS next_sequence_no
     FROM domain_events
     WHERE scope_type = ? AND scope_id = ?`,
    'game',
    gameId,
  );
  await db.runAsync(
    `INSERT INTO domain_events(
       id, scope_type, scope_id, game_id, sequence_no, event_type, payload_json, created_at
     )
     VALUES (?, 'game', ?, ?, ?, ?, ?, ?)`,
    createGameId(),
    gameId,
    gameId,
    sequence?.next_sequence_no ?? 1,
    eventType,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

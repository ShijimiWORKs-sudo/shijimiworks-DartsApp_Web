import { createGameId } from '../../domain/ids';
import {
  calculateZeroOneDartScore,
  evaluateZeroOneTurn,
  summarizeZeroOneGame,
  toZeroOneLastTurnResult,
  validateZeroOneStartScore,
  ZERO_ONE_MAX_ROUNDS,
} from '../../domain/zeroOne';
import type {
  ZeroOneDart,
  ZeroOneDartInput,
  ZeroOneGameState,
  ZeroOneOutRule,
  ZeroOneResult,
  ZeroOneStartInput,
  ZeroOneStartScore,
  ZeroOneTurn,
} from '../../domain/zeroOne';
import type { BullRule } from '../../domain/types';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
} from '../../infrastructure/sqlite/types';
import { runGameDatabaseTransaction } from '../../infrastructure/sqlite/transaction';
import { StandaloneRatingCandidateService } from './StandaloneRatingCandidateService';
import type { ZeroOneGameServicePort, ZeroOneLastSettings } from './ZeroOneGameServicePort';

export class ZeroOneActiveGameExistsError extends Error {
  constructor(readonly gameId: string) {
    super('An active game already exists.');
    this.name = 'ZeroOneActiveGameExistsError';
  }
}

export class ZeroOneGameService implements ZeroOneGameServicePort {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLastSettings(): Promise<ZeroOneLastSettings> {
    const row = await this.db.getFirstAsync<{
      zero_one_start_score: number;
      out_rule: ZeroOneOutRule;
      bull_rule: BullRule;
    }>(
      `SELECT zero_one_start_score, out_rule, bull_rule
       FROM game_sessions
       WHERE mode = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      'zero_one',
    );

    return {
      startScore: row ? validateZeroOneStartScore(row.zero_one_start_score) : 501,
      outRule: row?.out_rule ?? 'single_out',
      bullRule: row?.bull_rule ?? 'fat_bull',
    };
  }

  async getActiveGame(): Promise<ZeroOneGameState | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status IN (?, ?) AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      'zero_one',
      'in_progress',
      'paused',
    );
    return row ? this.loadGame(row.id) : null;
  }

  async listRecentResults(limit = 5): Promise<ZeroOneGameState[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status = ? AND deleted_at IS NULL
       ORDER BY completed_at DESC, updated_at DESC
       LIMIT ?`,
      'zero_one',
      'completed',
      limit,
    );
    return Promise.all(rows.map((row) => this.loadGame(row.id)));
  }

  async startGame(input: ZeroOneStartInput): Promise<ZeroOneGameState> {
    let gameId: string | null = null;

    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const active = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM game_sessions
         WHERE status IN (?, ?) AND deleted_at IS NULL
         LIMIT 1`,
        'in_progress',
        'paused',
      );

      if (active) {
        throw new ZeroOneActiveGameExistsError(active.id);
      }

      const owner = await getOrCreateOwner(transaction, input.ownerName ?? 'PLAYER 1');
      const now = new Date().toISOString();
      const ratingDecision = await new StandaloneRatingCandidateService(
        transaction,
      ).buildGameStartDecision({
        mode: 'zero_one',
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
         VALUES (?, 'zero_one', 'in_progress', ?, ?, ?, ?, 1, 1, 1, ?, ?, ?, 0, ?, ?, ?)`,
        gameId,
        ZERO_ONE_MAX_ROUNDS,
        input.bullRule,
        input.outRule,
        input.startScore,
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
         VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending', ?, ?)`,
        gamePlayerId,
        gameId,
        owner.id,
        owner.display_name,
        owner.player_type,
        input.startScore,
        input.startScore,
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
           player_turn_order, status, start_remaining_score, end_remaining_score,
           started_at, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, 1, 1, 1, 'in_progress', ?, ?, ?, ?, ?)`,
        turnId,
        gameId,
        roundId,
        gamePlayerId,
        input.startScore,
        input.startScore,
        now,
        now,
        now,
      );

      await appendDomainEvent(transaction, gameId, 'zero_one_game_started', {
        startScore: input.startScore,
        outRule: input.outRule,
        bullRule: input.bullRule,
      });
    });

    if (!gameId) {
      throw new Error('01 game was not created.');
    }
    return this.loadGame(gameId);
  }

  async loadGame(gameId: string): Promise<ZeroOneGameState> {
    const row = await this.db.getFirstAsync<GameRow>(
      `SELECT
         g.id, g.status, g.bull_rule, g.out_rule, g.zero_one_start_score,
         g.current_round_no, g.current_turn_sequence_no, gp.display_name_snapshot,
         gp.current_remaining_score
       FROM game_sessions g
       JOIN game_players gp ON gp.game_id = g.id
       WHERE g.id = ? AND g.mode = ? AND g.deleted_at IS NULL
       LIMIT 1`,
      gameId,
      'zero_one',
    );

    if (!row) {
      throw new Error('01 game was not found.');
    }

    const turns = await loadTurns(this.db, gameId);
    const currentTurn =
      turns.find((turn) => turn.turnSequenceNo === row.current_turn_sequence_no) ?? null;
    const lastCompletedTurn =
      turns
        .filter((turn) => turn.status !== 'in_progress')
        .sort((a, b) => b.turnSequenceNo - a.turnSequenceNo)[0] ?? null;
    const result = await loadResult(
      this.db,
      gameId,
      validateZeroOneStartScore(row.zero_one_start_score),
    );

    return {
      gameId: row.id,
      status: row.status,
      bullRule: row.bull_rule,
      outRule: row.out_rule,
      startScore: validateZeroOneStartScore(row.zero_one_start_score),
      playerName: row.display_name_snapshot,
      currentRoundNo: row.current_round_no,
      currentTurnId: currentTurn?.id ?? null,
      currentTurnScore: currentTurn?.status === 'in_progress' ? currentTurn.rawScore : 0,
      currentRemainingScore:
        row.current_remaining_score ?? validateZeroOneStartScore(row.zero_one_start_score),
      dartsThrown: turns.flatMap((turn) => turn.darts).filter((dart) => dart.status === 'active')
        .length,
      turns,
      currentTurn,
      lastTurnResult: toZeroOneLastTurnResult(lastCompletedTurn),
      result,
    };
  }

  async recordDart(gameId: string, input: ZeroOneDartInput): Promise<ZeroOneGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
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
        throw new Error('This 01 turn already has three darts.');
      }

      const { multiplier, score } = calculateZeroOneDartScore(input, context.bullRule);
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
      if (reusable) {
        await transaction.runAsync(
          `UPDATE darts
           SET area = ?, segment_number = ?, multiplier = ?, score = ?,
               input_source = ?, status = 'active', correction_count = correction_count + 1,
               client_action_id = ?, updated_at = ?
           WHERE id = ?`,
          input.area,
          input.segmentNumber,
          multiplier,
          score,
          input.inputSource ?? 'manual_segment',
          input.clientActionId ?? `${gameId}:${now}:${dartNo}`,
          now,
          dartId,
        );
      } else {
        await transaction.runAsync(
          `INSERT INTO darts(
             id, game_id, turn_id, game_player_id, round_no, dart_no,
             segment_number, area, multiplier, score, input_source, status,
             is_rating_eligible, correction_count, client_action_id, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?, ?)`,
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
          input.inputSource ?? 'manual_segment',
          input.clientActionId ?? `${gameId}:${now}:${dartNo}`,
          now,
          now,
        );
      }

      await applyTurnEvaluation(transaction, context, false, null, now);
      await appendDomainEvent(transaction, gameId, 'zero_one_dart_recorded', { dartId });
    });

    return this.loadGame(gameId);
  }

  async undoDart(gameId: string): Promise<ZeroOneGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
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
      await applyTurnEvaluation(transaction, context, false, null, now);
      await appendDomainEvent(transaction, gameId, 'zero_one_dart_undone', { dartId: dart.id });
    });

    return this.loadGame(gameId);
  }

  async redoDart(gameId: string, dartId: string): Promise<ZeroOneGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
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
      await applyTurnEvaluation(transaction, context, false, null, now);
      await appendDomainEvent(transaction, gameId, 'zero_one_dart_redone', { dartId: dart.id });
    });

    return this.loadGame(gameId);
  }

  async confirmTurn(
    gameId: string,
    input: { machineType?: string | null } = {},
  ): Promise<ZeroOneGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId);
      const activeCount = await countActiveDarts(transaction, context.turnId);
      if (activeCount === 0) {
        throw new Error('At least one dart is required to confirm a 01 turn.');
      }

      const now = new Date().toISOString();
      await applyTurnEvaluation(transaction, context, true, input.machineType ?? null, now);
      await appendDomainEvent(transaction, gameId, 'zero_one_turn_confirmed', {
        roundNo: context.roundNo,
      });
    });

    return this.loadGame(gameId);
  }

  async pauseGame(gameId: string): Promise<ZeroOneGameState> {
    await this.updateGameStatus(gameId, 'paused');
    return this.loadGame(gameId);
  }

  async resumeGame(gameId: string): Promise<ZeroOneGameState> {
    await this.updateGameStatus(gameId, 'in_progress');
    return this.loadGame(gameId);
  }

  async abortGame(gameId: string): Promise<void> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = 'aborted', completion_reason = 'aborted', aborted_at = ?,
             updated_at = ?, row_version = row_version + 1
         WHERE id = ? AND mode = ? AND status IN (?, ?)`,
        now,
        now,
        gameId,
        'zero_one',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(transaction, gameId, 'zero_one_game_aborted', {});
    });
  }

  private async updateGameStatus(gameId: string, status: 'in_progress' | 'paused') {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = ?, paused_at = ?, updated_at = ?, row_version = row_version + 1
         WHERE id = ? AND mode = ? AND status IN (?, ?)`,
        status,
        status === 'paused' ? now : null,
        now,
        gameId,
        'zero_one',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(
        transaction,
        gameId,
        status === 'paused' ? 'zero_one_game_paused' : 'zero_one_game_resumed',
        {},
      );
    });
  }
}

type GameRow = {
  id: string;
  status: ZeroOneGameState['status'];
  bull_rule: BullRule;
  out_rule: ZeroOneOutRule;
  zero_one_start_score: number;
  current_round_no: number;
  current_turn_sequence_no: number;
  display_name_snapshot: string;
  current_remaining_score: number | null;
};

type OwnerRow = {
  id: string;
  player_type: 'owner';
  display_name: string;
};

type MutableTurnContext = {
  gameId: string;
  bullRule: BullRule;
  outRule: ZeroOneOutRule;
  startScore: ZeroOneStartScore;
  gamePlayerId: string;
  playerId: string | null;
  roundId: string;
  roundNo: number;
  turnId: string;
  turnSequenceNo: number;
  startRemainingScore: number;
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
       g.out_rule AS outRule,
       g.zero_one_start_score AS startScore,
       gp.id AS gamePlayerId,
       gp.player_id AS playerId,
       r.id AS roundId,
       t.round_no AS roundNo,
       t.id AS turnId,
       t.turn_sequence_no AS turnSequenceNo,
       t.start_remaining_score AS startRemainingScore,
       g.status AS status
     FROM game_sessions g
     JOIN game_players gp ON gp.game_id = g.id
     JOIN turns t ON t.game_id = g.id AND t.turn_sequence_no = g.current_turn_sequence_no
     JOIN rounds r ON r.id = t.round_id
     WHERE g.id = ? AND g.mode = ? AND g.deleted_at IS NULL
     LIMIT 1`,
    gameId,
    'zero_one',
  );

  if (!row || row.status !== 'in_progress') {
    throw new Error('01 game is not accepting input.');
  }

  return { ...row, startScore: validateZeroOneStartScore(row.startScore) };
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

async function applyTurnEvaluation(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  forceConfirm: boolean,
  machineType: string | null,
  now: string,
) {
  const darts = await loadTurnDarts(db, context.turnId);
  const evaluation = evaluateZeroOneTurn(
    context.startRemainingScore,
    darts,
    context.outRule,
    forceConfirm,
  );
  const activeDartCount = darts.filter((dart) => dart.status === 'active').length;

  await db.runAsync(
    `UPDATE turns
     SET status = ?, raw_score = ?, applied_score = ?, end_remaining_score = ?,
         is_bust = ?, is_checkout = ?, dart_count = ?, confirmed_at = ?,
         updated_at = ?, revision_no = revision_no + 1
     WHERE id = ?`,
    evaluation.status,
    evaluation.rawScore,
    evaluation.appliedScore,
    evaluation.endRemainingScore,
    evaluation.isBust ? 1 : 0,
    evaluation.isCheckout ? 1 : 0,
    activeDartCount,
    evaluation.status === 'in_progress' ? null : now,
    now,
    context.turnId,
  );

  await db.runAsync(
    `UPDATE game_players
     SET current_remaining_score = ?, updated_at = ?
     WHERE id = ?`,
    evaluation.endRemainingScore,
    now,
    context.gamePlayerId,
  );

  if (evaluation.status === 'in_progress') {
    return;
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

  await db.runAsync(
    `UPDATE game_players
     SET current_remaining_score = ?, current_total_score = current_total_score + ?,
         darts_thrown = darts_thrown + ?, turns_confirmed = turns_confirmed + ?,
         is_winner = CASE WHEN ? = 1 THEN 1 ELSE is_winner END,
         result = CASE WHEN ? = 1 THEN 'completed' ELSE result END,
         updated_at = ?
     WHERE id = ?`,
    evaluation.endRemainingScore,
    evaluation.appliedScore,
    activeDartCount,
    1,
    evaluation.isCheckout ? 1 : 0,
    evaluation.isCheckout ? 1 : 0,
    now,
    context.gamePlayerId,
  );

  if (evaluation.isCheckout) {
    await completeGame(db, context, 'checkout', machineType, now);
    return;
  }

  if (context.roundNo >= ZERO_ONE_MAX_ROUNDS) {
    await completeGame(db, context, 'round_limit', machineType, now);
    return;
  }

  await createNextRoundAndTurn(db, context, evaluation.endRemainingScore, now);
}

async function createNextRoundAndTurn(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  nextStartRemaining: number,
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
       player_turn_order, status, start_remaining_score, end_remaining_score,
       started_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, 1, 'in_progress', ?, ?, ?, ?, ?)`,
    turnId,
    context.gameId,
    roundId,
    context.gamePlayerId,
    nextTurnSequenceNo,
    nextRoundNo,
    nextStartRemaining,
    nextStartRemaining,
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

async function loadTurns(db: GameDatabaseExecutor, gameId: string): Promise<ZeroOneTurn[]> {
  const turnRows = await db.getAllAsync<{
    id: string;
    round_no: number;
    turn_sequence_no: number;
    status: ZeroOneTurn['status'];
    start_remaining_score: number | null;
    end_remaining_score: number | null;
    raw_score: number;
    applied_score: number;
    is_bust: number;
    is_checkout: number;
    dart_count: number;
  }>(
    `SELECT
       id, round_no, turn_sequence_no, status, start_remaining_score,
       end_remaining_score, raw_score, applied_score, is_bust, is_checkout, dart_count
     FROM turns
     WHERE game_id = ?
     ORDER BY turn_sequence_no ASC`,
    gameId,
  );

  const turns: ZeroOneTurn[] = [];
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
      startRemainingScore: turn.start_remaining_score ?? 0,
      endRemainingScore: turn.end_remaining_score ?? turn.start_remaining_score ?? 0,
      dartCount: turn.dart_count,
      isBust: turn.is_bust === 1,
      isCheckout: turn.is_checkout === 1,
    });
  }
  return turns;
}

async function loadTurnDarts(db: GameDatabaseExecutor, turnId: string): Promise<ZeroOneDart[]> {
  return db.getAllAsync<ZeroOneDart>(
    `SELECT
       id,
       round_no AS roundNo,
       dart_no AS dartNo,
       area,
       segment_number AS segmentNumber,
       multiplier,
       score,
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

async function loadResult(
  db: GameDatabaseExecutor,
  gameId: string,
  startScore: ZeroOneStartScore,
): Promise<ZeroOneResult | null> {
  const row = await db.getFirstAsync<{
    final_remaining_score: number | null;
    effective_score: number;
    rounds_count: number;
    turns_count: number;
    darts_thrown: number;
    bull_count: number;
    inner_bull_count: number;
    outer_bull_count: number;
    triple_count: number;
    double_count: number;
    miss_count: number;
    bust_count: number;
    checkout_flag: number;
    checkout_round_no: number | null;
    checkout_darts: number | null;
    ppd_milli: number | null;
    three_dart_average_milli: number | null;
    turns_100_plus: number;
    turns_140_plus: number;
    turns_180: number;
    extra_stats_json: string;
    outbox_status: 'pending' | 'linked' | 'error' | null;
  }>(
    `SELECT
       r.final_remaining_score, r.effective_score, r.rounds_count, r.turns_count,
       r.darts_thrown, r.bull_count, r.inner_bull_count, r.outer_bull_count,
       r.triple_count, r.double_count, r.miss_count, r.bust_count, r.checkout_flag,
       r.checkout_round_no, r.checkout_darts, r.ppd_milli, r.three_dart_average_milli,
       r.turns_100_plus, r.turns_140_plus, r.turns_180, r.extra_stats_json,
       l.sync_status AS outbox_status
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
    completionReason?: 'checkout' | 'round_limit';
  };

  return {
    startScore,
    finalRemainingScore: row.final_remaining_score ?? 0,
    effectiveScore: row.effective_score,
    dartsThrown: row.darts_thrown,
    roundsPlayed: row.rounds_count,
    turnsPlayed: row.turns_count,
    bustCount: row.bust_count,
    bullCount: row.bull_count,
    innerBullCount: row.inner_bull_count,
    outerBullCount: row.outer_bull_count,
    tripleCount: row.triple_count,
    doubleCount: row.double_count,
    missCount: row.miss_count,
    turns100Plus: row.turns_100_plus,
    turns140Plus: row.turns_140_plus,
    turns180: row.turns_180,
    ppdMilli: row.ppd_milli ?? 0,
    threeDartAverageMilli: row.three_dart_average_milli ?? 0,
    completionReason:
      extra.completionReason ?? (row.checkout_flag === 1 ? 'checkout' : 'round_limit'),
    checkoutRoundNo: row.checkout_round_no,
    checkoutDarts: row.checkout_darts,
    outboxStatus: row.outbox_status,
  };
}

async function completeGame(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  completionReason: 'checkout' | 'round_limit',
  machineType: string | null,
  now: string,
) {
  const status = await db.getFirstAsync<{ status: string }>(
    `SELECT status FROM game_sessions WHERE id = ? LIMIT 1`,
    context.gameId,
  );
  if (status?.status === 'completed') {
    return;
  }

  const turns = await loadTurns(db, context.gameId);
  const result = summarizeZeroOneGame(turns, context.startScore, completionReason);
  const ratingState = await loadGameRatingState(db, context.gameId);
  const extraStats = {
    version: 2,
    ratingExcluded: ratingState.rating_candidate !== 1,
    completionReason,
    outRule: context.outRule,
    startScore: context.startScore,
  };

  await db.runAsync(
    `UPDATE game_sessions
     SET status = 'completed', completion_reason = ?, completed_at = ?,
         updated_at = ?, row_version = row_version + 1
     WHERE id = ?`,
    completionReason,
    now,
    now,
    context.gameId,
  );

  await db.runAsync(
    `UPDATE game_players
     SET result = 'completed', current_remaining_score = ?, current_total_score = ?,
         is_winner = ?, updated_at = ?
     WHERE id = ?`,
    result.finalRemainingScore,
    result.effectiveScore,
    completionReason === 'checkout' ? 1 : 0,
    now,
    context.gamePlayerId,
  );

  await db.runAsync(
    `INSERT INTO game_player_results(
       game_id, game_player_id, player_id, result, rank_no, is_final,
       final_total_score, final_remaining_score, effective_score, rounds_count,
       turns_count, darts_thrown, bull_count, inner_bull_count, outer_bull_count,
       triple_count, double_count, miss_count, bust_count, checkout_flag,
       checkout_round_no, checkout_darts, ppd_milli, three_dart_average_milli,
       high_turn_score, low_turn_score, turns_100_plus, turns_140_plus, turns_180,
       manual_correction_count, fully_manual_darts, extra_stats_json,
       calculation_version, created_at, updated_at
     )
     VALUES (?, ?, ?, 'completed', 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
     ON CONFLICT(game_id, game_player_id) DO UPDATE SET
       final_total_score = excluded.final_total_score,
       final_remaining_score = excluded.final_remaining_score,
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
       bust_count = excluded.bust_count,
       checkout_flag = excluded.checkout_flag,
       checkout_round_no = excluded.checkout_round_no,
       checkout_darts = excluded.checkout_darts,
       ppd_milli = excluded.ppd_milli,
       three_dart_average_milli = excluded.three_dart_average_milli,
       high_turn_score = excluded.high_turn_score,
       low_turn_score = excluded.low_turn_score,
       turns_100_plus = excluded.turns_100_plus,
       turns_140_plus = excluded.turns_140_plus,
       turns_180 = excluded.turns_180,
       fully_manual_darts = excluded.fully_manual_darts,
       extra_stats_json = excluded.extra_stats_json,
       updated_at = excluded.updated_at`,
    context.gameId,
    context.gamePlayerId,
    context.playerId,
    result.effectiveScore,
    result.finalRemainingScore,
    result.effectiveScore,
    result.roundsPlayed,
    result.turnsPlayed,
    result.dartsThrown,
    result.bullCount,
    result.innerBullCount,
    result.outerBullCount,
    result.tripleCount,
    result.doubleCount,
    result.missCount,
    result.bustCount,
    completionReason === 'checkout' ? 1 : 0,
    result.checkoutRoundNo,
    result.checkoutDarts,
    result.ppdMilli,
    result.threeDartAverageMilli,
    Math.max(
      ...turns.filter((turn) => turn.status !== 'in_progress').map((turn) => turn.rawScore),
      0,
    ),
    Math.min(
      ...turns.filter((turn) => turn.status !== 'in_progress').map((turn) => turn.rawScore),
      0,
    ),
    result.turns100Plus,
    result.turns140Plus,
    result.turns180,
    result.dartsThrown,
    JSON.stringify(extraStats),
    now,
    now,
  );

  const payload = {
    version: 1,
    gameId: context.gameId,
    mode: 'zero_one',
    completedAt: now,
    startScore: context.startScore,
    finalRemainingScore: result.finalRemainingScore,
    effectiveScore: result.effectiveScore,
    completionReason,
    checkoutFlag: completionReason === 'checkout',
    ppdMilli: result.ppdMilli,
    threeDartAverageMilli: result.threeDartAverageMilli,
    bustCount: result.bustCount,
    bullCount: result.bullCount,
    bullRule: context.bullRule,
    outRule: context.outRule,
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
    `zero-one:${context.gameId}:completed`,
    now,
    now,
  );

  await appendDomainEvent(db, context.gameId, 'zero_one_game_completed', {
    completionReason,
    finalRemainingScore: result.finalRemainingScore,
    ppdMilli: result.ppdMilli,
  });

  await createPendingStandaloneZeroOneEvaluation(db, context, result, ratingState, now);
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

async function createPendingStandaloneZeroOneEvaluation(
  db: GameDatabaseExecutor,
  context: MutableTurnContext,
  result: ZeroOneResult,
  ratingState: GameRatingState,
  now: string,
) {
  if (ratingState.rating_candidate !== 1 || !context.playerId) {
    return;
  }

  const eligibility = await new StandaloneRatingCandidateService(db).evaluateGameStart({
    mode: 'zero_one',
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
     VALUES (?, ?, ?, 'standalone_zero_one', NULL, ?, 1, 'pending', 1, NULL, 1, ?, 0, NULL, ?, ?, 500, 0, 0, ?, 0, ?, ?)`,
    evaluationId,
    account.account_id,
    context.playerId,
    context.gameId,
    result.ppdMilli,
    result.dartsThrown,
    result.roundsPlayed,
    result.dartsThrown,
    JSON.stringify({
      version: 1,
      sourceType: 'standalone_zero_one',
      gameId: context.gameId,
      finalRemainingScore: result.finalRemainingScore,
      completionReason: result.completionReason,
      ppdMilli: result.ppdMilli,
      threeDartAverageMilli: result.threeDartAverageMilli,
    }),
    now,
  );

  const existingEvaluation = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM rating_evaluations
     WHERE source_type = 'standalone_zero_one'
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
       evaluation_id, game_id, mode, game_no, ppd_milli, three_dart_average_milli,
       darts_thrown, rounds_count, checkout_flag, bust_count, created_at
     )
     VALUES (?, ?, 'zero_one', 1, ?, ?, ?, ?, ?, ?, ?)`,
    resolvedEvaluationId,
    context.gameId,
    result.ppdMilli,
    result.threeDartAverageMilli,
    result.dartsThrown,
    result.roundsPlayed,
    result.completionReason === 'checkout' ? 1 : 0,
    result.bustCount,
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
    `rating-recalculate:${context.gameId}:standalone-zero-one:1`,
    JSON.stringify({
      version: 1,
      sourceType: 'standalone_zero_one',
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

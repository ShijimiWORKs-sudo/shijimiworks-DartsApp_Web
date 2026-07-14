import { createGameId } from '../../domain/ids';
import {
  calculateCountUpDartScore,
  getCountUpMultiplier,
  summarizeCountUpGame,
  summarizeTurn,
} from '../../domain/countUp';
import type {
  CountUpDart,
  CountUpDartInput,
  CountUpGameState,
  CountUpResult,
  CountUpTurn,
} from '../../domain/countUp';
import type { BullRule } from '../../domain/types';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
} from '../../infrastructure/sqlite/types';
import { runGameDatabaseTransaction } from '../../infrastructure/sqlite/transaction';

export class ActiveGameExistsError extends Error {
  constructor(readonly gameId: string) {
    super('An active game already exists.');
    this.name = 'ActiveGameExistsError';
  }
}

export class CountUpGameService {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLastCountUpBullRule(): Promise<BullRule> {
    const row = await this.db.getFirstAsync<{ bull_rule: BullRule }>(
      `SELECT bull_rule
       FROM game_sessions
       WHERE mode = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      'count_up',
    );
    return row?.bull_rule ?? 'fat_bull';
  }

  async getActiveGame(): Promise<CountUpGameState | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status IN (?, ?) AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      'count_up',
      'in_progress',
      'paused',
    );
    return row ? this.loadGame(row.id) : null;
  }

  async listRecentResults(limit = 5): Promise<CountUpGameState[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id
       FROM game_sessions
       WHERE mode = ? AND status = ? AND deleted_at IS NULL
       ORDER BY completed_at DESC, updated_at DESC
       LIMIT ?`,
      'count_up',
      'completed',
      limit,
    );
    return Promise.all(rows.map((row) => this.loadGame(row.id)));
  }

  async startGame(input: { bullRule: BullRule; ownerName?: string } = { bullRule: 'fat_bull' }) {
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
        throw new ActiveGameExistsError(active.id);
      }

      const owner = await getOrCreateOwner(transaction, input.ownerName ?? 'PLAYER 1');
      const now = new Date().toISOString();
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
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 0, '{}', 0, ?, ?, ?)`,
        gameId,
        'count_up',
        'in_progress',
        8,
        input.bullRule,
        1,
        1,
        1,
        owner.id,
        now,
        now,
        now,
      );

      await transaction.runAsync(
        `INSERT INTO game_players(
           id, game_id, player_id, slot_no, turn_order, display_name_snapshot,
           player_type_snapshot, current_total_score, current_cricket_score,
           darts_thrown, turns_confirmed, is_winner, result, created_at, updated_at
         )
         VALUES (?, ?, ?, 1, 1, ?, ?, 0, 0, 0, 0, 0, 'pending', ?, ?)`,
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
    });

    if (!gameId) {
      throw new Error('Failed to start COUNT-UP.');
    }

    return this.loadGame(gameId);
  }

  async loadGame(gameId: string): Promise<CountUpGameState> {
    const game = await this.db.getFirstAsync<GameRow>(
      `SELECT id, status, bull_rule, current_round_no, current_turn_sequence_no
       FROM game_sessions
       WHERE id = ? AND mode = ? AND deleted_at IS NULL
       LIMIT 1`,
      gameId,
      'count_up',
    );

    if (!game) {
      throw new Error('COUNT-UP game not found.');
    }

    const player = await this.db.getFirstAsync<GamePlayerRow>(
      `SELECT id, display_name_snapshot
       FROM game_players
       WHERE game_id = ?
       ORDER BY slot_no ASC
       LIMIT 1`,
      gameId,
    );

    if (!player) {
      throw new Error('COUNT-UP player not found.');
    }

    const turns = await loadTurns(this.db, gameId);
    const result = await loadResult(this.db, gameId);
    const currentTurn = turns.find(
      (turn) => turn.status === 'in_progress' && turn.roundNo === game.current_round_no,
    );
    const currentTurnScore = currentTurn ? summarizeTurn(currentTurn.darts) : 0;
    const totalScore = turns.reduce((sum, turn) => sum + summarizeTurn(turn.darts), 0);
    const dartsThrown = turns.reduce(
      (sum, turn) => sum + turn.darts.filter((dart) => dart.status === 'active').length,
      0,
    );
    const previousCompletedTurn = [...turns]
      .reverse()
      .find((turn) => turn.roundNo < game.current_round_no && turn.status === 'confirmed');
    const link = await this.db.getFirstAsync<{ sync_status: 'pending' | 'linked' | 'error' }>(
      `SELECT sync_status
       FROM practice_record_links
       WHERE game_id = ?
       LIMIT 1`,
      gameId,
    );

    return {
      gameId: game.id,
      status: game.status,
      bullRule: game.bull_rule,
      playerName: player.display_name_snapshot,
      currentRoundNo: game.current_round_no,
      currentTurnId: currentTurn?.id ?? null,
      currentTurnScore,
      totalScore,
      dartsThrown,
      turns,
      previousRoundScore: previousCompletedTurn ? summarizeTurn(previousCompletedTurn.darts) : null,
      result,
      outboxStatus: link?.sync_status ?? null,
    };
  }

  async recordDart(gameId: string, input: CountUpDartInput): Promise<CountUpGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const existing = input.clientActionId
        ? await transaction.getFirstAsync<{ id: string }>(
            `SELECT id FROM darts WHERE client_action_id = ? LIMIT 1`,
            input.clientActionId,
          )
        : null;

      if (existing) {
        return;
      }

      const context = await loadMutableTurnContext(transaction, gameId, 'in_progress');
      const activeCount = await countActiveDarts(transaction, context.turnId);

      if (activeCount >= 3) {
        throw new Error('A COUNT-UP turn cannot have more than 3 active darts.');
      }

      const dartNo = (activeCount + 1) as 1 | 2 | 3;
      const score = calculateCountUpDartScore(input, context.bullRule);
      const multiplier = getCountUpMultiplier(input.area);
      const now = new Date().toISOString();
      const clientActionId = input.clientActionId ?? createGameId();
      const reusable = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM darts
         WHERE turn_id = ? AND dart_no = ? AND status = ?
         LIMIT 1`,
        context.turnId,
        dartNo,
        'voided',
      );

      if (reusable) {
        await transaction.runAsync(
          `UPDATE darts
           SET segment_number = ?, area = ?, multiplier = ?, score = ?, cricket_marks = 0,
               input_source = ?, status = 'active', is_rating_eligible = 0,
               correction_count = correction_count + 1, client_action_id = ?, confirmed_at = NULL,
               updated_at = ?
           WHERE id = ?`,
          input.segmentNumber,
          input.area,
          multiplier,
          score,
          input.inputSource ?? 'manual_segment',
          clientActionId,
          now,
          reusable.id,
        );
        await appendDomainEvent(transaction, gameId, 'dart_reentered', { dartId: reusable.id });
        return;
      }

      const dartId = createGameId();
      await transaction.runAsync(
        `INSERT INTO darts(
           id, game_id, turn_id, game_player_id, round_no, dart_no,
           segment_number, area, multiplier, score, cricket_marks, input_source,
           status, is_rating_eligible, correction_count, client_action_id,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', 0, 0, ?, ?, ?)`,
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
        clientActionId,
        now,
        now,
      );
      await appendDomainEvent(transaction, gameId, 'dart_recorded', { dartId });
    });

    return this.loadGame(gameId);
  }

  async undoDart(gameId: string): Promise<CountUpGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId, 'in_progress');
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
        return;
      }

      await transaction.runAsync(
        `UPDATE darts
         SET status = 'voided', updated_at = ?
         WHERE id = ?`,
        new Date().toISOString(),
        dart.id,
      );
      await appendDomainEvent(transaction, gameId, 'dart_undone', { dartId: dart.id });
    });

    return this.loadGame(gameId);
  }

  async redoDart(gameId: string, dartId: string): Promise<CountUpGameState> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId, 'in_progress');
      const activeCount = await countActiveDarts(transaction, context.turnId);

      if (activeCount >= 3) {
        return;
      }

      const nextDartNo = activeCount + 1;
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

      if (!dart || dart.dart_no !== nextDartNo) {
        return;
      }

      await transaction.runAsync(
        `UPDATE darts
         SET status = 'active', updated_at = ?
         WHERE id = ?`,
        new Date().toISOString(),
        dart.id,
      );
      await appendDomainEvent(transaction, gameId, 'dart_redone', { dartId: dart.id });
    });

    return this.loadGame(gameId);
  }

  async confirmTurn(gameId: string, input: { machineType?: string | null } = {}) {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const context = await loadMutableTurnContext(transaction, gameId, 'in_progress');
      const darts = await loadTurnDarts(transaction, context.turnId);
      const activeDarts = darts.filter((dart) => dart.status === 'active');

      if (activeDarts.length === 0) {
        throw new Error('Cannot confirm an empty COUNT-UP turn.');
      }

      const now = new Date().toISOString();
      const turnScore = summarizeTurn(darts);

      await transaction.runAsync(
        `UPDATE darts
         SET confirmed_at = ?, updated_at = ?
         WHERE turn_id = ? AND status = ?`,
        now,
        now,
        context.turnId,
        'active',
      );

      await transaction.runAsync(
        `UPDATE turns
         SET status = 'confirmed', raw_score = ?, applied_score = ?, dart_count = ?,
             confirmed_at = ?, updated_at = ?
         WHERE id = ?`,
        turnScore,
        turnScore,
        activeDarts.length,
        now,
        now,
        context.turnId,
      );

      await transaction.runAsync(
        `UPDATE rounds
         SET status = 'completed', completed_at = ?, updated_at = ?
         WHERE id = ?`,
        now,
        now,
        context.roundId,
      );

      await transaction.runAsync(
        `UPDATE game_players
         SET current_total_score = current_total_score + ?,
             darts_thrown = darts_thrown + ?,
             turns_confirmed = turns_confirmed + 1,
             updated_at = ?
         WHERE id = ?`,
        turnScore,
        activeDarts.length,
        now,
        context.gamePlayerId,
      );

      if (context.roundNo >= 8) {
        await completeGame(
          transaction,
          gameId,
          context.gamePlayerId,
          context.bullRule,
          input.machineType ?? null,
          now,
        );
        return;
      }

      const nextRoundNo = context.roundNo + 1;
      const nextRoundId = createGameId();
      const nextTurnId = createGameId();
      const nextTurnSequenceNo = context.turnSequenceNo + 1;

      await transaction.runAsync(
        `INSERT INTO rounds(id, game_id, round_no, status, started_at, created_at, updated_at)
         VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`,
        nextRoundId,
        gameId,
        nextRoundNo,
        now,
        now,
        now,
      );

      await transaction.runAsync(
        `INSERT INTO turns(
           id, game_id, round_id, game_player_id, turn_sequence_no, round_no,
           player_turn_order, status, started_at, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, 1, 'in_progress', ?, ?, ?)`,
        nextTurnId,
        gameId,
        nextRoundId,
        context.gamePlayerId,
        nextTurnSequenceNo,
        nextRoundNo,
        now,
        now,
        now,
      );

      await transaction.runAsync(
        `UPDATE game_sessions
         SET current_round_no = ?, current_turn_sequence_no = ?, row_version = row_version + 1,
             updated_at = ?
         WHERE id = ?`,
        nextRoundNo,
        nextTurnSequenceNo,
        now,
        gameId,
      );

      await appendDomainEvent(transaction, gameId, 'turn_confirmed', {
        roundNo: context.roundNo,
        turnScore,
      });
    });

    return this.loadGame(gameId);
  }

  async pauseGame(gameId: string): Promise<CountUpGameState> {
    await this.updateGameStatus(gameId, 'paused');
    return this.loadGame(gameId);
  }

  async resumeGame(gameId: string): Promise<CountUpGameState> {
    await this.updateGameStatus(gameId, 'in_progress');
    return this.loadGame(gameId);
  }

  async abortGame(gameId: string): Promise<void> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE game_sessions
         SET status = 'aborted', aborted_at = ?, updated_at = ?, row_version = row_version + 1
         WHERE id = ? AND mode = ? AND status IN (?, ?)`,
        now,
        now,
        gameId,
        'count_up',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(transaction, gameId, 'game_aborted', {});
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
        'count_up',
        'in_progress',
        'paused',
      );
      await appendDomainEvent(
        transaction,
        gameId,
        status === 'paused' ? 'game_paused' : 'game_resumed',
        {},
      );
    });
  }
}

type GameRow = {
  id: string;
  status: string;
  bull_rule: BullRule;
  current_round_no: number;
  current_turn_sequence_no: number;
};

type GamePlayerRow = {
  id: string;
  display_name_snapshot: string;
};

type OwnerRow = {
  id: string;
  player_type: 'owner';
  display_name: string;
};

type MutableTurnContext = {
  bullRule: BullRule;
  gamePlayerId: string;
  roundId: string;
  roundNo: number;
  turnId: string;
  turnSequenceNo: number;
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
  requiredStatus: 'in_progress',
): Promise<MutableTurnContext> {
  const row = await db.getFirstAsync<MutableTurnContext & { status: string }>(
    `SELECT
       g.bull_rule AS bullRule,
       gp.id AS gamePlayerId,
       r.id AS roundId,
       t.round_no AS roundNo,
       t.id AS turnId,
       t.turn_sequence_no AS turnSequenceNo,
       g.status AS status
     FROM game_sessions g
     JOIN game_players gp ON gp.game_id = g.id
     JOIN turns t ON t.game_id = g.id AND t.turn_sequence_no = g.current_turn_sequence_no
     JOIN rounds r ON r.id = t.round_id
     WHERE g.id = ? AND g.mode = ? AND g.deleted_at IS NULL
     LIMIT 1`,
    gameId,
    'count_up',
  );

  if (!row || row.status !== requiredStatus) {
    throw new Error('COUNT-UP game is not accepting input.');
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

async function loadTurns(db: GameDatabaseExecutor, gameId: string): Promise<CountUpTurn[]> {
  const turnRows = await db.getAllAsync<{ id: string; round_no: number; status: string }>(
    `SELECT id, round_no, status
     FROM turns
     WHERE game_id = ?
     ORDER BY round_no ASC`,
    gameId,
  );

  const turns: CountUpTurn[] = [];
  for (const turn of turnRows) {
    const darts = await loadTurnDarts(db, turn.id);
    turns.push({
      id: turn.id,
      roundNo: turn.round_no,
      status: turn.status,
      darts,
      score: summarizeTurn(darts),
    });
  }
  return turns;
}

async function loadTurnDarts(db: GameDatabaseExecutor, turnId: string): Promise<CountUpDart[]> {
  return db.getAllAsync<CountUpDart>(
    `SELECT
       id,
       turn_id AS turnId,
       dart_no AS dartNo,
       area,
       segment_number AS segmentNumber,
       multiplier,
       score,
       status,
       input_source AS inputSource,
       correction_count AS correctionCount,
       client_action_id AS clientActionId,
       created_at AS createdAt
     FROM darts
     WHERE turn_id = ?
     ORDER BY dart_no ASC`,
    turnId,
  );
}

async function loadResult(db: GameDatabaseExecutor, gameId: string): Promise<CountUpResult | null> {
  const row = await db.getFirstAsync<{
    final_total_score: number;
    rounds_count: number;
    darts_thrown: number;
    bull_count: number;
    inner_bull_count: number;
    outer_bull_count: number;
    triple_count: number;
    double_count: number;
    miss_count: number;
    high_turn_score: number | null;
    low_turn_score: number | null;
    fully_manual_darts: number;
    manual_correction_count: number;
    extra_stats_json: string;
  }>(
    `SELECT
       final_total_score, rounds_count, darts_thrown, bull_count, inner_bull_count,
       outer_bull_count, triple_count, double_count, miss_count, high_turn_score,
       low_turn_score, fully_manual_darts, manual_correction_count, extra_stats_json
     FROM game_player_results
     WHERE game_id = ?
     LIMIT 1`,
    gameId,
  );

  if (!row) {
    return null;
  }

  const extra = JSON.parse(row.extra_stats_json || '{}') as { roundScores?: number[] };
  return {
    totalScore: row.final_total_score,
    roundAverageMilli: Math.round((row.final_total_score * 1000) / Math.max(row.rounds_count, 1)),
    dartAverageMilli:
      row.darts_thrown === 0 ? 0 : Math.round((row.final_total_score * 1000) / row.darts_thrown),
    bullCount: row.bull_count,
    innerBullCount: row.inner_bull_count,
    outerBullCount: row.outer_bull_count,
    tripleCount: row.triple_count,
    doubleCount: row.double_count,
    missCount: row.miss_count,
    highRoundScore: row.high_turn_score ?? 0,
    lowRoundScore: row.low_turn_score ?? 0,
    roundScores: extra.roundScores ?? [],
    dartsThrown: row.darts_thrown,
    fullyManualDarts: row.fully_manual_darts,
    correctionCount: row.manual_correction_count,
  };
}

async function completeGame(
  db: GameDatabaseExecutor,
  gameId: string,
  gamePlayerId: string,
  bullRule: BullRule,
  machineType: string | null,
  now: string,
) {
  const status = await db.getFirstAsync<{ status: string }>(
    `SELECT status FROM game_sessions WHERE id = ? LIMIT 1`,
    gameId,
  );

  if (status?.status === 'completed') {
    return;
  }

  const turns = await loadTurns(db, gameId);
  const result = summarizeCountUpGame(turns);
  const extraStats = {
    version: 1,
    roundScores: result.roundScores,
    roundAverageMilli: result.roundAverageMilli,
    dartAverageMilli: result.dartAverageMilli,
    inputSourceCounts: {
      manual_segment: result.fullyManualDarts,
    },
  };

  await db.runAsync(
    `UPDATE game_sessions
     SET status = 'completed', completed_at = ?, updated_at = ?, row_version = row_version + 1
     WHERE id = ?`,
    now,
    now,
    gameId,
  );

  await db.runAsync(
    `UPDATE game_players
     SET result = 'completed', updated_at = ?
     WHERE id = ?`,
    now,
    gamePlayerId,
  );

  await db.runAsync(
    `INSERT INTO game_player_results(
       game_id, game_player_id, result, rank_no, is_final, final_total_score,
       effective_score, rounds_count, turns_count, darts_thrown, bull_count,
       inner_bull_count, outer_bull_count, triple_count, double_count, miss_count,
       high_turn_score, low_turn_score, manual_correction_count, fully_manual_darts,
       extra_stats_json, calculation_version, created_at, updated_at
     )
     VALUES (?, ?, 'completed', 1, 1, ?, ?, 8, 8, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(game_id, game_player_id) DO UPDATE SET
       final_total_score = excluded.final_total_score,
       effective_score = excluded.effective_score,
       darts_thrown = excluded.darts_thrown,
       bull_count = excluded.bull_count,
       inner_bull_count = excluded.inner_bull_count,
       outer_bull_count = excluded.outer_bull_count,
       triple_count = excluded.triple_count,
       double_count = excluded.double_count,
       miss_count = excluded.miss_count,
       high_turn_score = excluded.high_turn_score,
       low_turn_score = excluded.low_turn_score,
       manual_correction_count = excluded.manual_correction_count,
       fully_manual_darts = excluded.fully_manual_darts,
       extra_stats_json = excluded.extra_stats_json,
       updated_at = excluded.updated_at`,
    gameId,
    gamePlayerId,
    result.totalScore,
    result.totalScore,
    result.dartsThrown,
    result.bullCount,
    result.innerBullCount,
    result.outerBullCount,
    result.tripleCount,
    result.doubleCount,
    result.missCount,
    result.highRoundScore,
    result.lowRoundScore,
    result.correctionCount,
    result.fullyManualDarts,
    JSON.stringify(extraStats),
    now,
    now,
  );

  const payload = {
    version: 1,
    gameId,
    completedAt: now,
    totalScore: result.totalScore,
    bullCount: result.bullCount,
    roundScores: result.roundScores,
    bullRule,
    machineType,
  };

  await db.runAsync(
    `INSERT OR IGNORE INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key,
       payload_json, status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'practice_record_upsert', 'game', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    createGameId(),
    gameId,
    `practice-record-upsert:${gameId}:completed`,
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
    gameId,
    `pending:${gameId}`,
    `count-up:${gameId}:completed`,
    now,
    now,
  );

  await appendDomainEvent(db, gameId, 'game_completed', { totalScore: result.totalScore });
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

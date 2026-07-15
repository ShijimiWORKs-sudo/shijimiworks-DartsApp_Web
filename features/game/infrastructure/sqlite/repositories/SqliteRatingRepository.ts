import type {
  RatingEvaluationApplyResult,
  RatingEvaluationRef,
  RatingRecalculationResult,
  RatingRepository,
  RatingSnapshotHistoryItem,
  RatingSourceLookup,
  RatingSourceResult,
} from '../../../application/ports';
import type {
  RatingMatchCompletionReason,
  RatingObservation,
  RatingProfileForUpdate,
  RatingSourceType,
  RatingUpdateAppliedOutput,
  RatingUpdateInput,
  RatingUpdateOutput,
} from '../../../domain/rating';
import { createGameId } from '../../../domain/ids';
import type { RatingSnapshot } from '../../../domain/types';
import { mapRatingSnapshotRow, type RatingSnapshotRow } from '../rowMappers/ratingMapper';
import { runGameDatabaseTransaction } from '../transaction';
import type { GameDatabaseConnection, GameDatabaseExecutor } from '../types';

type RatingEvaluationRow = {
  id: string;
  account_id: string;
  player_id: string;
  source_type: RatingSourceType;
  source_match_id: string | null;
  source_game_id: string | null;
  source_revision: number;
  status: 'pending' | 'eligible' | 'excluded' | 'applied' | 'invalidated';
  candidate_flag: number;
  match_result: 'win' | 'loss' | null;
  zero_one_ppd_milli: number | null;
  cricket_mpr_milli: number | null;
  total_darts: number;
  total_rounds: number;
  source_weight_milli: number;
  adjusted_darts: number;
  correction_count: number;
  input_payload_json: string;
  created_at: string;
  match_completion_reason: RatingMatchCompletionReason | null;
  match_completed_at: string | null;
  game_completion_reason: string | null;
  game_completed_at: string | null;
};

type RatingProfileRow = {
  account_id: string;
  owner_player_id: string;
  measurement_status: RatingProfileForUpdate['measurementStatus'];
  rating_tenths: number | null;
  precise_rating_milli: number | null;
  confidence_bp: number;
  eligible_match_count: number;
  eligible_standalone_zero_one_count: number;
  eligible_standalone_cricket_count: number;
  zero_one_index_milli: number | null;
  cricket_index_milli: number | null;
  match_index_milli: number | null;
  established_at: string | null;
};

type PreviousSnapshotRow = {
  id: string;
  rating_tenths: number | null;
  precise_rating_milli: number | null;
};

type RatingSnapshotHistoryRow = {
  id: string;
  account_id: string;
  player_id: string;
  evaluation_id: string | null;
  previous_snapshot_id: string | null;
  source_type: RatingSourceType;
  source_match_id: string | null;
  source_game_id: string | null;
  measurement_status: RatingProfileForUpdate['measurementStatus'];
  rating_tenths: number | null;
  previous_rating_tenths: number | null;
  precise_rating_milli: number | null;
  confidence_bp: number;
  evaluated_match_count: number;
  evaluated_standalone_zero_one_count: number;
  evaluated_standalone_cricket_count: number;
  zero_one_index_milli: number | null;
  cricket_index_milli: number | null;
  match_index_milli: number | null;
  applied_delta_milli: number | null;
  calculation_version: number;
  created_at: string;
  invalidated_at: string | null;
};

export class SqliteRatingRepository implements RatingRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLatestSnapshot(playerId: string): Promise<RatingSnapshot | null> {
    const row = await this.db.getFirstAsync<RatingSnapshotRow>(
      `SELECT
         id, player_id, evaluation_id, measurement_status, rating_tenths,
         confidence_bp, evaluated_match_count, created_at, invalidated_at
       FROM rating_snapshots
       WHERE player_id = ? AND invalidated_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      playerId,
    );
    return row ? mapRatingSnapshotRow(row) : null;
  }

  async listPendingEvaluationRefs(limit = 20): Promise<RatingEvaluationRef[]> {
    const rows = await this.db.getAllAsync<{ id: string; account_id: string }>(
      `SELECT id, account_id
       FROM rating_evaluations
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`,
      limit,
    );
    return rows.map((row) => ({ evaluationId: row.id, accountId: row.account_id }));
  }

  async listSnapshots(accountId: string): Promise<RatingSnapshotHistoryItem[]> {
    const rows = await this.db.getAllAsync<RatingSnapshotHistoryRow>(
      `${RATING_HISTORY_SELECT}
       WHERE s.account_id = ? AND s.invalidated_at IS NULL
       ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) DESC,
                s.created_at DESC,
                s.id DESC`,
      accountId,
    );
    return rows.map(mapSnapshotHistory);
  }

  async getSnapshotForEvaluation(evaluationId: string): Promise<RatingSnapshotHistoryItem | null> {
    const row = await this.db.getFirstAsync<RatingSnapshotHistoryRow>(
      `${RATING_HISTORY_SELECT}
       WHERE s.evaluation_id = ? AND s.invalidated_at IS NULL
       LIMIT 1`,
      evaluationId,
    );
    return row ? mapSnapshotHistory(row) : null;
  }

  async getLatestValidSnapshot(accountId: string): Promise<RatingSnapshotHistoryItem | null> {
    const row = await this.db.getFirstAsync<RatingSnapshotHistoryRow>(
      `${RATING_HISTORY_SELECT}
       WHERE s.account_id = ? AND s.invalidated_at IS NULL
       ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) DESC,
                s.created_at DESC,
                s.id DESC
       LIMIT 1`,
      accountId,
    );
    return row ? mapSnapshotHistory(row) : null;
  }

  async getRatingResultForSource(input: RatingSourceLookup): Promise<RatingSourceResult> {
    const evaluation = await loadEvaluationBySource(this.db, input);
    if (!evaluation) {
      return {
        status: 'not_target',
        label: 'Rating対象外',
        message:
          'このゲームまたはMATCHに対応するRating Evaluationはありません。対象条件外として保存されています。',
        reasonCode: 'NO_RATING_EVALUATION',
      };
    }

    const snapshot = await this.getSnapshotForEvaluation(evaluation.id);
    if (snapshot) {
      const initial =
        snapshot.sourceType === 'match' &&
        snapshot.evaluatedMatchCount === 3 &&
        snapshot.previousSnapshotId !== null;
      return {
        status: 'applied',
        label: initial ? '初回Rating確定' : '参考Rating更新',
        message: initial
          ? 'Eligible MATCH 3件に到達し、初回DartsApp Ratingを確定しました。'
          : 'DartsApp Ratingを更新しました。',
        evaluationId: evaluation.id,
        sourceType: evaluation.source_type,
        snapshot,
        isInitialEstablished: initial,
      };
    }

    if (evaluation.status === 'excluded') {
      const reasonCodes = await loadExclusionReasons(this.db, evaluation.id);
      return {
        status: 'excluded',
        label: 'Rating対象外',
        message: formatGeneralExclusionReason(reasonCodes),
        evaluationId: evaluation.id,
        sourceType: evaluation.source_type,
        reasonCodes,
      };
    }

    if (evaluation.status === 'applied') {
      return {
        status: 'not_target',
        label: 'Rating更新なし',
        message: 'Rating Snapshotが見つからないため、Rating更新は表示できません。',
        reasonCode: 'SNAPSHOT_NOT_FOUND',
      };
    }

    return {
      status: 'processing',
      label: '評価処理中',
      message: 'Rating評価を処理中です。しばらくしてから再度開くと結果が表示されます。',
      evaluationId: evaluation.id,
      sourceType: evaluation.source_type,
    };
  }

  async invalidateSnapshotsFrom(
    accountId: string,
    evaluatedAt: string,
    invalidatedAt = new Date().toISOString(),
  ): Promise<void> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await invalidateSnapshotsFromInTransaction(
        transaction,
        accountId,
        evaluatedAt,
        invalidatedAt,
      );
    });
  }

  async listLatestEvaluationsFrom(
    accountId: string,
    evaluatedAt: string,
  ): Promise<RatingEvaluationRef[]> {
    const rows = await listLatestEvaluationRowsFrom(this.db, accountId, evaluatedAt);
    return rows.map((row) => ({ evaluationId: row.id, accountId: row.account_id }));
  }

  async restoreProfileFromSnapshot(
    accountId: string,
    snapshot: RatingSnapshotHistoryItem,
    restoredAt = new Date().toISOString(),
  ): Promise<void> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await restoreProfileFromSnapshotInTransaction(transaction, accountId, snapshot, restoredAt);
    });
  }

  async clearProfileToUnmeasured(
    accountId: string,
    clearedAt = new Date().toISOString(),
  ): Promise<void> {
    await runGameDatabaseTransaction(this.db, async (transaction) => {
      await clearProfileToUnmeasuredInTransaction(transaction, accountId, clearedAt);
    });
  }

  async applyEvaluationUpdate(
    evaluationId: string,
    calculationDateTime: string,
    calculate: (input: RatingUpdateInput) => RatingUpdateOutput,
  ): Promise<RatingEvaluationApplyResult> {
    let result: RatingEvaluationApplyResult = {
      status: 'not_found',
      evaluationId,
      accountId: null,
    };

    await runGameDatabaseTransaction(this.db, async (transaction) => {
      result = await applyEvaluationUpdateInTransaction(
        transaction,
        evaluationId,
        calculationDateTime,
        calculate,
      );
    });

    return result;
  }

  async recalculateFromEvaluation(
    evaluationId: string,
    calculationDateTime: string,
    calculate: (input: RatingUpdateInput) => RatingUpdateOutput,
  ): Promise<RatingRecalculationResult> {
    let result: RatingRecalculationResult = {
      accountId: null,
      targetEvaluationId: evaluationId,
      invalidatedEvaluationIds: [],
      invalidatedSnapshotIds: [],
      replayedEvaluationIds: [],
      finalSnapshotId: null,
    };

    await runGameDatabaseTransaction(this.db, async (transaction) => {
      const target = await loadEvaluation(transaction, evaluationId);
      if (!target) {
        return;
      }

      const latest = await loadLatestEvaluationForSource(transaction, target);
      const replayTarget = latest ?? target;
      const anchor = getEvaluationObservedAt(replayTarget);
      const invalidatedEvaluationIds = await invalidateOlderRevisions(
        transaction,
        replayTarget,
        calculationDateTime,
      );
      const invalidatedSnapshotIds = await invalidateSnapshotsFromInTransaction(
        transaction,
        replayTarget.account_id,
        anchor,
        calculationDateTime,
      );
      const previousSnapshot = await loadLatestHistorySnapshot(
        transaction,
        replayTarget.account_id,
      );

      if (previousSnapshot) {
        await restoreProfileFromSnapshotInTransaction(
          transaction,
          replayTarget.account_id,
          previousSnapshot,
          calculationDateTime,
        );
      } else {
        await clearProfileToUnmeasuredInTransaction(
          transaction,
          replayTarget.account_id,
          calculationDateTime,
        );
      }

      const replayRows = await listLatestEvaluationRowsFrom(
        transaction,
        replayTarget.account_id,
        anchor,
      );
      for (const row of replayRows) {
        await transaction.runAsync(
          `UPDATE rating_evaluations
           SET status = 'pending',
               evaluated_at = NULL,
               applied_at = NULL
           WHERE id = ? AND status IN ('eligible', 'applied')`,
          row.id,
        );
      }

      const replayedEvaluationIds: string[] = [];
      let finalSnapshotId: string | null = previousSnapshot?.id ?? null;
      for (const row of replayRows) {
        const applied = await applyEvaluationUpdateInTransaction(
          transaction,
          row.id,
          calculationDateTime,
          calculate,
        );
        if (applied.status === 'applied' || applied.status === 'excluded') {
          replayedEvaluationIds.push(row.id);
        }
        if (applied.status === 'applied') {
          const snapshot = await loadSnapshotIdForEvaluation(transaction, row.id);
          finalSnapshotId = snapshot?.id ?? finalSnapshotId;
        }
      }

      result = {
        accountId: replayTarget.account_id,
        targetEvaluationId: replayTarget.id,
        invalidatedEvaluationIds,
        invalidatedSnapshotIds,
        replayedEvaluationIds,
        finalSnapshotId,
      };
    });

    return result;
  }
}

const RATING_HISTORY_SELECT = `
SELECT
  s.id,
  s.account_id,
  s.player_id,
  s.evaluation_id,
  s.previous_snapshot_id,
  s.source_type,
  e.source_match_id,
  e.source_game_id,
  s.measurement_status,
  s.rating_tenths,
  ps.rating_tenths AS previous_rating_tenths,
  s.precise_rating_milli,
  s.confidence_bp,
  s.evaluated_match_count,
  s.evaluated_standalone_zero_one_count,
  s.evaluated_standalone_cricket_count,
  s.zero_one_index_milli,
  s.cricket_index_milli,
  s.match_index_milli,
  s.applied_delta_milli,
  s.calculation_version,
  s.created_at,
  s.invalidated_at
FROM rating_snapshots s
LEFT JOIN rating_snapshots ps ON ps.id = s.previous_snapshot_id
LEFT JOIN rating_evaluations e ON e.id = s.evaluation_id
LEFT JOIN matches m ON m.id = e.source_match_id
LEFT JOIN game_sessions g ON g.id = e.source_game_id`;

async function applyEvaluationUpdateInTransaction(
  transaction: GameDatabaseExecutor,
  evaluationId: string,
  calculationDateTime: string,
  calculate: (input: RatingUpdateInput) => RatingUpdateOutput,
): Promise<RatingEvaluationApplyResult> {
  const existingSnapshot = await transaction.getFirstAsync<{ id: string; account_id: string }>(
    `SELECT id, account_id
     FROM rating_snapshots
     WHERE evaluation_id = ? AND invalidated_at IS NULL
     LIMIT 1`,
    evaluationId,
  );
  if (existingSnapshot) {
    return {
      status: 'already_applied',
      evaluationId,
      accountId: existingSnapshot.account_id,
    };
  }

  const target = await loadEvaluation(transaction, evaluationId);
  if (!target) {
    return { status: 'not_found', evaluationId, accountId: null };
  }
  if (target.status === 'applied') {
    return {
      status: 'already_applied',
      evaluationId,
      accountId: target.account_id,
    };
  }
  if (target.status !== 'pending' && target.status !== 'eligible') {
    return {
      status: 'skipped',
      evaluationId,
      accountId: target.account_id,
      reasonCodes: [`STATUS_${target.status.toUpperCase()}`],
    };
  }

  const revisionReason = await findRevisionExclusion(transaction, target);
  const profile = await loadRatingProfile(transaction, target.account_id);
  const ownershipReason =
    !profile || profile.owner_player_id !== target.player_id ? 'OWNER_NOT_LINKED' : null;

  if (target.candidate_flag !== 1 || revisionReason || ownershipReason || !profile) {
    const reasons = [
      target.candidate_flag !== 1 ? 'CANDIDATE_FLAG_DISABLED' : null,
      revisionReason,
      ownershipReason,
      !profile ? 'RATING_PROFILE_NOT_FOUND' : null,
    ].filter((reason): reason is string => reason !== null);
    await markExcluded(transaction, target, reasons, calculationDateTime);
    return {
      status: 'excluded',
      evaluationId,
      accountId: target.account_id,
      reasonCodes: reasons,
    };
  }

  const input = await buildRatingUpdateInput(transaction, target, profile, calculationDateTime);
  const output = calculate(input);

  if (output.kind === 'excluded') {
    await markExcluded(transaction, target, output.reasonCodes, calculationDateTime);
    return {
      status: 'excluded',
      evaluationId,
      accountId: target.account_id,
      reasonCodes: output.reasonCodes,
    };
  }

  await markEligible(transaction, target, calculationDateTime);
  await insertSnapshot(transaction, output, calculationDateTime);
  await updateProfile(transaction, output, calculationDateTime);
  await markApplied(transaction, output, calculationDateTime);
  await markRatingOutboxProcessed(transaction, output, calculationDateTime);
  return {
    status: 'applied',
    evaluationId,
    accountId: target.account_id,
  };
}

async function buildRatingUpdateInput(
  db: GameDatabaseExecutor,
  target: RatingEvaluationRow,
  profile: RatingProfileRow,
  calculationDateTime: string,
): Promise<RatingUpdateInput> {
  const rows = await loadObservationRows(db, target);
  const previousSnapshot = await db.getFirstAsync<PreviousSnapshotRow>(
    `SELECT s.id, s.rating_tenths, s.precise_rating_milli
     FROM rating_snapshots s
     LEFT JOIN rating_evaluations e ON e.id = s.evaluation_id
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE s.account_id = ? AND s.invalidated_at IS NULL
     ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) DESC,
              s.created_at DESC,
              s.id DESC
     LIMIT 1`,
    target.account_id,
  );

  return {
    targetEvaluationId: target.id,
    calculationDateTime,
    profile: mapProfile(profile),
    previousSnapshot: previousSnapshot
      ? {
          id: previousSnapshot.id,
          ratingTenths: previousSnapshot.rating_tenths,
          preciseRatingMilli: previousSnapshot.precise_rating_milli,
        }
      : null,
    observations: rows.map(mapObservation),
  };
}

async function loadObservationRows(
  db: GameDatabaseExecutor,
  target: RatingEvaluationRow,
): Promise<RatingEvaluationRow[]> {
  return db.getAllAsync<RatingEvaluationRow>(
    `SELECT e.*,
            m.completion_reason AS match_completion_reason,
            m.completed_at AS match_completed_at,
            g.completion_reason AS game_completion_reason,
            g.completed_at AS game_completed_at
     FROM rating_evaluations e
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE e.account_id = ?
       AND e.candidate_flag = 1
       AND e.status IN ('applied', 'eligible', 'pending')
       AND e.created_at <= ?
       AND e.source_revision = (
         SELECT MAX(e2.source_revision)
         FROM rating_evaluations e2
         WHERE e2.account_id = e.account_id
           AND e2.source_type = e.source_type
           AND COALESCE(e2.source_match_id, '') = COALESCE(e.source_match_id, '')
           AND COALESCE(e2.source_game_id, '') = COALESCE(e.source_game_id, '')
       )
       AND (e.status = 'applied' OR e.id = ?)
     ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at) ASC, e.created_at ASC`,
    target.account_id,
    target.created_at,
    target.id,
  );
}

async function loadEvaluation(
  db: GameDatabaseExecutor,
  evaluationId: string,
): Promise<RatingEvaluationRow | null> {
  return db.getFirstAsync<RatingEvaluationRow>(
    `SELECT e.*,
            m.completion_reason AS match_completion_reason,
            m.completed_at AS match_completed_at,
            g.completion_reason AS game_completion_reason,
            g.completed_at AS game_completed_at
     FROM rating_evaluations e
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE e.id = ?
     LIMIT 1`,
    evaluationId,
  );
}

async function loadEvaluationBySource(
  db: GameDatabaseExecutor,
  input: RatingSourceLookup,
): Promise<RatingEvaluationRow | null> {
  if (input.sourceMatchId !== undefined) {
    return db.getFirstAsync<RatingEvaluationRow>(
      `SELECT e.*,
              m.completion_reason AS match_completion_reason,
              m.completed_at AS match_completed_at,
              g.completion_reason AS game_completion_reason,
              g.completed_at AS game_completed_at
       FROM rating_evaluations e
       LEFT JOIN matches m ON m.id = e.source_match_id
       LEFT JOIN game_sessions g ON g.id = e.source_game_id
       WHERE e.source_match_id = ?
       ORDER BY e.source_revision DESC, e.created_at DESC
       LIMIT 1`,
      input.sourceMatchId,
    );
  }

  return db.getFirstAsync<RatingEvaluationRow>(
    `SELECT e.*,
            m.completion_reason AS match_completion_reason,
            m.completed_at AS match_completed_at,
            g.completion_reason AS game_completion_reason,
            g.completed_at AS game_completed_at
     FROM rating_evaluations e
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE e.source_game_id = ?
     ORDER BY e.source_revision DESC, e.created_at DESC
     LIMIT 1`,
    input.sourceGameId,
  );
}

async function loadRatingProfile(
  db: GameDatabaseExecutor,
  accountId: string,
): Promise<RatingProfileRow | null> {
  return db.getFirstAsync<RatingProfileRow>(
    `SELECT account_id, owner_player_id, measurement_status, rating_tenths,
            precise_rating_milli, confidence_bp, eligible_match_count,
            eligible_standalone_zero_one_count, eligible_standalone_cricket_count,
            zero_one_index_milli, cricket_index_milli, match_index_milli,
            established_at
     FROM rating_profiles
     WHERE account_id = ?
     LIMIT 1`,
    accountId,
  );
}

async function findRevisionExclusion(db: GameDatabaseExecutor, target: RatingEvaluationRow) {
  const latest = await db.getFirstAsync<{ source_revision: number }>(
    `SELECT MAX(source_revision) AS source_revision
     FROM rating_evaluations
     WHERE account_id = ?
       AND source_type = ?
       AND COALESCE(source_match_id, '') = COALESCE(?, '')
       AND COALESCE(source_game_id, '') = COALESCE(?, '')`,
    target.account_id,
    target.source_type,
    target.source_match_id,
    target.source_game_id,
  );
  return latest && latest.source_revision > target.source_revision ? 'SUPERSEDED_REVISION' : null;
}

async function loadLatestEvaluationForSource(
  db: GameDatabaseExecutor,
  target: RatingEvaluationRow,
): Promise<RatingEvaluationRow | null> {
  return db.getFirstAsync<RatingEvaluationRow>(
    `SELECT e.*,
            m.completion_reason AS match_completion_reason,
            m.completed_at AS match_completed_at,
            g.completion_reason AS game_completion_reason,
            g.completed_at AS game_completed_at
     FROM rating_evaluations e
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE e.account_id = ?
       AND e.source_type = ?
       AND COALESCE(e.source_match_id, '') = COALESCE(?, '')
       AND COALESCE(e.source_game_id, '') = COALESCE(?, '')
     ORDER BY e.source_revision DESC, e.created_at DESC
     LIMIT 1`,
    target.account_id,
    target.source_type,
    target.source_match_id,
    target.source_game_id,
  );
}

async function invalidateOlderRevisions(
  db: GameDatabaseExecutor,
  target: RatingEvaluationRow,
  invalidatedAt: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id
     FROM rating_evaluations
     WHERE account_id = ?
       AND source_type = ?
       AND COALESCE(source_match_id, '') = COALESCE(?, '')
       AND COALESCE(source_game_id, '') = COALESCE(?, '')
       AND source_revision < ?
       AND status != 'invalidated'`,
    target.account_id,
    target.source_type,
    target.source_match_id,
    target.source_game_id,
    target.source_revision,
  );

  for (const row of rows) {
    await db.runAsync(
      `UPDATE rating_evaluations
       SET status = 'invalidated',
           invalidated_at = COALESCE(invalidated_at, ?)
       WHERE id = ?`,
      invalidatedAt,
      row.id,
    );
  }

  return rows.map((row) => row.id);
}

async function invalidateSnapshotsFromInTransaction(
  db: GameDatabaseExecutor,
  accountId: string,
  evaluatedAt: string,
  invalidatedAt: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT s.id
     FROM rating_snapshots s
     LEFT JOIN rating_evaluations e ON e.id = s.evaluation_id
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE s.account_id = ?
       AND s.invalidated_at IS NULL
       AND COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) >= ?
     ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) ASC,
              e.created_at ASC,
              e.id ASC`,
    accountId,
    evaluatedAt,
  );

  for (const row of rows) {
    await db.runAsync(
      `UPDATE rating_snapshots
       SET invalidated_at = COALESCE(invalidated_at, ?),
           evaluation_id = NULL
       WHERE id = ?`,
      invalidatedAt,
      row.id,
    );
  }

  return rows.map((row) => row.id);
}

async function listLatestEvaluationRowsFrom(
  db: GameDatabaseExecutor,
  accountId: string,
  evaluatedAt: string,
): Promise<RatingEvaluationRow[]> {
  return db.getAllAsync<RatingEvaluationRow>(
    `SELECT e.*,
            m.completion_reason AS match_completion_reason,
            m.completed_at AS match_completed_at,
            g.completion_reason AS game_completion_reason,
            g.completed_at AS game_completed_at
     FROM rating_evaluations e
     LEFT JOIN matches m ON m.id = e.source_match_id
     LEFT JOIN game_sessions g ON g.id = e.source_game_id
     WHERE e.account_id = ?
       AND e.status IN ('pending', 'eligible', 'applied')
       AND COALESCE(m.completed_at, g.completed_at, e.created_at) >= ?
       AND e.source_revision = (
         SELECT MAX(e2.source_revision)
         FROM rating_evaluations e2
         WHERE e2.account_id = e.account_id
           AND e2.source_type = e.source_type
           AND COALESCE(e2.source_match_id, '') = COALESCE(e.source_match_id, '')
           AND COALESCE(e2.source_game_id, '') = COALESCE(e.source_game_id, '')
       )
     ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at) ASC,
              e.created_at ASC,
              e.id ASC`,
    accountId,
    evaluatedAt,
  );
}

async function loadLatestHistorySnapshot(
  db: GameDatabaseExecutor,
  accountId: string,
): Promise<RatingSnapshotHistoryItem | null> {
  const row = await db.getFirstAsync<RatingSnapshotHistoryRow>(
    `${RATING_HISTORY_SELECT}
     WHERE s.account_id = ? AND s.invalidated_at IS NULL
     ORDER BY COALESCE(m.completed_at, g.completed_at, e.created_at, s.created_at) DESC,
              s.created_at DESC,
              s.id DESC
     LIMIT 1`,
    accountId,
  );
  return row ? mapSnapshotHistory(row) : null;
}

async function loadSnapshotIdForEvaluation(
  db: GameDatabaseExecutor,
  evaluationId: string,
): Promise<{ id: string } | null> {
  return db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM rating_snapshots
     WHERE evaluation_id = ? AND invalidated_at IS NULL
     LIMIT 1`,
    evaluationId,
  );
}

async function restoreProfileFromSnapshotInTransaction(
  db: GameDatabaseExecutor,
  accountId: string,
  snapshot: RatingSnapshotHistoryItem,
  restoredAt: string,
) {
  const establishedAt = snapshot.evaluatedMatchCount >= 3 ? snapshot.createdAt : null;
  await db.runAsync(
    `UPDATE rating_profiles
     SET measurement_status = ?,
         rating_tenths = ?,
         precise_rating_milli = ?,
         confidence_bp = ?,
         eligible_match_count = ?,
         eligible_standalone_zero_one_count = ?,
         eligible_standalone_cricket_count = ?,
         zero_one_index_milli = ?,
         cricket_index_milli = ?,
         match_index_milli = ?,
         calculation_version = ?,
         established_at = ?,
         last_evaluated_at = ?,
         updated_at = ?
     WHERE account_id = ?`,
    snapshot.measurementStatus,
    snapshot.ratingTenths,
    snapshot.preciseRatingMilli,
    snapshot.confidenceBp,
    snapshot.evaluatedMatchCount,
    snapshot.evaluatedStandaloneZeroOneCount,
    snapshot.evaluatedStandaloneCricketCount,
    snapshot.zeroOneIndexMilli,
    snapshot.cricketIndexMilli,
    snapshot.matchIndexMilli,
    snapshot.calculationVersion,
    establishedAt,
    snapshot.createdAt,
    restoredAt,
    accountId,
  );
}

async function clearProfileToUnmeasuredInTransaction(
  db: GameDatabaseExecutor,
  accountId: string,
  clearedAt: string,
) {
  await db.runAsync(
    `UPDATE rating_profiles
     SET measurement_status = 'unmeasured',
         rating_tenths = NULL,
         precise_rating_milli = NULL,
         confidence_bp = 0,
         eligible_match_count = 0,
         eligible_standalone_zero_one_count = 0,
         eligible_standalone_cricket_count = 0,
         zero_one_index_milli = NULL,
         cricket_index_milli = NULL,
         match_index_milli = NULL,
         calculation_version = 2,
         established_at = NULL,
         last_evaluated_at = NULL,
         updated_at = ?
     WHERE account_id = ?`,
    clearedAt,
    accountId,
  );
}

function mapObservation(row: RatingEvaluationRow): RatingObservation {
  const payload = parsePayload(row.input_payload_json);
  return {
    evaluationId: row.id,
    accountId: row.account_id,
    playerId: row.player_id,
    sourceType: row.source_type,
    sourceMatchId: row.source_match_id,
    sourceGameId: row.source_game_id,
    sourceRevision: row.source_revision,
    sourceWeightMilli: row.source_weight_milli,
    observedAt: row.match_completed_at ?? row.game_completed_at ?? row.created_at,
    matchResult: row.match_result,
    matchCompletionReason: row.match_completion_reason,
    manualOutcomeAdjustment: payload.manualOutcomeAdjustment === true,
    zeroOnePpdMilli: row.zero_one_ppd_milli,
    cricketMprMilli: row.cricket_mpr_milli,
    totalDarts: row.total_darts,
    totalRounds: row.total_rounds,
    adjustedDarts: row.adjusted_darts,
    correctionCount: row.correction_count,
    cricketClearFlag: payload.clearFlag === true,
    cricketFinalScore:
      typeof payload.finalCricketScore === 'number' ? payload.finalCricketScore : null,
  };
}

function getEvaluationObservedAt(row: RatingEvaluationRow) {
  return row.match_completed_at ?? row.game_completed_at ?? row.created_at;
}

function mapProfile(row: RatingProfileRow): RatingProfileForUpdate {
  return {
    accountId: row.account_id,
    ownerPlayerId: row.owner_player_id,
    measurementStatus: row.measurement_status,
    ratingTenths: row.rating_tenths,
    preciseRatingMilli: row.precise_rating_milli,
    confidenceBp: row.confidence_bp,
    eligibleMatchCount: row.eligible_match_count,
    eligibleStandaloneZeroOneCount: row.eligible_standalone_zero_one_count,
    eligibleStandaloneCricketCount: row.eligible_standalone_cricket_count,
    zeroOneIndexMilli: row.zero_one_index_milli,
    cricketIndexMilli: row.cricket_index_milli,
    matchIndexMilli: row.match_index_milli,
    establishedAt: row.established_at,
  };
}

function mapSnapshotHistory(row: RatingSnapshotHistoryRow): RatingSnapshotHistoryItem {
  return {
    id: row.id,
    accountId: row.account_id,
    playerId: row.player_id,
    evaluationId: row.evaluation_id,
    previousSnapshotId: row.previous_snapshot_id,
    sourceType: row.source_type,
    sourceMatchId: row.source_match_id,
    sourceGameId: row.source_game_id,
    measurementStatus: row.measurement_status,
    ratingTenths: row.rating_tenths,
    previousRatingTenths: row.previous_rating_tenths,
    preciseRatingMilli: row.precise_rating_milli,
    confidenceBp: row.confidence_bp,
    evaluatedMatchCount: row.evaluated_match_count,
    evaluatedStandaloneZeroOneCount: row.evaluated_standalone_zero_one_count,
    evaluatedStandaloneCricketCount: row.evaluated_standalone_cricket_count,
    zeroOneIndexMilli: row.zero_one_index_milli,
    cricketIndexMilli: row.cricket_index_milli,
    matchIndexMilli: row.match_index_milli,
    appliedDeltaMilli: row.applied_delta_milli,
    calculationVersion: row.calculation_version,
    createdAt: row.created_at,
    invalidatedAt: row.invalidated_at,
  };
}

async function loadExclusionReasons(
  db: GameDatabaseExecutor,
  evaluationId: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ reason_code: string }>(
    `SELECT reason_code
     FROM rating_evaluation_exclusions
     WHERE evaluation_id = ?
     ORDER BY reason_code ASC`,
    evaluationId,
  );
  return rows.map((row) => row.reason_code);
}

function formatGeneralExclusionReason(reasonCodes: string[]) {
  if (reasonCodes.includes('INITIAL_RATING_NOT_ESTABLISHED')) {
    return '初回Ratingがまだ確定していないため、Rating計算には使用されませんでした。';
  }
  if (reasonCodes.includes('GAME_BEFORE_RATING_ESTABLISHED')) {
    return '初回Rating確定前に開始したゲームのため、Rating計算には使用されませんでした。';
  }
  if (reasonCodes.includes('OWNER_NOT_LINKED')) {
    return 'Rating所有者と一致しないPlayerのため、Rating計算には使用されませんでした。';
  }
  if (reasonCodes.includes('INVALID_CRICKET_ZERO_POINT_CLEAR')) {
    return '0点で自然終了したCRICKETとして検出されたため、Rating計算から除外しました。';
  }
  if (reasonCodes.includes('SUPERSEDED_REVISION')) {
    return '新しい評価リビジョンがあるため、古い評価はRating計算から除外しました。';
  }
  if (reasonCodes.length > 0) {
    return 'Rating対象条件を満たさなかったため、Rating計算には使用されませんでした。';
  }
  return 'Rating対象外として保存されています。';
}

async function markEligible(db: GameDatabaseExecutor, target: RatingEvaluationRow, now: string) {
  await db.runAsync(
    `UPDATE rating_evaluations
     SET status = 'eligible',
         evaluated_at = COALESCE(evaluated_at, ?)
     WHERE id = ? AND status IN ('pending', 'eligible')`,
    now,
    target.id,
  );
}

async function markApplied(
  db: GameDatabaseExecutor,
  output: RatingUpdateAppliedOutput,
  now: string,
) {
  await db.runAsync(
    `UPDATE rating_evaluations
     SET status = 'applied',
         applied_at = COALESCE(applied_at, ?)
     WHERE id = ? AND status = 'eligible'`,
    now,
    output.evaluationId,
  );
}

async function markExcluded(
  db: GameDatabaseExecutor,
  target: RatingEvaluationRow,
  reasonCodes: string[],
  now: string,
) {
  await db.runAsync(
    `UPDATE rating_evaluations
     SET status = 'excluded',
         evaluated_at = COALESCE(evaluated_at, ?)
     WHERE id = ? AND status IN ('pending', 'eligible')`,
    now,
    target.id,
  );
  for (const reasonCode of reasonCodes) {
    await db.runAsync(
      `INSERT OR IGNORE INTO rating_evaluation_exclusions(
         evaluation_id, reason_code, detail, created_at
       )
       VALUES (?, ?, NULL, ?)`,
      target.id,
      reasonCode,
      now,
    );
  }
  await markOutboxProcessedBySource(db, target.source_match_id, target.source_game_id, now);
}

async function insertSnapshot(
  db: GameDatabaseExecutor,
  output: RatingUpdateAppliedOutput,
  now: string,
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO rating_snapshots(
       id, account_id, player_id, evaluation_id, previous_snapshot_id, source_type,
       measurement_status, rating_tenths, precise_rating_milli, confidence_bp,
       evaluated_match_count, evaluated_standalone_zero_one_count,
       evaluated_standalone_cricket_count, window_match_count,
       window_zero_one_observation_count, window_cricket_observation_count,
       zero_one_index_milli, cricket_index_milli, match_index_milli,
       stability_adjustment_milli, continuity_bonus_milli, applied_delta_milli,
       calculation_version, calculation_detail_json, created_at, invalidated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?, NULL)`,
    createGameId(),
    output.accountId,
    output.playerId,
    output.evaluationId,
    output.previousSnapshotId,
    output.sourceType,
    output.measurementStatus,
    output.ratingTenths,
    output.preciseRatingMilli,
    output.confidenceBp,
    output.evaluatedMatchCount,
    output.evaluatedStandaloneZeroOneCount,
    output.evaluatedStandaloneCricketCount,
    output.windowMatchCount,
    output.windowZeroOneObservationCount,
    output.windowCricketObservationCount,
    output.zeroOneIndexMilli,
    output.cricketIndexMilli,
    output.matchIndexMilli,
    output.stabilityAdjustmentMilli,
    output.continuityBonusMilli,
    output.appliedDeltaMilli,
    output.calculationDetailJson,
    now,
  );
}

async function updateProfile(
  db: GameDatabaseExecutor,
  output: RatingUpdateAppliedOutput,
  now: string,
) {
  await db.runAsync(
    `UPDATE rating_profiles
     SET measurement_status = ?,
         rating_tenths = ?,
         precise_rating_milli = ?,
         confidence_bp = ?,
         eligible_match_count = ?,
         eligible_standalone_zero_one_count = ?,
         eligible_standalone_cricket_count = ?,
         zero_one_index_milli = ?,
         cricket_index_milli = ?,
         match_index_milli = ?,
         calculation_version = 2,
         established_at = ?,
         last_evaluated_at = ?,
         updated_at = ?
     WHERE account_id = ?`,
    output.measurementStatus,
    output.ratingTenths,
    output.preciseRatingMilli,
    output.confidenceBp,
    output.evaluatedMatchCount,
    output.evaluatedStandaloneZeroOneCount,
    output.evaluatedStandaloneCricketCount,
    output.zeroOneIndexMilli,
    output.cricketIndexMilli,
    output.matchIndexMilli,
    output.establishedAt,
    now,
    now,
    output.accountId,
  );
}

async function markRatingOutboxProcessed(
  db: GameDatabaseExecutor,
  output: RatingUpdateAppliedOutput,
  now: string,
) {
  await markOutboxProcessedBySource(db, output.sourceMatchId, output.sourceGameId, now);
}

async function markOutboxProcessedBySource(
  db: GameDatabaseExecutor,
  sourceMatchId: string | null,
  sourceGameId: string | null,
  now: string,
) {
  const aggregateId = sourceMatchId ?? sourceGameId;
  if (!aggregateId) return;
  await db.runAsync(
    `UPDATE integration_outbox
     SET status = 'completed',
         processed_at = COALESCE(processed_at, ?),
         updated_at = ?
     WHERE event_type = 'rating_recalculate'
       AND aggregate_id = ?
       AND status = 'pending'`,
    now,
    now,
    aggregateId,
  );
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

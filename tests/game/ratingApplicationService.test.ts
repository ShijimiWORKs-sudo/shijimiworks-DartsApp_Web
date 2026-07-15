import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAccountService } from '../../features/account/index';
import { RatingApplicationService } from '../../features/game/application/services/index';
import { SqliteRatingRepository } from '../../features/game/infrastructure/sqlite/repositories/index';
import type { GameDatabaseConnection } from '../../features/game/infrastructure/sqlite/types';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

const NOW = '2026-07-15T00:00:00.000Z';

test('rating application applies three pending MATCH evaluations into snapshots and profile', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const fixture = await createRatingFixture(db);
    await seedMatchEvaluation(db, fixture, {
      index: 1,
      completedAt: '2026-07-10T00:00:00.000Z',
      ppdMilli: 20_000,
      mprMilli: 1_800,
      result: 'win',
      completionReason: 'two_zero',
    });
    await seedMatchEvaluation(db, fixture, {
      index: 2,
      completedAt: '2026-07-11T00:00:00.000Z',
      ppdMilli: 21_000,
      mprMilli: 2_000,
      result: 'loss',
      completionReason: 'two_one',
    });
    await seedMatchEvaluation(db, fixture, {
      index: 3,
      completedAt: '2026-07-12T00:00:00.000Z',
      ppdMilli: 22_000,
      mprMilli: 2_100,
      result: 'win',
      completionReason: 'two_zero',
    });

    const service = new RatingApplicationService(new SqliteRatingRepository(db), () => NOW);
    const results = await service.processPending({ calculationDateTime: NOW });

    assert.deepEqual(
      results.map((result) => result.status),
      ['applied', 'applied', 'applied'],
    );

    const profile = await db.getFirstAsync<{
      measurement_status: string;
      eligible_match_count: number;
      established_at: string | null;
      rating_tenths: number | null;
      calculation_version: number;
    }>('SELECT * FROM rating_profiles WHERE account_id = ?', fixture.accountId);
    assert.equal(profile?.measurement_status, 'provisional');
    assert.equal(profile?.eligible_match_count, 3);
    assert.equal(profile?.established_at, '2026-07-12T00:00:00.000Z');
    assert.ok(profile?.rating_tenths !== null);
    assert.equal(profile?.calculation_version, 2);

    const snapshots = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM rating_snapshots WHERE account_id = ?',
      fixture.accountId,
    );
    assert.equal(snapshots?.count, 3);

    const outbox = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM integration_outbox
       WHERE event_type = 'rating_recalculate' AND status = 'completed'`,
    );
    assert.equal(outbox?.count, 3);

    const repeated = await service.processPending({ calculationDateTime: NOW });
    assert.equal(repeated.length, 0);
  } finally {
    db.close();
  }
});

test('standalone 01 application keeps Cricket and Match Index unchanged and caps rating delta', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const fixture = await createRatingFixture(db);
    await db.runAsync(
      `UPDATE rating_profiles
       SET measurement_status = 'provisional',
           rating_tenths = 70,
           precise_rating_milli = 7000,
           confidence_bp = 6000,
           eligible_match_count = 3,
           zero_one_index_milli = 7000,
           cricket_index_milli = 7000,
           match_index_milli = 7000,
           established_at = ?,
           updated_at = ?
       WHERE account_id = ?`,
      '2026-07-12T00:00:00.000Z',
      NOW,
      fixture.accountId,
    );
    await seedStandaloneEvaluation(db, fixture, {
      id: 'standalone-zero-one-1',
      sourceType: 'standalone_zero_one',
      completedAt: '2026-07-13T00:00:00.000Z',
      ppdMilli: 42_000,
      mprMilli: null,
    });

    const service = new RatingApplicationService(new SqliteRatingRepository(db), () => NOW);
    const result = await service.applyEvaluation('eval-standalone-zero-one-1', NOW);

    assert.equal(result.status, 'applied');
    const profile = await db.getFirstAsync<{
      zero_one_index_milli: number | null;
      cricket_index_milli: number | null;
      match_index_milli: number | null;
      eligible_standalone_zero_one_count: number;
    }>('SELECT * FROM rating_profiles WHERE account_id = ?', fixture.accountId);
    assert.notEqual(profile?.zero_one_index_milli, 7_000);
    assert.equal(profile?.cricket_index_milli, 7_000);
    assert.equal(profile?.match_index_milli, 7_000);
    assert.equal(profile?.eligible_standalone_zero_one_count, 1);

    const snapshot = await db.getFirstAsync<{ applied_delta_milli: number | null }>(
      `SELECT applied_delta_milli
       FROM rating_snapshots
       WHERE evaluation_id = 'eval-standalone-zero-one-1'`,
    );
    assert.ok(Math.abs(snapshot?.applied_delta_milli ?? 0) <= 200);
  } finally {
    db.close();
  }
});

test('rating application excludes GUEST or owner-mismatched evaluations without creating snapshots', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const fixture = await createRatingFixture(db);
    await seedStandaloneEvaluation(db, fixture, {
      id: 'guest-zero-one-1',
      sourceType: 'standalone_zero_one',
      completedAt: '2026-07-13T00:00:00.000Z',
      ppdMilli: 30_000,
      mprMilli: null,
      playerId: fixture.guestPlayerId,
    });

    const service = new RatingApplicationService(new SqliteRatingRepository(db), () => NOW);
    const result = await service.applyEvaluation('eval-guest-zero-one-1', NOW);

    assert.equal(result.status, 'excluded');
    assert.deepEqual(result.reasonCodes, ['OWNER_NOT_LINKED']);

    const snapshots = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM rating_snapshots
       WHERE evaluation_id = 'eval-guest-zero-one-1'`,
    );
    assert.equal(snapshots?.count, 0);
  } finally {
    db.close();
  }
});

async function createRatingFixture(db: GameDatabaseConnection) {
  const account = await createAccountService(db).registerLocalAccount({
    userName: 'rating_owner',
    displayName: 'Rating Owner',
  });
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived, created_at, updated_at
     )
     VALUES ('guest-rating', 'guest', 'Guest', 'unknown', 0, ?, ?)`,
    NOW,
    NOW,
  );
  return {
    accountId: account.account.id,
    ownerPlayerId: account.ownerPlayer.id,
    guestPlayerId: 'guest-rating',
  };
}

async function seedMatchEvaluation(
  db: GameDatabaseConnection,
  fixture: Awaited<ReturnType<typeof createRatingFixture>>,
  input: {
    index: number;
    completedAt: string;
    ppdMilli: number;
    mprMilli: number;
    result: 'win' | 'loss';
    completionReason: 'two_zero' | 'two_one';
  },
) {
  const matchId = `match-rating-${input.index}`;
  const evaluationId = `eval-match-rating-${input.index}`;
  await db.runAsync(
    `INSERT INTO matches(
       id, status, zero_one_start_score, out_rule, bull_rule, current_game_no,
       winner_player_id, loser_player_id, completion_reason, started_at,
       completed_at, created_at, updated_at
     )
     VALUES (?, 'completed', 501, 'single_out', 'fat_bull', 2, ?, ?, ?, ?, ?, ?, ?)`,
    matchId,
    input.result === 'win' ? fixture.ownerPlayerId : fixture.guestPlayerId,
    input.result === 'win' ? fixture.guestPlayerId : fixture.ownerPlayerId,
    input.completionReason,
    input.completedAt,
    input.completedAt,
    input.completedAt,
    input.completedAt,
  );
  await db.runAsync(
    `INSERT INTO rating_evaluations(
       id, account_id, player_id, source_type, source_match_id, source_game_id,
       source_revision, status, candidate_flag, match_result, zero_one_game_count,
       zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
       total_rounds, source_weight_milli, adjusted_darts, correction_count,
       input_payload_json, created_at
     )
     VALUES (?, ?, ?, 'match', ?, NULL, 1, 'pending', 1, ?, 1, ?, 1, ?, 45, 15,
             1000, 0, 0, ?, ?)`,
    evaluationId,
    fixture.accountId,
    fixture.ownerPlayerId,
    matchId,
    input.result,
    input.ppdMilli,
    input.mprMilli,
    JSON.stringify({ manualOutcomeAdjustment: false }),
    input.completedAt,
  );
  await seedRatingOutbox(db, `outbox-${evaluationId}`, matchId, input.completedAt);
}

async function seedStandaloneEvaluation(
  db: GameDatabaseConnection,
  fixture: Awaited<ReturnType<typeof createRatingFixture>>,
  input: {
    id: string;
    sourceType: 'standalone_zero_one' | 'standalone_cricket';
    completedAt: string;
    ppdMilli: number | null;
    mprMilli: number | null;
    playerId?: string;
  },
) {
  const gameId = input.id;
  const evaluationId = `eval-${input.id}`;
  const playerId = input.playerId ?? fixture.ownerPlayerId;
  await db.runAsync(
    `INSERT INTO game_sessions(
       id, mode, status, completion_reason, max_rounds, bull_rule, out_rule,
       zero_one_start_score, player_count, current_round_no, current_turn_sequence_no,
       current_player_id, winner_player_id, rating_candidate, started_at, completed_at,
       created_at, updated_at
     )
     VALUES (?, ?, 'completed', 'round_limit', 15, 'fat_bull', 'single_out', 501, 1,
             15, 15, ?, ?, 1, ?, ?, ?, ?)`,
    gameId,
    input.sourceType === 'standalone_zero_one' ? 'zero_one' : 'cricket',
    playerId,
    playerId,
    input.completedAt,
    input.completedAt,
    input.completedAt,
    input.completedAt,
  );
  await db.runAsync(
    `INSERT INTO rating_evaluations(
       id, account_id, player_id, source_type, source_match_id, source_game_id,
       source_revision, status, candidate_flag, match_result, zero_one_game_count,
       zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
       total_rounds, source_weight_milli, adjusted_darts, correction_count,
       input_payload_json, created_at
     )
     VALUES (?, ?, ?, ?, NULL, ?, 1, 'pending', 1, NULL, ?, ?, ?, ?, 30, 10, 500,
             0, 0, ?, ?)`,
    evaluationId,
    fixture.accountId,
    playerId,
    input.sourceType,
    gameId,
    input.sourceType === 'standalone_zero_one' ? 1 : 0,
    input.ppdMilli,
    input.sourceType === 'standalone_cricket' ? 1 : 0,
    input.mprMilli,
    JSON.stringify({ clearFlag: false }),
    input.completedAt,
  );
  await seedRatingOutbox(db, `outbox-${evaluationId}`, gameId, input.completedAt);
}

async function seedRatingOutbox(
  db: GameDatabaseConnection,
  id: string,
  aggregateId: string,
  createdAt: string,
) {
  await db.runAsync(
    `INSERT INTO integration_outbox(
       id, event_type, aggregate_type, aggregate_id, idempotency_key,
       payload_json, status, attempt_count, available_at, created_at, updated_at
     )
     VALUES (?, 'rating_recalculate', 'game', ?, ?, '{}', 'pending', 0, ?, ?, ?)`,
    id,
    aggregateId,
    `${id}:rating-recalculate`,
    createdAt,
    createdAt,
    createdAt,
  );
}

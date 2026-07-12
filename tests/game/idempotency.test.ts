import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createGameRepositories } from '../../features/game/infrastructure/sqlite/repositories';
import { assertRejectsSql, createMigratedTestDatabase } from './nodeSqliteTestAdapter';

const NOW = '2026-07-12T00:00:00.000Z';

test('OWNER creation is idempotent', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const repositories = createGameRepositories(db);
    const first = await repositories.players.getOrCreateOwner({ displayName: 'Me' });
    const second = await repositories.players.getOrCreateOwner({ displayName: 'Ignored' });

    assert.equal(first.id, second.id);
    assert.equal(second.displayName, 'Me');
  } finally {
    db.close();
  }
});

test('archived guests are excluded from the active guest list', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const repositories = createGameRepositories(db);
    const guest = await repositories.players.createGuest({ displayName: 'Guest 1' });
    assert.equal((await repositories.players.listActiveGuests()).length, 1);

    await repositories.players.archive(guest.id);
    assert.equal((await repositories.players.listActiveGuests()).length, 0);
  } finally {
    db.close();
  }
});

test('repositories bind parameters and preserve malicious-looking display names', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const repositories = createGameRepositories(db);
    const displayName = "x'); DROP TABLE players;--";
    const guest = await repositories.players.createGuest({ displayName });

    assert.equal(guest.displayName, displayName);
    const table = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      'players',
    );
    assert.equal(table?.name, 'players');
  } finally {
    db.close();
  }
});

test('client_action_id prevents duplicate dart registration', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await insertMinimalGameFixture(db);

    await db.runAsync(
      `INSERT INTO darts(
         id, game_id, turn_id, game_player_id, round_no, dart_no, segment_number,
         area, multiplier, score, cricket_marks, input_source, is_rating_eligible,
         client_action_id, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'dart-1',
      'game-1',
      'turn-1',
      'gp-1',
      1,
      1,
      20,
      'single',
      1,
      20,
      0,
      'manual_segment',
      1,
      'action-1',
      NOW,
      NOW,
    );

    await assertRejectsSql(() =>
      db.runAsync(
        `INSERT INTO darts(
           id, game_id, turn_id, game_player_id, round_no, dart_no, segment_number,
           area, multiplier, score, cricket_marks, input_source, is_rating_eligible,
           client_action_id, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'dart-2',
        'game-1',
        'turn-1',
        'gp-1',
        1,
        2,
        19,
        'single',
        1,
        19,
        0,
        'manual_segment',
        1,
        'action-1',
        NOW,
        NOW,
      ),
    );
  } finally {
    db.close();
  }
});

test('active GAME and MATCH uniqueness constraints work', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await db.runAsync(
      `INSERT INTO players(id, player_type, display_name, throwing_hand, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'p1',
      'owner',
      'Owner',
      'unknown',
      NOW,
      NOW,
    );

    await db.runAsync(
      `INSERT INTO matches(id, status, zero_one_start_score, out_rule, bull_rule, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'match-1',
      'in_progress',
      501,
      'single_out',
      'fat_bull',
      NOW,
      NOW,
    );

    await assertRejectsSql(() =>
      db.runAsync(
        `INSERT INTO matches(id, status, zero_one_start_score, out_rule, bull_rule, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'match-2',
        'paused',
        501,
        'single_out',
        'fat_bull',
        NOW,
        NOW,
      ),
    );

    await db.runAsync(
      `INSERT INTO game_sessions(id, mode, status, max_rounds, bull_rule, player_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      'game-1',
      'count_up',
      'in_progress',
      8,
      'fat_bull',
      1,
      NOW,
      NOW,
    );

    await assertRejectsSql(() =>
      db.runAsync(
        `INSERT INTO game_sessions(id, mode, status, max_rounds, bull_rule, player_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        'game-2',
        'count_up',
        'paused',
        8,
        'fat_bull',
        1,
        NOW,
        NOW,
      ),
    );
  } finally {
    db.close();
  }
});

test('Outbox pending to processed and failed transitions are correct', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const repositories = createGameRepositories(db);
    const event = await repositories.outbox.enqueue({
      eventType: 'practice_record_upsert',
      aggregateType: 'game',
      aggregateId: 'game-1',
      idempotencyKey: 'practice-record-upsert:game-1:1',
      payloadJson: '{}',
      availableAt: NOW,
    });

    assert.equal((await repositories.outbox.listPending(10, NOW)).length, 1);
    await repositories.outbox.markProcessed(event.id, NOW);
    assert.equal((await repositories.outbox.listPending(10, NOW)).length, 0);

    const failed = await repositories.outbox.enqueue({
      eventType: 'rating_recalculate',
      aggregateType: 'match',
      aggregateId: 'match-1',
      idempotencyKey: 'rating-recalculate:match-1:1',
      payloadJson: '{}',
      availableAt: NOW,
    });

    await repositories.outbox.markFailed(failed.id, { code: 'TEST', message: 'failed' }, NOW);
    const failedRow = await db.getFirstAsync<{ status: string; attempt_count: number }>(
      'SELECT status, attempt_count FROM integration_outbox WHERE id = ?',
      failed.id,
    );
    assert.equal(failedRow?.status, 'failed');
    assert.equal(failedRow?.attempt_count, 1);
  } finally {
    db.close();
  }
});

async function insertMinimalGameFixture(
  db: Awaited<ReturnType<typeof createMigratedTestDatabase>>,
) {
  await db.runAsync(
    `INSERT INTO players(id, player_type, display_name, throwing_hand, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    'p1',
    'owner',
    'Owner',
    'unknown',
    NOW,
    NOW,
  );
  await db.runAsync(
    `INSERT INTO game_sessions(id, mode, status, max_rounds, bull_rule, player_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'game-1',
    'count_up',
    'draft',
    8,
    'fat_bull',
    1,
    NOW,
    NOW,
  );
  await db.runAsync(
    `INSERT INTO game_players(
       id, game_id, player_id, slot_no, turn_order, display_name_snapshot,
       player_type_snapshot, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'gp-1',
    'game-1',
    'p1',
    1,
    1,
    'Owner',
    'owner',
    NOW,
    NOW,
  );
  await db.runAsync(
    `INSERT INTO rounds(id, game_id, round_no, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    'round-1',
    'game-1',
    1,
    'in_progress',
    NOW,
    NOW,
  );
  await db.runAsync(
    `INSERT INTO turns(
       id, game_id, round_id, game_player_id, turn_sequence_no, round_no,
       player_turn_order, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'turn-1',
    'game-1',
    'round-1',
    'gp-1',
    1,
    1,
    1,
    'in_progress',
    NOW,
    NOW,
  );
}

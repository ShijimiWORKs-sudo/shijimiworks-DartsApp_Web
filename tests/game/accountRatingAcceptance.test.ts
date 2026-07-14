import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ZeroOneGameService } from '../../features/game/application/services';
import { CountUpGameService } from '../../features/game/application/services/CountUpGameService';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

const NOW = '2026-07-13T00:00:00.000Z';

async function seedEstablishedOwner(db: Awaited<ReturnType<typeof createMigratedTestDatabase>>) {
  const existingOwner = await db.getFirstAsync<{ id: string; account_id: string | null }>(
    `SELECT id, account_id FROM players
     WHERE player_type = 'owner' AND is_archived = 0
     LIMIT 1`,
  );
  const accountId = existingOwner?.account_id ?? 'account-established';
  const ownerPlayerId = existingOwner?.id ?? 'player-established-owner';

  await db.runAsync(
    `INSERT OR IGNORE INTO accounts(
       id, user_name, display_name, email_normalized, status, auth_provider,
       registered_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    accountId,
    'owner_01',
    'Owner 01',
    'owner@example.com',
    'local_registered',
    'local',
    NOW,
    NOW,
    NOW,
  );
  await db.runAsync(
    `UPDATE accounts
     SET user_name = ?,
         display_name = ?,
         email_normalized = ?,
         status = ?,
         auth_provider = ?,
         registered_at = ?,
         updated_at = ?
     WHERE id = ?`,
    'owner_01',
    'Owner 01',
    'owner@example.com',
    'local_registered',
    'local',
    NOW,
    NOW,
    accountId,
  );

  if (existingOwner) {
    await db.runAsync(
      `UPDATE players
       SET account_id = ?, display_name = ?, updated_at = ?
       WHERE id = ?`,
      accountId,
      'Owner 01',
      NOW,
      ownerPlayerId,
    );
  } else {
    await db.runAsync(
      `INSERT INTO players(
         id, player_type, account_id, display_name, throwing_hand, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ownerPlayerId,
      'owner',
      accountId,
      'Owner 01',
      'unknown',
      NOW,
      NOW,
    );
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO rating_profiles(
       account_id, owner_player_id, measurement_status, rating_tenths,
       precise_rating_milli, confidence_bp, eligible_match_count,
       zero_one_index_milli, cricket_index_milli, match_index_milli,
       established_at, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    accountId,
    ownerPlayerId,
    'standard',
    70,
    7000,
    6000,
    3,
    7000,
    7000,
    7000,
    '2026-07-12T00:00:00.000Z',
    NOW,
    NOW,
  );
  await db.runAsync(
    `UPDATE rating_profiles
     SET owner_player_id = ?,
         measurement_status = ?,
         rating_tenths = ?,
         precise_rating_milli = ?,
         confidence_bp = ?,
         eligible_match_count = ?,
         zero_one_index_milli = ?,
         cricket_index_milli = ?,
         match_index_milli = ?,
         established_at = ?,
         updated_at = ?
     WHERE account_id = ?`,
    ownerPlayerId,
    'standard',
    70,
    7000,
    6000,
    3,
    7000,
    7000,
    7000,
    '2026-07-12T00:00:00.000Z',
    NOW,
    accountId,
  );
}

test('Phase 4 migration upgrades the game database to account/rating schema v2', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    assert.equal(version?.user_version, 3);

    const requiredTables = [
      'accounts',
      'rating_profiles',
      'rating_evaluations',
      'rating_snapshots',
      'rating_migration_orphans',
    ];
    for (const tableName of requiredTables) {
      const table = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        tableName,
      );
      assert.equal(table?.name, tableName);
    }

    const playerAccountColumn = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM pragma_table_info('players') WHERE name = 'account_id'`,
    );
    assert.equal(playerAccountColumn?.name, 'account_id');

    const migration = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM db_migrations WHERE version = ?',
      2,
    );
    assert.equal(migration?.version, 2);

    const foreignKeyViolations = await db.getAllAsync<unknown>('PRAGMA foreign_key_check;');
    assert.equal(foreignKeyViolations.length, 0);
  } finally {
    db.close();
  }
});

test('Phase 4 migration keeps OWNER account-linked and GUEST account-free', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const ownerBefore = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM players WHERE player_type = 'owner' AND is_archived = 0 LIMIT 1`,
    );
    if (!ownerBefore) {
      await db.runAsync(
        `INSERT INTO accounts(
           id, display_name, status, auth_provider, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        'account-profile-incomplete',
        'Owner',
        'profile_incomplete',
        'local',
        NOW,
        NOW,
      );
      await db.runAsync(
        `INSERT INTO players(
           id, player_type, account_id, display_name, throwing_hand, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'owner-profile-incomplete',
        'owner',
        'account-profile-incomplete',
        'Owner',
        'unknown',
        NOW,
        NOW,
      );
    }

    const owner = await db.getFirstAsync<{ account_id: string | null }>(
      `SELECT account_id FROM players WHERE player_type = 'owner' AND is_archived = 0 LIMIT 1`,
    );
    assert.ok(owner?.account_id, 'active OWNER should link to an account');

    const ownerAccount = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM accounts WHERE id = ?',
      owner.account_id,
    );
    assert.equal(ownerAccount?.status, 'profile_incomplete');

    await db.runAsync(
      `INSERT INTO players(id, player_type, display_name, throwing_hand, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'guest-no-account',
      'guest',
      'Guest',
      'unknown',
      NOW,
      NOW,
    );

    const guest = await db.getFirstAsync<{ account_id: string | null }>(
      'SELECT account_id FROM players WHERE id = ?',
      'guest-no-account',
    );
    assert.equal(guest?.account_id, null);
  } finally {
    db.close();
  }
});

test('standalone 01 creates a pending rating evaluation only after rating is established', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await seedEstablishedOwner(db);
    const zeroOne = new ZeroOneGameService(db);
    const game = await zeroOne.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });

    const session = await db.getFirstAsync<{ rating_candidate: number }>(
      'SELECT rating_candidate FROM game_sessions WHERE id = ?',
      game.gameId,
    );
    assert.equal(session?.rating_candidate, 1);

    await zeroOne.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'phase4-01-1',
    });
    await zeroOne.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'phase4-01-2',
    });
    await zeroOne.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'phase4-01-3',
    });
    await zeroOne.confirmTurn(game.gameId);
    await zeroOne.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'phase4-01-4',
    });
    await zeroOne.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 19,
      clientActionId: 'phase4-01-5',
    });
    const completed = await zeroOne.recordDart(game.gameId, {
      area: 'double',
      segmentNumber: 2,
      clientActionId: 'phase4-01-6',
    });

    assert.equal(completed.status, 'completed');

    const evaluation = await db.getFirstAsync<{
      source_type: string;
      status: string;
      candidate_flag: number;
      source_weight_milli: number;
      zero_one_game_count: number;
    }>('SELECT * FROM rating_evaluations WHERE source_game_id = ?', game.gameId);
    assert.equal(evaluation?.source_type, 'standalone_zero_one');
    assert.equal(evaluation?.status, 'pending');
    assert.equal(evaluation?.candidate_flag, 1);
    assert.equal(evaluation?.source_weight_milli, 500);
    assert.equal(evaluation?.zero_one_game_count, 1);

    const recalculateOutbox = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM integration_outbox
       WHERE aggregate_id = ? AND event_type = 'rating_recalculate'`,
      game.gameId,
    );
    assert.equal(recalculateOutbox?.count, 1);

    const evaluationId = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM rating_evaluations WHERE source_game_id = ?',
      game.gameId,
    );
    assert.ok(evaluationId?.id);

    const snapshots = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM rating_snapshots WHERE evaluation_id = ?',
      evaluationId.id,
    );
    assert.equal(snapshots?.count, 0);
  } finally {
    db.close();
  }
});

test('COUNT-UP remains rating-excluded after Phase 4', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await seedEstablishedOwner(db);
    const countUp = new CountUpGameService(db);
    const game = await countUp.startGame({ bullRule: 'fat_bull' });
    const session = await db.getFirstAsync<{ rating_candidate: number }>(
      'SELECT rating_candidate FROM game_sessions WHERE id = ?',
      game.gameId,
    );
    assert.equal(session?.rating_candidate, 0);
  } finally {
    db.close();
  }
});

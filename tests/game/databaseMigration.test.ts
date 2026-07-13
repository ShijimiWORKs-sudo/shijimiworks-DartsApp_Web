import assert from 'node:assert/strict';
import { test } from 'node:test';

import { migrateGameDatabase } from '../../features/game/infrastructure/sqlite/database';
import { INITIAL_GAME_DATABASE_SQL } from '../../features/game/infrastructure/sqlite/migrations/001_initial';
import {
  assertRejectsSql,
  createMigratedTestDatabase,
  NodeSqliteTestDatabase,
} from './nodeSqliteTestAdapter';

const REQUIRED_TABLES = [
  'db_migrations',
  'players',
  'matches',
  'match_players',
  'game_sessions',
  'game_players',
  'rounds',
  'turns',
  'darts',
  'cricket_number_states',
  'domain_events',
  'game_player_results',
  'match_player_results',
  'rating_evaluations',
  'rating_evaluation_games',
  'rating_evaluation_exclusions',
  'rating_snapshots',
  'integration_outbox',
  'practice_record_links',
  'accounts',
  'rating_profiles',
  'rating_migration_orphans',
];

test('game database migrations apply to an empty DB and set user_version to 2', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    assert.equal(version?.user_version, 2);

    const migrations = await db.getAllAsync<{ version: number; name: string }>(
      'SELECT version, name FROM db_migrations ORDER BY version',
    );
    assert.deepEqual(
      migrations.map((migration) => migration.version),
      [1, 2],
    );
  } finally {
    db.close();
  }
});

test('migration is idempotent and creates all required tables', async () => {
  const db = new NodeSqliteTestDatabase();
  try {
    await migrateGameDatabase(db);
    await migrateGameDatabase(db);

    const rows = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = rows.map((row) => row.name);
    const requiredTableCount = names.filter((name) => REQUIRED_TABLES.includes(name)).length;

    assert.equal(requiredTableCount, REQUIRED_TABLES.length);
    for (const tableName of REQUIRED_TABLES) {
      assert.ok(names.includes(tableName), `${tableName} should exist`);
    }

    const migrationCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM db_migrations',
    );
    assert.equal(migrationCount?.count, 2);
  } finally {
    db.close();
  }
});

test('foreign_key_check is clean after migration', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const rows = await db.getAllAsync<unknown>('PRAGMA foreign_key_check;');
    assert.equal(rows.length, 0);
  } finally {
    db.close();
  }
});

test('migration SQL defines the 19 required tables', () => {
  for (const tableName of REQUIRED_TABLES.slice(0, 19)) {
    assert.match(INITIAL_GAME_DATABASE_SQL, new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}`));
  }
});

test('CHECK constraints reject invalid enum and rating ranges', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await assertRejectsSql(() =>
      db.runAsync(
        `INSERT INTO players(id, player_type, display_name, throwing_hand, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        'p-invalid',
        'robot',
        'Invalid',
        'unknown',
        '2026-07-12T00:00:00.000Z',
        '2026-07-12T00:00:00.000Z',
      ),
    );

    await db.runAsync(
      `INSERT INTO players(id, player_type, display_name, throwing_hand, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      'p1',
      'owner',
      'Owner',
      'unknown',
      '2026-07-12T00:00:00.000Z',
      '2026-07-12T00:00:00.000Z',
    );
    const ownerAccountId = 'account-p1';
    await db.runAsync(
      `INSERT INTO accounts(id, display_name, status, auth_provider, created_at, updated_at)
       VALUES (?, ?, 'local_registered', 'local', ?, ?)`,
      ownerAccountId,
      'Owner',
      '2026-07-12T00:00:00.000Z',
      '2026-07-12T00:00:00.000Z',
    );
    await db.runAsync('UPDATE players SET account_id = ? WHERE id = ?', ownerAccountId, 'p1');

    await assertRejectsSql(() =>
      db.runAsync(
        `INSERT INTO rating_snapshots(
           id, account_id, player_id, source_type, measurement_status,
           rating_tenths, confidence_bp, calculation_version, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        'rating-invalid',
        ownerAccountId,
        'p1',
        'match',
        'standard',
        0,
        1000,
        2,
        '2026-07-12T00:00:00.000Z',
      ),
    );
  } finally {
    db.close();
  }
});

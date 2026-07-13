import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AccountUserNameAlreadyExistsError,
  AccountValidationError,
  createAccountService,
  normalizeEmail,
  normalizeUserName,
  validateAccountRegistration,
} from '../../features/account';
import { NodeSqliteTestDatabase } from '../game/nodeSqliteTestAdapter';

async function createAccountTestDatabase() {
  const db = new NodeSqliteTestDatabase();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      user_name TEXT COLLATE NOCASE,
      display_name TEXT NOT NULL,
      email_normalized TEXT COLLATE NOCASE,
      status TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      auth_subject TEXT,
      registered_at TEXT,
      verified_at TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE UNIQUE INDEX uq_accounts_user_name
    ON accounts(user_name)
    WHERE user_name IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE players (
      id TEXT PRIMARY KEY NOT NULL,
      player_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      throwing_hand TEXT NOT NULL DEFAULT 'unknown',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT,
      account_id TEXT REFERENCES accounts(id)
    );

    CREATE UNIQUE INDEX uq_players_active_owner
    ON players(player_type)
    WHERE player_type = 'owner' AND is_archived = 0;

    CREATE UNIQUE INDEX uq_players_account_owner
    ON players(account_id)
    WHERE account_id IS NOT NULL
      AND player_type = 'owner'
      AND is_archived = 0;

    CREATE TABLE rating_profiles (
      account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
      owner_player_id TEXT NOT NULL UNIQUE REFERENCES players(id),
      measurement_status TEXT NOT NULL,
      rating_tenths INTEGER,
      precise_rating_milli INTEGER,
      confidence_bp INTEGER NOT NULL DEFAULT 0,
      eligible_match_count INTEGER NOT NULL DEFAULT 0,
      eligible_standalone_zero_one_count INTEGER NOT NULL DEFAULT 0,
      eligible_standalone_cricket_count INTEGER NOT NULL DEFAULT 0,
      zero_one_index_milli INTEGER,
      cricket_index_milli INTEGER,
      match_index_milli INTEGER,
      calculation_version INTEGER NOT NULL DEFAULT 2,
      established_at TEXT,
      last_evaluated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

test('Account validation normalizes email and rejects invalid local user names', () => {
  assert.equal(normalizeUserName(' player_01 '), 'player_01');
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
  assert.deepEqual(
    validateAccountRegistration({
      userName: 'player_01',
      displayName: ' Player One ',
      email: ' USER@Example.COM ',
    }),
    {
      userName: 'player_01',
      displayName: 'Player One',
      emailNormalized: 'user@example.com',
    },
  );

  assert.throws(
    () => validateAccountRegistration({ userName: 'AB', displayName: 'Owner' }),
    AccountValidationError,
  );
  assert.throws(
    () => validateAccountRegistration({ userName: 'Player_01', displayName: 'Owner' }),
    AccountValidationError,
  );
  assert.throws(
    () => validateAccountRegistration({ userName: 'player-01', displayName: 'Owner' }),
    AccountValidationError,
  );
});

test('local Account registration creates one OWNER link and an unmeasured Rating Profile', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);

  const overview = await service.registerLocalAccount({
    userName: 'player_01',
    displayName: 'Player One',
    email: ' USER@Example.COM ',
  });

  assert.equal(overview.account.userName, 'player_01');
  assert.equal(overview.account.displayName, 'Player One');
  assert.equal(overview.account.emailNormalized, 'user@example.com');
  assert.equal(overview.account.status, 'local_registered');
  assert.equal(overview.account.authProvider, 'local');
  assert.equal(overview.ownerPlayer.displayName, 'Player One');
  assert.equal(overview.ratingProfile.accountId, overview.account.id);
  assert.equal(overview.ratingProfile.ownerPlayerId, overview.ownerPlayer.id);
  assert.equal(overview.ratingProfile.measurementStatus, 'unmeasured');
  assert.equal(overview.ratingProfile.ratingTenths, null);
  assert.equal(overview.ratingProfile.confidenceBp, 0);

  const ownerCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM players WHERE player_type = 'owner' AND is_archived = 0`,
  );
  assert.equal(ownerCount?.count, 1);

  const active = await service.getActiveAccount();
  assert.equal(active?.account.id, overview.account.id);
  db.close();
});

test('registration reuses the existing profile_incomplete OWNER Account', async () => {
  const db = await createAccountTestDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO accounts(
       id, user_name, display_name, email_normalized, status, auth_provider,
       created_at, updated_at
     )
     VALUES ('account-existing', NULL, 'Old Owner', NULL, 'profile_incomplete', 'local', ?, ?)`,
    now,
    now,
  );
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived,
       created_at, updated_at, last_used_at, account_id
     )
     VALUES ('owner-existing', 'owner', 'Old Owner', 'unknown', 0, ?, ?, ?, 'account-existing')`,
    now,
    now,
    now,
  );

  const service = createAccountService(db);
  const target = await service.getRegistrationTarget();
  assert.equal(target?.account.id, 'account-existing');
  assert.equal(target?.account.status, 'profile_incomplete');

  const registered = await service.registerLocalAccount({
    userName: 'owner_001',
    displayName: 'Registered Owner',
  });

  assert.equal(registered.account.id, 'account-existing');
  assert.equal(registered.ownerPlayer.id, 'owner-existing');
  assert.equal(registered.account.status, 'local_registered');
  assert.equal(registered.ownerPlayer.displayName, 'Registered Owner');

  const accountCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM accounts`,
  );
  const ownerCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM players WHERE player_type = 'owner'`,
  );
  assert.equal(accountCount?.count, 1);
  assert.equal(ownerCount?.count, 1);
  db.close();
});

test('duplicate userName is rejected without creating another OWNER', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);

  await service.registerLocalAccount({
    userName: 'player_01',
    displayName: 'Player One',
  });

  await assert.rejects(
    () =>
      service.registerLocalAccount({
        userName: 'player_01',
        displayName: 'Player Two',
      }),
    AccountUserNameAlreadyExistsError,
  );

  const ownerCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM players WHERE player_type = 'owner' AND is_archived = 0`,
  );
  assert.equal(ownerCount?.count, 1);
  db.close();
});

test('missing active account id resolves to null without creating a new account', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);

  const overview = await service.getAccountById('missing-account');

  assert.equal(overview, null);

  const accountCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM accounts`,
  );
  assert.equal(accountCount?.count, 0);
  db.close();
});

test('double registration attempts do not create duplicate accounts or owners', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);

  const results = await Promise.allSettled([
    service.registerLocalAccount({
      userName: 'player_01',
      displayName: 'Player One',
    }),
    service.registerLocalAccount({
      userName: 'player_01',
      displayName: 'Player One',
    }),
  ]);

  assert.equal(
    results.some((result) => result.status === 'fulfilled'),
    true,
  );

  const accountCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM accounts`,
  );
  const ownerCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM players WHERE player_type = 'owner' AND is_archived = 0`,
  );
  assert.equal(accountCount?.count, 1);
  assert.equal(ownerCount?.count, 1);
  db.close();
});

test('profile update keeps userName, normalizes email, and updates OWNER display name', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);
  const registered = await service.registerLocalAccount({
    userName: 'player_01',
    displayName: 'Player One',
  });

  const updated = await service.updateProfile(registered.account.id, {
    displayName: ' Updated Owner ',
    email: ' NEW@Example.COM ',
  });

  assert.equal(updated.account.userName, 'player_01');
  assert.equal(updated.account.displayName, 'Updated Owner');
  assert.equal(updated.account.emailNormalized, 'new@example.com');
  assert.equal(updated.ownerPlayer.displayName, 'Updated Owner');
  db.close();
});

test('established Rating Profile seed is available for Phase 4 integration tests', async () => {
  const db = await createAccountTestDatabase();
  const service = createAccountService(db);
  const registered = await service.registerLocalAccount({
    userName: 'player_01',
    displayName: 'Player One',
  });
  const establishedAt = '2026-07-13T00:00:00.000Z';

  const seeded = await service.seedEstablishedRatingProfile({
    accountId: registered.account.id,
    ratingTenths: 123,
    establishedAt,
  });

  assert.equal(seeded.measurementStatus, 'provisional');
  assert.equal(seeded.ratingTenths, 123);
  assert.equal(seeded.preciseRatingMilli, 12300);
  assert.equal(seeded.confidenceBp, 4500);
  assert.equal(seeded.eligibleMatchCount, 3);
  assert.equal(seeded.establishedAt, establishedAt);

  const overview = await service.getAccountById(registered.account.id);
  assert.equal(overview?.ratingProfile.establishedAt, establishedAt);
  db.close();
});

import { createGameId } from '../../../domain/ids';
import type { GameDatabaseExecutor } from '../types';

export const ACCOUNT_RATING_FOUNDATION_VERSION = 2;
export const ACCOUNT_RATING_FOUNDATION_NAME = '002_account_rating_foundation';
export const ACCOUNT_RATING_FOUNDATION_CHECKSUM = 'phase4-account-rating-foundation-v1';

export async function runAccountRatingFoundationMigration(db: GameDatabaseExecutor) {
  await createAccountTables(db);
  await ensurePlayersAccountColumn(db);
  await createOwnerAccounts(db);
  await createRatingProfiles(db);
  await rebuildRatingEvaluationTables(db);
  await createIndexes(db);
  await db.execAsync(`PRAGMA user_version = ${ACCOUNT_RATING_FOUNDATION_VERSION};`);

  const foreignKeys = await db.getAllAsync<{ table: string; rowid: number; parent: string }>(
    'PRAGMA foreign_key_check;',
  );
  if (foreignKeys.length > 0) {
    throw new Error('Game database migration 002 failed foreign_key_check.');
  }
}

async function createAccountTables(db: GameDatabaseExecutor) {
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_name TEXT COLLATE NOCASE,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 30),
  email_normalized TEXT COLLATE NOCASE,
  status TEXT NOT NULL CHECK (status IN (
    'profile_incomplete',
    'local_registered',
    'cloud_verified',
    'disabled',
    'deleted'
  )),
  auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'email', 'apple', 'google')),
  auth_subject TEXT,
  registered_at TEXT,
  verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (
    user_name IS NULL
    OR (
      length(user_name) BETWEEN 3 AND 20
      AND user_name NOT GLOB '*[^a-z0-9_]*'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_user_name
ON accounts(user_name)
WHERE user_name IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_email
ON accounts(email_normalized)
WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_auth_subject
ON accounts(auth_provider, auth_subject)
WHERE auth_subject IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rating_migration_orphans (
  id TEXT PRIMARY KEY NOT NULL,
  source_table TEXT NOT NULL,
  source_row_id TEXT,
  reason_code TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);
}

async function ensurePlayersAccountColumn(db: GameDatabaseExecutor) {
  if (await hasColumn(db, 'players', 'account_id')) {
    return;
  }

  await db.execAsync('ALTER TABLE players ADD COLUMN account_id TEXT REFERENCES accounts(id);');
}

async function createOwnerAccounts(db: GameDatabaseExecutor) {
  const owners = await db.getAllAsync<{
    id: string;
    display_name: string;
    account_id: string | null;
  }>(
    `SELECT id, display_name, account_id
     FROM players
     WHERE player_type = 'owner' AND is_archived = 0`,
  );

  for (const owner of owners) {
    if (owner.account_id) {
      continue;
    }

    const now = new Date().toISOString();
    const accountId = createGameId();
    await db.runAsync(
      `INSERT INTO accounts(
         id, user_name, display_name, email_normalized, status, auth_provider,
         registered_at, verified_at, created_at, updated_at
       )
       VALUES (?, NULL, ?, NULL, 'profile_incomplete', 'local', NULL, NULL, ?, ?)`,
      accountId,
      owner.display_name,
      now,
      now,
    );
    await db.runAsync(
      `UPDATE players SET account_id = ?, updated_at = ? WHERE id = ?`,
      accountId,
      now,
      owner.id,
    );
  }
}

async function createRatingProfiles(db: GameDatabaseExecutor) {
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS rating_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  owner_player_id TEXT NOT NULL UNIQUE REFERENCES players(id),
  measurement_status TEXT NOT NULL CHECK (measurement_status IN (
    'unmeasured',
    'provisional_1_of_3',
    'provisional_2_of_3',
    'provisional',
    'standard',
    'stable'
  )),
  rating_tenths INTEGER CHECK (rating_tenths BETWEEN 10 AND 180),
  precise_rating_milli INTEGER,
  confidence_bp INTEGER NOT NULL DEFAULT 0 CHECK (confidence_bp BETWEEN 0 AND 10000),
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
  updated_at TEXT NOT NULL,
  CHECK (
    (eligible_match_count < 3 AND established_at IS NULL)
    OR (eligible_match_count >= 3 AND established_at IS NOT NULL)
  )
);
`);

  const owners = await db.getAllAsync<{ id: string; account_id: string }>(
    `SELECT id, account_id
     FROM players
     WHERE player_type = 'owner' AND is_archived = 0 AND account_id IS NOT NULL`,
  );

  for (const owner of owners) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR IGNORE INTO rating_profiles(
         account_id, owner_player_id, measurement_status, rating_tenths,
         precise_rating_milli, confidence_bp, eligible_match_count,
         eligible_standalone_zero_one_count, eligible_standalone_cricket_count,
         calculation_version, established_at, last_evaluated_at, created_at, updated_at
       )
       VALUES (?, ?, 'unmeasured', NULL, NULL, 0, 0, 0, 0, 2, NULL, NULL, ?, ?)`,
      owner.account_id,
      owner.id,
      now,
      now,
    );
  }
}

async function rebuildRatingEvaluationTables(db: GameDatabaseExecutor) {
  const alreadyV2 =
    (await hasColumn(db, 'rating_evaluations', 'account_id')) &&
    (await hasColumn(db, 'rating_evaluations', 'source_type'));

  if (!alreadyV2 && (await hasTable(db, 'rating_evaluations'))) {
    await renameTableIfNeeded(db, 'rating_evaluation_games', 'rating_evaluation_games_v1_backup');
    await renameTableIfNeeded(
      db,
      'rating_evaluation_exclusions',
      'rating_evaluation_exclusions_v1_backup',
    );
    await renameTableIfNeeded(db, 'rating_snapshots', 'rating_snapshots_v1_backup');
    await renameTableIfNeeded(db, 'rating_evaluations', 'rating_evaluations_v1_backup');
  }

  await createRatingEvaluationV2Tables(db);

  if (await hasTable(db, 'rating_evaluations_v1_backup')) {
    await migrateRatingEvaluations(db);
    await migrateRatingEvaluationGames(db);
    await migrateRatingEvaluationExclusions(db);
    await migrateRatingSnapshots(db);
    await db.execAsync(`
DROP TABLE IF EXISTS rating_evaluation_games_v1_backup;
DROP TABLE IF EXISTS rating_evaluation_exclusions_v1_backup;
DROP TABLE IF EXISTS rating_snapshots_v1_backup;
DROP TABLE IF EXISTS rating_evaluations_v1_backup;
`);
  }
}

async function createRatingEvaluationV2Tables(db: GameDatabaseExecutor) {
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS rating_evaluations (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('match', 'standalone_zero_one', 'standalone_cricket')),
  source_match_id TEXT REFERENCES matches(id),
  source_game_id TEXT REFERENCES game_sessions(id),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'eligible', 'excluded', 'applied', 'invalidated')),
  candidate_flag INTEGER NOT NULL CHECK (candidate_flag IN (0, 1)),
  match_result TEXT CHECK (match_result IN ('win', 'loss')),
  zero_one_game_count INTEGER NOT NULL DEFAULT 0,
  zero_one_ppd_milli INTEGER,
  cricket_game_count INTEGER NOT NULL DEFAULT 0,
  cricket_mpr_milli INTEGER,
  total_darts INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 0,
  source_weight_milli INTEGER NOT NULL DEFAULT 1000 CHECK (source_weight_milli BETWEEN 1 AND 1000),
  auto_detected_darts INTEGER NOT NULL DEFAULT 0,
  adjusted_darts INTEGER NOT NULL DEFAULT 0,
  fully_manual_darts INTEGER NOT NULL DEFAULT 0,
  correction_count INTEGER NOT NULL DEFAULT 0,
  input_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  evaluated_at TEXT,
  applied_at TEXT,
  invalidated_at TEXT,
  CHECK (
    (source_type = 'match'
      AND source_match_id IS NOT NULL
      AND source_game_id IS NULL
      AND match_result IS NOT NULL)
    OR
    (source_type IN ('standalone_zero_one', 'standalone_cricket')
      AND source_match_id IS NULL
      AND source_game_id IS NOT NULL
      AND match_result IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_eval_match_v2
ON rating_evaluations(source_match_id, account_id, source_revision)
WHERE source_type = 'match';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_eval_game_v2
ON rating_evaluations(source_game_id, account_id, source_revision)
WHERE source_type IN ('standalone_zero_one', 'standalone_cricket');

CREATE TABLE IF NOT EXISTS rating_evaluation_games (
  evaluation_id TEXT NOT NULL REFERENCES rating_evaluations(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES game_sessions(id),
  mode TEXT NOT NULL CHECK (mode IN ('zero_one', 'cricket')),
  game_no INTEGER NOT NULL CHECK (game_no BETWEEN 1 AND 3),
  ppd_milli INTEGER,
  three_dart_average_milli INTEGER,
  mpr_milli INTEGER,
  darts_thrown INTEGER NOT NULL DEFAULT 0,
  rounds_count INTEGER NOT NULL DEFAULT 0,
  checkout_flag INTEGER NOT NULL DEFAULT 0 CHECK (checkout_flag IN (0, 1)),
  bust_count INTEGER NOT NULL DEFAULT 0,
  marks_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (evaluation_id, game_id)
);

CREATE TABLE IF NOT EXISTS rating_evaluation_exclusions (
  evaluation_id TEXT NOT NULL REFERENCES rating_evaluations(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (evaluation_id, reason_code)
);

CREATE TABLE IF NOT EXISTS rating_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  evaluation_id TEXT UNIQUE REFERENCES rating_evaluations(id),
  previous_snapshot_id TEXT REFERENCES rating_snapshots(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('match', 'standalone_zero_one', 'standalone_cricket')),
  measurement_status TEXT NOT NULL CHECK (measurement_status IN (
    'unmeasured',
    'provisional_1_of_3',
    'provisional_2_of_3',
    'provisional',
    'standard',
    'stable'
  )),
  rating_tenths INTEGER CHECK (rating_tenths BETWEEN 10 AND 180),
  precise_rating_milli INTEGER,
  confidence_bp INTEGER NOT NULL CHECK (confidence_bp BETWEEN 0 AND 10000),
  evaluated_match_count INTEGER NOT NULL DEFAULT 0,
  evaluated_standalone_zero_one_count INTEGER NOT NULL DEFAULT 0,
  evaluated_standalone_cricket_count INTEGER NOT NULL DEFAULT 0,
  window_match_count INTEGER NOT NULL DEFAULT 0,
  window_zero_one_observation_count INTEGER NOT NULL DEFAULT 0,
  window_cricket_observation_count INTEGER NOT NULL DEFAULT 0,
  zero_one_index_milli INTEGER,
  cricket_index_milli INTEGER,
  match_index_milli INTEGER,
  stability_adjustment_milli INTEGER,
  continuity_bonus_milli INTEGER,
  applied_delta_milli INTEGER,
  calculation_version INTEGER NOT NULL DEFAULT 2,
  calculation_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  invalidated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rating_snapshots_account_current_v2
ON rating_snapshots(account_id, created_at DESC)
WHERE invalidated_at IS NULL;
`);
}

async function migrateRatingEvaluations(db: GameDatabaseExecutor) {
  const rows = await db.getAllAsync<{
    id: string;
    match_id: string;
    player_id: string;
    source_revision: number;
    status: string;
    candidate_flag: number;
    match_result: string;
    zero_one_game_count: number;
    zero_one_ppd_milli: number | null;
    cricket_game_count: number;
    cricket_mpr_milli: number | null;
    total_darts: number;
    auto_detected_darts: number;
    adjusted_darts: number;
    fully_manual_darts: number;
    correction_count: number;
    input_payload_json: string;
    created_at: string;
    evaluated_at: string | null;
    applied_at: string | null;
    invalidated_at: string | null;
    account_id: string | null;
  }>(
    `SELECT e.*, p.account_id
     FROM rating_evaluations_v1_backup e
     LEFT JOIN players p ON p.id = e.player_id`,
  );

  for (const row of rows) {
    if (!row.account_id) {
      await insertMigrationOrphan(db, 'rating_evaluations', row.id, 'ACCOUNT_NOT_LINKED', row);
      continue;
    }

    await db.runAsync(
      `INSERT OR IGNORE INTO rating_evaluations(
         id, account_id, player_id, source_type, source_match_id, source_game_id,
         source_revision, status, candidate_flag, match_result, zero_one_game_count,
         zero_one_ppd_milli, cricket_game_count, cricket_mpr_milli, total_darts,
         total_rounds, source_weight_milli, auto_detected_darts, adjusted_darts,
         fully_manual_darts, correction_count, input_payload_json, created_at,
         evaluated_at, applied_at, invalidated_at
       )
       VALUES (?, ?, ?, 'match', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1000, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.account_id,
      row.player_id,
      row.match_id,
      row.source_revision,
      row.status,
      row.candidate_flag,
      row.match_result,
      row.zero_one_game_count,
      row.zero_one_ppd_milli,
      row.cricket_game_count,
      row.cricket_mpr_milli,
      row.total_darts,
      row.auto_detected_darts,
      row.adjusted_darts,
      row.fully_manual_darts,
      row.correction_count,
      row.input_payload_json,
      row.created_at,
      row.evaluated_at,
      row.applied_at,
      row.invalidated_at,
    );
  }
}

async function migrateRatingEvaluationGames(db: GameDatabaseExecutor) {
  if (!(await hasTable(db, 'rating_evaluation_games_v1_backup'))) {
    return;
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO rating_evaluation_games
     SELECT g.*
     FROM rating_evaluation_games_v1_backup g
     JOIN rating_evaluations e ON e.id = g.evaluation_id`,
  );
}

async function migrateRatingEvaluationExclusions(db: GameDatabaseExecutor) {
  if (!(await hasTable(db, 'rating_evaluation_exclusions_v1_backup'))) {
    return;
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO rating_evaluation_exclusions
     SELECT x.*
     FROM rating_evaluation_exclusions_v1_backup x
     JOIN rating_evaluations e ON e.id = x.evaluation_id`,
  );
}

async function migrateRatingSnapshots(db: GameDatabaseExecutor) {
  if (!(await hasTable(db, 'rating_snapshots_v1_backup'))) {
    return;
  }

  const rows = await db.getAllAsync<{
    id: string;
    player_id: string;
    evaluation_id: string | null;
    previous_snapshot_id: string | null;
    measurement_status: string;
    rating_tenths: number | null;
    confidence_bp: number;
    evaluated_match_count: number;
    window_match_count: number;
    zero_one_index_milli: number | null;
    cricket_index_milli: number | null;
    match_index_milli: number | null;
    stability_adjustment_milli: number | null;
    continuity_bonus_milli: number | null;
    calculation_version: number;
    calculation_detail_json: string;
    created_at: string;
    invalidated_at: string | null;
    account_id: string | null;
  }>(
    `SELECT s.*, p.account_id
     FROM rating_snapshots_v1_backup s
     LEFT JOIN players p ON p.id = s.player_id`,
  );

  for (const row of rows) {
    if (!row.account_id) {
      await insertMigrationOrphan(db, 'rating_snapshots', row.id, 'ACCOUNT_NOT_LINKED', row);
      continue;
    }

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
       VALUES (?, ?, ?, ?, ?, 'match', ?, ?, NULL, ?, ?, 0, 0, ?, 0, 0, ?, ?, ?, ?, ?, NULL, 2, ?, ?, ?)`,
      row.id,
      row.account_id,
      row.player_id,
      row.evaluation_id,
      row.previous_snapshot_id,
      row.measurement_status,
      row.rating_tenths,
      row.confidence_bp,
      row.evaluated_match_count,
      row.window_match_count,
      row.zero_one_index_milli,
      row.cricket_index_milli,
      row.match_index_milli,
      row.stability_adjustment_milli,
      row.continuity_bonus_milli,
      row.calculation_detail_json,
      row.created_at,
      row.invalidated_at,
    );
  }
}

async function createIndexes(db: GameDatabaseExecutor) {
  await db.execAsync(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_players_account_owner
ON players(account_id)
WHERE account_id IS NOT NULL
  AND player_type = 'owner'
  AND is_archived = 0;

CREATE INDEX IF NOT EXISTS idx_accounts_status_updated
ON accounts(status, updated_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_players_account
ON players(account_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_rating_evaluations_account_status_v2
ON rating_evaluations(account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rating_evaluations_source_game_v2
ON rating_evaluations(source_game_id, source_revision DESC)
WHERE source_game_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rating_profiles_status
ON rating_profiles(measurement_status, updated_at DESC);
`);
}

async function insertMigrationOrphan(
  db: GameDatabaseExecutor,
  sourceTable: string,
  sourceRowId: string | null,
  reasonCode: string,
  payload: unknown,
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO rating_migration_orphans(
       id, source_table, source_row_id, reason_code, payload_json, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?)`,
    createGameId(),
    sourceTable,
    sourceRowId,
    reasonCode,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

async function renameTableIfNeeded(db: GameDatabaseExecutor, from: string, to: string) {
  if ((await hasTable(db, from)) && !(await hasTable(db, to))) {
    await db.execAsync(`ALTER TABLE ${from} RENAME TO ${to};`);
  }
}

async function hasTable(db: GameDatabaseExecutor, tableName: string) {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    tableName,
  );
  return Boolean(row);
}

async function hasColumn(db: GameDatabaseExecutor, tableName: string, columnName: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return rows.some((row) => row.name === columnName);
}

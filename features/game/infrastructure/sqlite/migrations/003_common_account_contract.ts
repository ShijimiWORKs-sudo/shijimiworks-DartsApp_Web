import type { GameDatabaseExecutor } from '../types';

export const COMMON_ACCOUNT_CONTRACT_VERSION = 3;
export const COMMON_ACCOUNT_CONTRACT_NAME = '003_common_account_contract';
export const COMMON_ACCOUNT_CONTRACT_CHECKSUM = 'common-account-contract-v1';

export async function runCommonAccountContractMigration(db: GameDatabaseExecutor) {
  await ensureAccountsLegacyColumn(db);
  await db.execAsync(`
CREATE TABLE IF NOT EXISTS common_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'account_created',
    'account_profile_updated',
    'practice_session_completed',
    'game_session_completed',
    'match_completed',
    'rating_updated',
    'consultation_saved',
    'record_deleted'
  )),
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version = 1),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  source_app TEXT NOT NULL DEFAULT 'darts_app' CHECK (source_app = 'darts_app'),
  source_record_id TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS common_outbox (
  outbox_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE REFERENCES common_events(event_id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'local_only' CHECK (sync_status IN (
    'local_only',
    'pending',
    'synced',
    'conflict',
    'failed',
    'deleted'
  )),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_common_events_account_created
ON common_events(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_common_events_type_created
ON common_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_common_outbox_status_created
ON common_outbox(sync_status, created_at ASC);
`);

  const foreignKeys = await db.getAllAsync<{ table: string; rowid: number; parent: string }>(
    'PRAGMA foreign_key_check;',
  );
  if (foreignKeys.length > 0) {
    throw new Error('Game database migration 003 failed foreign_key_check.');
  }
}

async function ensureAccountsLegacyColumn(db: GameDatabaseExecutor) {
  if (await hasColumn(db, 'accounts', 'legacy_account_id')) {
    return;
  }

  await db.execAsync('ALTER TABLE accounts ADD COLUMN legacy_account_id TEXT;');
}

async function hasColumn(
  db: GameDatabaseExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return rows.some((row) => row.name === columnName);
}

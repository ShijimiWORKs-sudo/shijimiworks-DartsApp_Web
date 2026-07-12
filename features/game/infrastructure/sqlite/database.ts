import { GameDatabaseError } from '../../domain/errors';
import { GAME_DATABASE_MIGRATIONS } from './migrations';
import type { GameDatabaseConnection, GameDatabaseExecutor } from './types';

export const GAME_DATABASE_FILE_NAME = 'dartsapp_games.db';
export const GAME_DATABASE_CURRENT_VERSION = 1;

export async function applyGameDatabasePragmas(db: GameDatabaseExecutor): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA synchronous = NORMAL;');
  await db.execAsync('PRAGMA busy_timeout = 5000;');
}

async function getUserVersion(db: GameDatabaseExecutor): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

async function setUserVersion(db: GameDatabaseExecutor, version: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version};`);
}

export async function migrateGameDatabase(db: GameDatabaseConnection): Promise<void> {
  await applyGameDatabasePragmas(db);
  let currentVersion = await getUserVersion(db);

  for (const migration of GAME_DATABASE_MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.withExclusiveTransactionAsync(async (transaction) => {
      await migration.up(transaction);
      await transaction.runAsync(
        `INSERT INTO db_migrations(version, name, checksum, applied_at)
         VALUES (?, ?, ?, ?)`,
        migration.version,
        migration.name,
        migration.checksum,
        new Date().toISOString(),
      );
      await setUserVersion(transaction, migration.version);
    });

    currentVersion = migration.version;
  }

  if (currentVersion !== GAME_DATABASE_CURRENT_VERSION) {
    throw new GameDatabaseError(
      `Unexpected game database version ${currentVersion}; expected ${GAME_DATABASE_CURRENT_VERSION}.`,
    );
  }
}

export async function initializeGameDatabase(db: GameDatabaseConnection): Promise<void> {
  try {
    await migrateGameDatabase(db);
  } catch (error) {
    throw new GameDatabaseError('Failed to initialize the game database.', { cause: error });
  }
}

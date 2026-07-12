import { DatabaseSync } from 'node:sqlite';

import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
  GameDatabaseRunResult,
  SqliteParameter,
} from '../../features/game/infrastructure/sqlite/types';

export class NodeSqliteTestDatabase implements GameDatabaseConnection {
  readonly db = new DatabaseSync(':memory:');

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: SqliteParameter[]): Promise<GameDatabaseRunResult> {
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId:
        typeof result.lastInsertRowid === 'bigint'
          ? Number(result.lastInsertRowid)
          : Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(sql: string, ...params: SqliteParameter[]): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: SqliteParameter[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: GameDatabaseExecutor) => Promise<void>,
  ): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      await task(this);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

export async function createMigratedTestDatabase(): Promise<NodeSqliteTestDatabase> {
  const { migrateGameDatabase } =
    await import('../../features/game/infrastructure/sqlite/database');
  const db = new NodeSqliteTestDatabase();
  await migrateGameDatabase(db);
  return db;
}

export async function assertRejectsSql(operation: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await operation();
  } catch {
    rejected = true;
  }

  if (!rejected) {
    throw new Error('Expected SQLite operation to reject.');
  }
}

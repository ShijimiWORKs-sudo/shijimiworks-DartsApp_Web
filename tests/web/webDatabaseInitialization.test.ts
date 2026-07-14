import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  initializeGameDatabase,
  migrateGameDatabase,
} from '../../features/game/infrastructure/sqlite/database';
import { runGameDatabaseTransaction } from '../../features/game/infrastructure/sqlite/transaction';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
  GameDatabaseRunResult,
  SqliteParameter,
} from '../../features/game/infrastructure/sqlite/types';
import { createDeferredErrorHandler } from '../../features/web/deferredError';
import { NodeSqliteTestDatabase } from '../game/nodeSqliteTestAdapter';

class TransactionSpyDatabase implements GameDatabaseConnection {
  exclusiveCalls = 0;
  transactionCalls = 0;
  taskExecutor: GameDatabaseExecutor | null = null;

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(_sql: string, ..._params: SqliteParameter[]): Promise<GameDatabaseRunResult> {
    return {};
  }

  async getFirstAsync<T>(_sql: string, ..._params: SqliteParameter[]): Promise<T | null> {
    return null;
  }

  async getAllAsync<T>(_sql: string, ..._params: SqliteParameter[]): Promise<T[]> {
    return [];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: GameDatabaseExecutor) => Promise<void>,
  ): Promise<void> {
    this.exclusiveCalls += 1;
    await task(this);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.transactionCalls += 1;
    await task();
  }
}

class CountingWebMigrationDatabase extends NodeSqliteTestDatabase {
  transactionCalls = 0;
  exclusiveCalls = 0;
  failFirstTransaction = false;

  override async withExclusiveTransactionAsync(
    task: (transaction: GameDatabaseExecutor) => Promise<void>,
  ): Promise<void> {
    this.exclusiveCalls += 1;
    await super.withExclusiveTransactionAsync(task);
  }

  override async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.transactionCalls += 1;

    if (this.failFirstTransaction && this.transactionCalls === 1) {
      throw new Error('temporary web transaction failure');
    }

    await super.withTransactionAsync(task);
  }
}

test('native transaction adapter uses withExclusiveTransactionAsync', async () => {
  const db = new TransactionSpyDatabase();

  await runGameDatabaseTransaction(
    db,
    async (transaction) => {
      db.taskExecutor = transaction;
    },
    'native',
  );

  assert.equal(db.exclusiveCalls, 1);
  assert.equal(db.transactionCalls, 0);
  assert.equal(db.taskExecutor, db);
});

test('web transaction adapter uses withTransactionAsync and never calls exclusive transaction', async () => {
  const db = new TransactionSpyDatabase();

  await runGameDatabaseTransaction(
    db,
    async (transaction) => {
      db.taskExecutor = transaction;
    },
    'web',
  );

  assert.equal(db.exclusiveCalls, 0);
  assert.equal(db.transactionCalls, 1);
  assert.equal(db.taskExecutor, db);
});

test('migration 001 to 003 succeeds through the web transaction adapter', async () => {
  const db = new CountingWebMigrationDatabase();

  try {
    await migrateGameDatabase(db, 'web');

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    const foreignKeyViolations = await db.getAllAsync<unknown>('PRAGMA foreign_key_check;');

    assert.equal(version?.user_version, 3);
    assert.equal(foreignKeyViolations.length, 0);
    assert.equal(db.exclusiveCalls, 0);
    assert.equal(db.transactionCalls, 3);
  } finally {
    db.close();
  }
});

test('concurrent web initialization shares one migration promise per database file', async () => {
  const db = new CountingWebMigrationDatabase();

  try {
    await Promise.all([
      initializeGameDatabase(db, 'concurrent-web-init.db', 'web'),
      initializeGameDatabase(db, 'concurrent-web-init.db', 'web'),
    ]);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');

    assert.equal(version?.user_version, 3);
    assert.equal(db.exclusiveCalls, 0);
    assert.equal(db.transactionCalls, 3);
  } finally {
    db.close();
  }
});

test('failed web initialization does not permanently cache the rejected promise', async () => {
  const db = new CountingWebMigrationDatabase();
  db.failFirstTransaction = true;

  try {
    await assert.rejects(() => initializeGameDatabase(db, 'retry-web-init.db', 'web'));

    db.failFirstTransaction = false;
    await initializeGameDatabase(db, 'retry-web-init.db', 'web');

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');

    assert.equal(version?.user_version, 3);
    assert.equal(db.exclusiveCalls, 0);
    assert.equal(db.transactionCalls, 4);
  } finally {
    db.close();
  }
});

test('deferred SQLiteProvider error handler does not update state synchronously', async () => {
  let handledError: Error | null = null;
  const error = new Error('SQLiteProvider onError');
  const handleError = createDeferredErrorHandler((nextError: Error) => {
    handledError = nextError;
  });

  handleError(error);

  assert.equal(handledError, null);

  await Promise.resolve();

  assert.equal(handledError, error);
});

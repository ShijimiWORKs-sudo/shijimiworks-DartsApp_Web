import type { GameDatabaseConnection, GameDatabaseExecutor } from './types';

export type GameDatabaseTransactionRuntime = 'native' | 'web';

export function resolveGameDatabaseTransactionRuntime(
  runtime?: GameDatabaseTransactionRuntime,
): GameDatabaseTransactionRuntime {
  if (runtime) {
    return runtime;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'web';
  }

  return 'native';
}

export async function runGameDatabaseTransaction(
  db: GameDatabaseConnection,
  task: (transaction: GameDatabaseExecutor) => Promise<void>,
  runtime?: GameDatabaseTransactionRuntime,
): Promise<void> {
  if (resolveGameDatabaseTransactionRuntime(runtime) === 'web') {
    await db.withTransactionAsync(async () => {
      await task(db);
    });
    return;
  }

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await task(transaction);
  });
}

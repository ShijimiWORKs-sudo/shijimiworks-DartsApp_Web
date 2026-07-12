export type SqliteParameter = string | number | null;

export type GameDatabaseRunResult = {
  changes?: number;
  lastInsertRowId?: number;
};

export type GameDatabaseExecutor = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqliteParameter[]): Promise<GameDatabaseRunResult>;
  getFirstAsync<T>(sql: string, ...params: SqliteParameter[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqliteParameter[]): Promise<T[]>;
};

export type GameDatabaseConnection = GameDatabaseExecutor & {
  withExclusiveTransactionAsync(
    task: (transaction: GameDatabaseExecutor) => Promise<void>,
  ): Promise<void>;
};

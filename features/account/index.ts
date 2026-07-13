import { AccountService } from './application';
import { SqliteAccountRepository } from './infrastructure/sqlite';
import type { GameDatabaseConnection } from '../game/infrastructure/sqlite/types';

export { AccountService } from './application';
export type { AccountRepository, AccountServicePort } from './application';
export { SqliteAccountRepository } from './infrastructure/sqlite';
export * from './domain';

export function createAccountService(db: GameDatabaseConnection): AccountService {
  return new AccountService(new SqliteAccountRepository(db));
}

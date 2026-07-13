import {
  INITIAL_GAME_DATABASE_CHECKSUM,
  INITIAL_GAME_DATABASE_NAME,
  INITIAL_GAME_DATABASE_VERSION,
  runInitialGameDatabaseMigration,
} from './001_initial';
import {
  ACCOUNT_RATING_FOUNDATION_CHECKSUM,
  ACCOUNT_RATING_FOUNDATION_NAME,
  ACCOUNT_RATING_FOUNDATION_VERSION,
  runAccountRatingFoundationMigration,
} from './002_account_rating_foundation';
import type { GameDatabaseExecutor } from '../types';

export type GameDatabaseMigration = {
  version: number;
  name: string;
  checksum: string;
  up: (db: GameDatabaseExecutor) => Promise<void>;
};

export const GAME_DATABASE_MIGRATIONS: GameDatabaseMigration[] = [
  {
    version: INITIAL_GAME_DATABASE_VERSION,
    name: INITIAL_GAME_DATABASE_NAME,
    checksum: INITIAL_GAME_DATABASE_CHECKSUM,
    up: runInitialGameDatabaseMigration,
  },
  {
    version: ACCOUNT_RATING_FOUNDATION_VERSION,
    name: ACCOUNT_RATING_FOUNDATION_NAME,
    checksum: ACCOUNT_RATING_FOUNDATION_CHECKSUM,
    up: runAccountRatingFoundationMigration,
  },
];

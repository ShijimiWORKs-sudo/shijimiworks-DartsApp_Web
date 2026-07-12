import type { GameRepositories } from '../../../application/ports';
import type { GameDatabaseConnection } from '../types';
import { SqliteGameRepository } from './SqliteGameRepository';
import { SqliteIntegrationOutboxRepository } from './SqliteIntegrationOutboxRepository';
import { SqliteMatchRepository } from './SqliteMatchRepository';
import { SqlitePlayerRepository } from './SqlitePlayerRepository';
import { SqliteRatingRepository } from './SqliteRatingRepository';

export function createGameRepositories(db: GameDatabaseConnection): GameRepositories {
  return {
    players: new SqlitePlayerRepository(db),
    matches: new SqliteMatchRepository(db),
    games: new SqliteGameRepository(db),
    ratings: new SqliteRatingRepository(db),
    outbox: new SqliteIntegrationOutboxRepository(db),
  };
}

export { SqliteGameRepository } from './SqliteGameRepository';
export { SqliteIntegrationOutboxRepository } from './SqliteIntegrationOutboxRepository';
export { SqliteMatchRepository } from './SqliteMatchRepository';
export { SqlitePlayerRepository } from './SqlitePlayerRepository';
export { SqliteRatingRepository } from './SqliteRatingRepository';

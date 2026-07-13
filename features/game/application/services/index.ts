import { CountUpGameService } from './CountUpGameService';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export type GameServices = {
  countUp: CountUpGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  return {
    countUp: new CountUpGameService(db),
  };
}

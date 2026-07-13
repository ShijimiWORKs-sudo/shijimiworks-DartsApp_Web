import { CountUpGameService } from './CountUpGameService';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export { CountUpRedoSession } from './CountUpRedoSession';
export { createCountUpLeaveChoices } from './countUpLeaveActions';
export type { CountUpLeaveChoice, CountUpLeaveChoiceId } from './countUpLeaveActions';

export type GameServices = {
  countUp: CountUpGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  return {
    countUp: new CountUpGameService(db),
  };
}

import { CountUpGameService } from './CountUpGameService';
import { ZeroOneGameService } from './ZeroOneGameService';
import { createAccountService, type AccountService } from '../../../account';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export { CountUpRedoSession } from './CountUpRedoSession';
export { createCountUpLeaveChoices } from './countUpLeaveActions';
export type { CountUpLeaveChoice, CountUpLeaveChoiceId } from './countUpLeaveActions';
export { ZeroOneGameService, ZeroOneActiveGameExistsError } from './ZeroOneGameService';
export { clearZeroOneRedoSession, ZeroOneRedoSession } from './ZeroOneRedoSession';
export { createZeroOneLeaveChoices } from './zeroOneLeaveActions';
export type { ZeroOneLeaveChoice, ZeroOneLeaveChoiceId } from './zeroOneLeaveActions';
export type { ZeroOneGameServicePort, ZeroOneLastSettings } from './ZeroOneGameServicePort';

export type GameServices = {
  account: AccountService;
  countUp: CountUpGameService;
  zeroOne: ZeroOneGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  return {
    account: createAccountService(db),
    countUp: new CountUpGameService(db),
    zeroOne: new ZeroOneGameService(db),
  };
}

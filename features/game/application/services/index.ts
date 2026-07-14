import { CountUpGameService } from './CountUpGameService';
import { CricketGameService } from './CricketGameService';
import { ZeroOneGameService } from './ZeroOneGameService';
import { createAccountService, type AccountService } from '../../../account';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export { CountUpRedoSession } from './CountUpRedoSession';
export { createCountUpLeaveChoices } from './countUpLeaveActions';
export type { CountUpLeaveChoice, CountUpLeaveChoiceId } from './countUpLeaveActions';
export { CricketActiveGameExistsError, CricketGameService } from './CricketGameService';
export { clearCricketRedoSession, CricketRedoSession } from './CricketRedoSession';
export type { CricketGameServicePort, CricketLastSettings } from './CricketGameServicePort';
export { ZeroOneGameService, ZeroOneActiveGameExistsError } from './ZeroOneGameService';
export { clearZeroOneRedoSession, ZeroOneRedoSession } from './ZeroOneRedoSession';
export { createZeroOneLeaveChoices } from './zeroOneLeaveActions';
export type { ZeroOneLeaveChoice, ZeroOneLeaveChoiceId } from './zeroOneLeaveActions';
export type { ZeroOneGameServicePort, ZeroOneLastSettings } from './ZeroOneGameServicePort';

export type GameServices = {
  account: AccountService;
  countUp: CountUpGameService;
  cricket: CricketGameService;
  zeroOne: ZeroOneGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  return {
    account: createAccountService(db),
    countUp: new CountUpGameService(db),
    cricket: new CricketGameService(db),
    zeroOne: new ZeroOneGameService(db),
  };
}

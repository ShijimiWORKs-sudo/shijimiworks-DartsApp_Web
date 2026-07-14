import { CountUpGameService } from './CountUpGameService';
import { CricketGameService } from './CricketGameService';
import { MatchGameService } from './MatchGameService';
import { ZeroOneGameService } from './ZeroOneGameService';
import { createAccountService, type AccountService } from '../../../account';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export { CountUpRedoSession } from './CountUpRedoSession';
export { createCountUpLeaveChoices } from './countUpLeaveActions';
export type { CountUpLeaveChoice, CountUpLeaveChoiceId } from './countUpLeaveActions';
export { CricketActiveGameExistsError, CricketGameService } from './CricketGameService';
export { clearCricketRedoSession, CricketRedoSession } from './CricketRedoSession';
export type { CricketGameServicePort, CricketLastSettings } from './CricketGameServicePort';
export {
  MatchActiveExistsError,
  MatchGameService,
  MatchManualWinnerRequiredError,
} from './MatchGameService';
export type { MatchGameServicePort, MatchLastSettings } from './MatchGameServicePort';
export { clearMatchRedoSession, MatchRedoSession } from './MatchRedoSession';
export { createMatchLeaveChoices } from './matchLeaveActions';
export type { MatchLeaveChoice, MatchLeaveChoiceId } from './matchLeaveActions';
export { ZeroOneGameService, ZeroOneActiveGameExistsError } from './ZeroOneGameService';
export { clearZeroOneRedoSession, ZeroOneRedoSession } from './ZeroOneRedoSession';
export { createZeroOneLeaveChoices } from './zeroOneLeaveActions';
export type { ZeroOneLeaveChoice, ZeroOneLeaveChoiceId } from './zeroOneLeaveActions';
export type { ZeroOneGameServicePort, ZeroOneLastSettings } from './ZeroOneGameServicePort';

export type GameServices = {
  account: AccountService;
  countUp: CountUpGameService;
  cricket: CricketGameService;
  match: MatchGameService;
  zeroOne: ZeroOneGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  return {
    account: createAccountService(db),
    countUp: new CountUpGameService(db),
    cricket: new CricketGameService(db),
    match: new MatchGameService(db),
    zeroOne: new ZeroOneGameService(db),
  };
}

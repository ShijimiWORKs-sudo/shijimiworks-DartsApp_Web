import { ActiveSessionService } from './ActiveSessionService';
import { CountUpGameService } from './CountUpGameService';
import { CricketGameService } from './CricketGameService';
import { MatchGameService } from './MatchGameService';
import { ZeroOneGameService } from './ZeroOneGameService';
import { createAccountService, type AccountService } from '../../../account';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';

export {
  ActiveSessionAbortFailedError,
  ActiveSessionService,
  type ActiveSessionInfo,
  type ActiveSessionMode,
} from './ActiveSessionService';
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
  activeSession: ActiveSessionService;
  countUp: CountUpGameService;
  cricket: CricketGameService;
  match: MatchGameService;
  zeroOne: ZeroOneGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  const countUp = new CountUpGameService(db);
  const cricket = new CricketGameService(db);
  const match = new MatchGameService(db);
  const zeroOne = new ZeroOneGameService(db);

  return {
    account: createAccountService(db),
    activeSession: new ActiveSessionService({
      countUp,
      cricket,
      match,
      zeroOne,
    }),
    countUp,
    cricket,
    match,
    zeroOne,
  };
}

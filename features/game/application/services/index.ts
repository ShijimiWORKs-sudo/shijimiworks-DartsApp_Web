import { ActiveSessionService } from './ActiveSessionService';
import { CountUpGameService } from './CountUpGameService';
import { CricketGameService } from './CricketGameService';
import { MatchGameService } from './MatchGameService';
import { RatingApplicationService } from './RatingApplicationService';
import { RatingRecalculationService } from './RatingRecalculationService';
import { ZeroOneGameService } from './ZeroOneGameService';
import { createAccountService, type AccountService } from '../../../account';
import type { GameDatabaseConnection } from '../../infrastructure/sqlite/types';
import { createGameRepositories } from '../../infrastructure/sqlite/repositories';

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
export type {
  MatchDiagnosticReport,
  MatchDiagnosticSummary,
  MatchRepairResult,
} from './MatchDiagnostics';
export { clearMatchRedoSession, MatchRedoSession } from './MatchRedoSession';
export { createMatchLeaveChoices } from './matchLeaveActions';
export type { MatchLeaveChoice, MatchLeaveChoiceId } from './matchLeaveActions';
export { ZeroOneGameService, ZeroOneActiveGameExistsError } from './ZeroOneGameService';
export { RatingApplicationService };
export type { RatingApplicationServicePort } from './RatingApplicationService';
export { RatingRecalculationService };
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
  rating: RatingApplicationService;
  zeroOne: ZeroOneGameService;
};

export function createGameServices(db: GameDatabaseConnection): GameServices {
  const countUp = new CountUpGameService(db);
  const cricket = new CricketGameService(db);
  const match = new MatchGameService(db);
  const repositories = createGameRepositories(db);
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
    rating: new RatingApplicationService(repositories.ratings),
    zeroOne,
  };
}

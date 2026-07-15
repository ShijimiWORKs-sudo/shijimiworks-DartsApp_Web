export type ActiveSessionMode = 'count_up' | 'zero_one' | 'cricket' | 'match';

export type ActiveSessionInfo = {
  mode: ActiveSessionMode;
  id: string;
  status: 'in_progress' | 'paused';
  route: string;
  label: string;
};

type ActiveSessionServiceDependencies = {
  countUp: {
    getActiveGame(): Promise<{ gameId: string; status: string } | null>;
    abortGame(gameId: string): Promise<void>;
  };
  cricket: {
    getActiveGame(): Promise<{ gameId: string; status: string } | null>;
    abortGame(gameId: string): Promise<void>;
  };
  match: {
    getActiveMatch(): Promise<{ matchId: string; status: string } | null>;
    abortMatch(matchId: string): Promise<void>;
  };
  zeroOne: {
    getActiveGame(): Promise<{ gameId: string; status: string } | null>;
    abortGame(gameId: string): Promise<void>;
  };
};

export class ActiveSessionAbortFailedError extends Error {
  constructor(readonly session: ActiveSessionInfo) {
    super('Active session remains after abort.');
    this.name = 'ActiveSessionAbortFailedError';
  }
}

export class ActiveSessionService {
  constructor(private readonly dependencies: ActiveSessionServiceDependencies) {}

  async findActiveSession(): Promise<ActiveSessionInfo | null> {
    const activeMatch = await this.dependencies.match.getActiveMatch();
    if (activeMatch) {
      return {
        mode: 'match',
        id: activeMatch.matchId,
        status: normalizeStatus(activeMatch.status),
        route: `/game/match/${activeMatch.matchId}`,
        label: 'MATCH',
      };
    }

    const activeCricket = await this.dependencies.cricket.getActiveGame();
    if (activeCricket) {
      return {
        mode: 'cricket',
        id: activeCricket.gameId,
        status: normalizeStatus(activeCricket.status),
        route: `/game/cricket/${activeCricket.gameId}`,
        label: 'STANDARD CRICKET',
      };
    }

    const activeZeroOne = await this.dependencies.zeroOne.getActiveGame();
    if (activeZeroOne) {
      return {
        mode: 'zero_one',
        id: activeZeroOne.gameId,
        status: normalizeStatus(activeZeroOne.status),
        route: `/game/01/${activeZeroOne.gameId}`,
        label: '01 GAME',
      };
    }

    const activeCountUp = await this.dependencies.countUp.getActiveGame();
    if (activeCountUp) {
      return {
        mode: 'count_up',
        id: activeCountUp.gameId,
        status: normalizeStatus(activeCountUp.status),
        route: `/game/count-up/${activeCountUp.gameId}`,
        label: 'COUNT-UP',
      };
    }

    return null;
  }

  async abortActiveSession(session: ActiveSessionInfo): Promise<void> {
    if (session.mode === 'match') {
      await this.dependencies.match.abortMatch(session.id);
    } else if (session.mode === 'cricket') {
      await this.dependencies.cricket.abortGame(session.id);
    } else if (session.mode === 'zero_one') {
      await this.dependencies.zeroOne.abortGame(session.id);
    } else {
      await this.dependencies.countUp.abortGame(session.id);
    }

    const remaining = await this.findActiveSession();
    if (remaining) {
      throw new ActiveSessionAbortFailedError(remaining);
    }
  }
}

function normalizeStatus(status: string): 'in_progress' | 'paused' {
  return status === 'paused' ? 'paused' : 'in_progress';
}

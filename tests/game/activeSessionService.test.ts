import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ActiveSessionAbortFailedError,
  ActiveSessionService,
  type ActiveSessionInfo,
} from '../../features/game/application/services';

type Mode = ActiveSessionInfo['mode'];
type ServiceState = Record<Mode, { id: string; status: 'in_progress' | 'paused' } | null>;

function createService(state: Partial<ServiceState>) {
  const current: ServiceState = {
    count_up: state.count_up ?? null,
    cricket: state.cricket ?? null,
    match: state.match ?? null,
    zero_one: state.zero_one ?? null,
  };
  const aborts: string[] = [];
  const service = new ActiveSessionService({
    countUp: {
      getActiveGame: async () =>
        current.count_up ? { gameId: current.count_up.id, status: current.count_up.status } : null,
      abortGame: async (gameId) => {
        aborts.push(`count_up:${gameId}`);
        current.count_up = null;
      },
    },
    cricket: {
      getActiveGame: async () =>
        current.cricket ? { gameId: current.cricket.id, status: current.cricket.status } : null,
      abortGame: async (gameId) => {
        aborts.push(`cricket:${gameId}`);
        current.cricket = null;
      },
    },
    match: {
      getActiveMatch: async () =>
        current.match ? { matchId: current.match.id, status: current.match.status } : null,
      abortMatch: async (matchId) => {
        aborts.push(`match:${matchId}`);
        current.match = null;
      },
    },
    zeroOne: {
      getActiveGame: async () =>
        current.zero_one ? { gameId: current.zero_one.id, status: current.zero_one.status } : null,
      abortGame: async (gameId) => {
        aborts.push(`zero_one:${gameId}`);
        current.zero_one = null;
      },
    },
  });
  return { aborts, current, service };
}

test('active session detection prioritizes MATCH over CRICKET, 01, and COUNT-UP', async () => {
  const { service } = createService({
    count_up: { id: 'count-up-1', status: 'paused' },
    cricket: { id: 'cricket-1', status: 'paused' },
    match: { id: 'match-1', status: 'in_progress' },
    zero_one: { id: 'zero-one-1', status: 'paused' },
  });

  assert.deepEqual(await service.findActiveSession(), {
    mode: 'match',
    id: 'match-1',
    status: 'in_progress',
    route: '/game/match/match-1',
    label: 'MATCH',
  });
});

test('paused COUNT-UP is reported with resume route for settings preflight', async () => {
  const { service } = createService({
    count_up: { id: 'count-up-1', status: 'paused' },
  });

  assert.deepEqual(await service.findActiveSession(), {
    mode: 'count_up',
    id: 'count-up-1',
    status: 'paused',
    route: '/game/count-up/count-up-1',
    label: 'COUNT-UP',
  });
});

test('paused 01 and paused CRICKET are detected before starting another mode', async () => {
  const zeroOne = createService({ zero_one: { id: 'zero-one-1', status: 'paused' } });
  assert.equal((await zeroOne.service.findActiveSession())?.route, '/game/01/zero-one-1');

  const cricket = createService({ cricket: { id: 'cricket-1', status: 'paused' } });
  assert.equal((await cricket.service.findActiveSession())?.route, '/game/cricket/cricket-1');
});

test('active MATCH blocks standalone game starts through preflight', async () => {
  const { service } = createService({
    match: { id: 'match-1', status: 'paused' },
  });

  const activeSession = await service.findActiveSession();
  assert.equal(activeSession?.mode, 'match');
  assert.equal(activeSession?.route, '/game/match/match-1');
});

test('abortActiveSession aborts then verifies the active session is gone', async () => {
  const { aborts, service } = createService({
    count_up: { id: 'count-up-1', status: 'paused' },
  });
  const activeSession = await service.findActiveSession();
  assert(activeSession);

  await service.abortActiveSession(activeSession);

  assert.deepEqual(aborts, ['count_up:count-up-1']);
  assert.equal(await service.findActiveSession(), null);
});

test('abortActiveSession rejects when the active session remains', async () => {
  const current: ServiceState = {
    count_up: { id: 'count-up-1', status: 'paused' },
    cricket: null,
    match: null,
    zero_one: null,
  };
  const service = new ActiveSessionService({
    countUp: {
      getActiveGame: async () =>
        current.count_up ? { gameId: current.count_up.id, status: current.count_up.status } : null,
      abortGame: async () => {
        // Simulate abort failure without clearing the active game.
      },
    },
    cricket: { getActiveGame: async () => null, abortGame: async () => {} },
    match: { getActiveMatch: async () => null, abortMatch: async () => {} },
    zeroOne: { getActiveGame: async () => null, abortGame: async () => {} },
  });
  const activeSession = await service.findActiveSession();
  assert(activeSession);

  await assert.rejects(
    () => service.abortActiveSession(activeSession),
    ActiveSessionAbortFailedError,
  );
});

test('without an active session settings screens may start directly', async () => {
  const { service } = createService({});
  assert.equal(await service.findActiveSession(), null);
});

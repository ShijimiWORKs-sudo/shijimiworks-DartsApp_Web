import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAccountBootstrap,
  shouldRunAccountBootstrap,
  type AccountServicePort,
} from '../../features/account/application';
import type { AccountOverview } from '../../features/account/domain';

test('bootstrap restores the only local registered account when activeAccountId is null', async () => {
  const overview = createOverview('account-1');
  const result = await resolveAccountBootstrap(createService({ activeOverview: overview }), null);

  assert.equal(result.status, 'registered');
  assert.equal(result.activeAccountId, 'account-1');
  assert.equal(result.shouldPersistActiveAccountId, true);
});

test('bootstrap preserves activeAccountId when the account exists', async () => {
  const overview = createOverview('account-1');
  const result = await resolveAccountBootstrap(
    createService({ byId: { 'account-1': overview } }),
    'account-1',
  );

  assert.equal(result.status, 'registered');
  assert.equal(result.activeAccountId, 'account-1');
  assert.equal(result.shouldPersistActiveAccountId, false);
});

test('bootstrap clears activeAccountId only when the account is confirmed missing', async () => {
  const result = await resolveAccountBootstrap(createService({ byId: {} }), 'missing-account');

  assert.equal(result.status, 'unregistered');
  assert.equal(result.activeAccountId, null);
  assert.equal(result.shouldPersistActiveAccountId, true);
});

test('bootstrap keeps activeAccountId on SQLITE_BUSY or SQLITE_LOCKED', async () => {
  const result = await resolveAccountBootstrap(
    createService({
      getByIdError: Object.assign(new Error('Database is locked'), { code: 'SQLITE_BUSY' }),
    }),
    'account-1',
    { retryCount: 0 },
  );

  assert.equal(result.status, 'temporarilyUnavailable');
  assert.equal(result.activeAccountId, 'account-1');
  assert.equal(result.shouldPersistActiveAccountId, false);
});

test('bootstrap retries a temporary SQLite lock before restoring account', async () => {
  let attempts = 0;
  const overview = createOverview('account-1');
  const result = await resolveAccountBootstrap(
    createService({
      getById: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('SQLITE_LOCKED'), { code: 'SQLITE_LOCKED' });
        }
        return overview;
      },
    }),
    'account-1',
    { retryDelayMs: 1 },
  );

  assert.equal(attempts, 2);
  assert.equal(result.status, 'registered');
  assert.equal(result.activeAccountId, 'account-1');
});

test('bootstrap run predicate ignores unrelated theme changes', () => {
  const previous = {
    activeAccountId: 'account-1',
    isAppStateLoading: false,
    isDatabaseAvailable: true,
  };

  assert.equal(shouldRunAccountBootstrap(previous, { ...previous }), false);
  assert.equal(
    shouldRunAccountBootstrap(previous, { ...previous, activeAccountId: 'account-2' }),
    true,
  );
});

function createService({
  activeOverview = null,
  byId = {},
  getById,
  getByIdError,
}: {
  activeOverview?: AccountOverview | null;
  byId?: Record<string, AccountOverview | null>;
  getById?: (accountId: string) => Promise<AccountOverview | null>;
  getByIdError?: unknown;
}): AccountServicePort {
  return {
    getActiveAccount: async () => activeOverview,
    getAccountById: async (accountId) => {
      if (getById) {
        return getById(accountId);
      }
      if (getByIdError) {
        throw getByIdError;
      }
      return byId[accountId] ?? null;
    },
    getRegistrationTarget: async () => null,
    registerLocalAccount: async () => {
      throw new Error('not implemented');
    },
    updateProfile: async () => {
      throw new Error('not implemented');
    },
    ensureRatingProfile: async () => {
      throw new Error('not implemented');
    },
    seedEstablishedRatingProfile: async () => {
      throw new Error('not implemented');
    },
  };
}

function createOverview(accountId: string): AccountOverview {
  return {
    account: {
      id: accountId,
      userName: 'player_01',
      displayName: 'Player One',
      emailNormalized: null,
      status: 'local_registered',
      authProvider: 'local',
      registeredAt: '2026-07-13T00:00:00.000Z',
      verifiedAt: null,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
    ownerPlayer: {
      id: 'owner-1',
      displayName: 'Player One',
    },
    ratingProfile: {
      accountId,
      ownerPlayerId: 'owner-1',
      measurementStatus: 'unmeasured',
      ratingTenths: null,
      preciseRatingMilli: null,
      confidenceBp: 0,
      eligibleMatchCount: 0,
      eligibleStandaloneZeroOneCount: 0,
      eligibleStandaloneCricketCount: 0,
      zeroOneIndexMilli: null,
      cricketIndexMilli: null,
      matchIndexMilli: null,
      establishedAt: null,
      lastEvaluatedAt: null,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    },
  };
}

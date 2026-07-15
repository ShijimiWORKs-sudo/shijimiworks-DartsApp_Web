import type { AccountServicePort } from './AccountServicePort';
import type { AccountOverview } from '../domain';

export type AccountBootstrapStatus =
  'loading' | 'registered' | 'unregistered' | 'temporarilyUnavailable';

export type AccountBootstrapResult = {
  status: Exclude<AccountBootstrapStatus, 'loading'>;
  activeAccountId: string | null;
  overview: AccountOverview | null;
  shouldPersistActiveAccountId: boolean;
  temporaryError?: unknown;
};

export type AccountBootstrapInputs = {
  activeAccountId: string | null;
  isAppStateLoading: boolean;
  isDatabaseAvailable: boolean;
};

type AccountBootstrapOptions = {
  retryCount?: number;
  retryDelayMs?: number;
};

export function shouldRunAccountBootstrap(
  previous: AccountBootstrapInputs | null,
  next: AccountBootstrapInputs,
) {
  return (
    !previous ||
    previous.activeAccountId !== next.activeAccountId ||
    previous.isAppStateLoading !== next.isAppStateLoading ||
    previous.isDatabaseAvailable !== next.isDatabaseAvailable
  );
}

export async function resolveAccountBootstrap(
  accountService: AccountServicePort,
  activeAccountId: string | null,
  options: AccountBootstrapOptions = {},
): Promise<AccountBootstrapResult> {
  try {
    if (activeAccountId) {
      const overview = await withSqliteLockRetry(
        () => accountService.getAccountById(activeAccountId),
        options,
      );

      if (overview && isRegisteredOverview(overview)) {
        return {
          status: 'registered',
          activeAccountId,
          overview,
          shouldPersistActiveAccountId: false,
        };
      }

      const registered = await findRegisteredAccount(accountService, options);
      if (registered) {
        return {
          status: 'registered',
          activeAccountId: registered.account.id,
          overview: registered,
          shouldPersistActiveAccountId: registered.account.id !== activeAccountId,
        };
      }

      return {
        status: 'unregistered',
        activeAccountId: null,
        overview: null,
        shouldPersistActiveAccountId: true,
      };
    }

    const registered = await findRegisteredAccount(accountService, options);

    if (registered) {
      return {
        status: 'registered',
        activeAccountId: registered.account.id,
        overview: registered,
        shouldPersistActiveAccountId: true,
      };
    }

    return {
      status: 'unregistered',
      activeAccountId: null,
      overview: null,
      shouldPersistActiveAccountId: false,
    };
  } catch (error) {
    if (isTemporarySqliteLockError(error)) {
      return {
        status: 'temporarilyUnavailable',
        activeAccountId,
        overview: null,
        shouldPersistActiveAccountId: false,
        temporaryError: error,
      };
    }

    throw error;
  }
}

async function findRegisteredAccount(
  accountService: AccountServicePort,
  options: AccountBootstrapOptions,
) {
  return withSqliteLockRetry(() => accountService.getActiveAccount(null), options);
}

export function isTemporarySqliteLockError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';

  return (
    code === 'SQLITE_BUSY' ||
    code === 'SQLITE_LOCKED' ||
    /SQLITE_BUSY|SQLITE_LOCKED|database is locked|error code 5/i.test(message) ||
    (candidate?.cause ? isTemporarySqliteLockError(candidate.cause) : false)
  );
}

async function withSqliteLockRetry<T>(
  operation: () => Promise<T>,
  options: AccountBootstrapOptions,
): Promise<T> {
  const retryCount = options.retryCount ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 80;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTemporarySqliteLockError(error) || attempt >= retryCount) {
        throw error;
      }
      await delay(retryDelayMs * (attempt + 1));
    }
  }
}

function isRegisteredOverview(overview: AccountOverview) {
  return (
    overview.account.status === 'local_registered' || overview.account.status === 'cloud_verified'
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

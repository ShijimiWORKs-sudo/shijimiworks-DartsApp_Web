import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppState } from '../contexts/AppStateContext';
import { useGameDatabase } from '../contexts/GameDatabaseContext';
import { resolveAccountBootstrap } from '../features/account/application';
import type { AccountOverview } from '../features/account/domain';

export type ActiveAccountResolutionStatus =
  | 'app_state_loading'
  | 'database_loading'
  | 'account_resolving'
  | 'registered'
  | 'unregistered'
  | 'temporarily_unavailable'
  | 'error';

export type ActiveAccountResolution = {
  overview: AccountOverview | null;
  status: ActiveAccountResolutionStatus;
  isResolving: boolean;
  errorMessage: string | null;
  reload: () => void;
};

type UseActiveAccountOverviewOptions = {
  processPendingRating?: boolean;
};

export function useActiveAccountOverview(
  options: UseActiveAccountOverviewOptions = {},
): ActiveAccountResolution {
  const { activeAccountId, isLoading: isAppStateLoading, setActiveAccountId } = useAppState();
  const { initializationError, isAvailable, isInitializing, services } = useGameDatabase();
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [status, setStatus] = useState<ActiveAccountResolutionStatus>('app_state_loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const processPendingRating = options.processPendingRating === true;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void reloadToken;

      async function resolveActiveAccount() {
        if (isAppStateLoading) {
          setStatus('app_state_loading');
          setErrorMessage(null);
          return;
        }

        if (initializationError) {
          setStatus('error');
          setErrorMessage(initializationError.message);
          return;
        }

        if (isInitializing || !isAvailable || !services) {
          setStatus('database_loading');
          setErrorMessage(null);
          return;
        }

        setStatus('account_resolving');
        setErrorMessage(null);

        try {
          if (processPendingRating) {
            await services.rating.processPending();
          }

          const result = await resolveAccountBootstrap(services.account, activeAccountId);
          if (!mounted) {
            return;
          }

          if (result.shouldPersistActiveAccountId && result.activeAccountId !== activeAccountId) {
            await setActiveAccountId(result.activeAccountId);
          }

          if (!mounted) {
            return;
          }

          if (result.status === 'registered' && result.activeAccountId) {
            const refreshed =
              result.overview?.account.id === result.activeAccountId
                ? result.overview
                : await services.account.getAccountById(result.activeAccountId);

            if (!mounted) {
              return;
            }

            setOverview(refreshed);
            setStatus(refreshed ? 'registered' : 'unregistered');
            return;
          }

          setOverview(null);
          setStatus(
            result.status === 'temporarilyUnavailable' ? 'temporarily_unavailable' : 'unregistered',
          );
          setErrorMessage(
            result.temporaryError instanceof Error ? result.temporaryError.message : null,
          );
        } catch (error) {
          if (!mounted) {
            return;
          }
          setOverview(null);
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : '不明なエラーです。');
        }
      }

      void resolveActiveAccount();
      return () => {
        mounted = false;
      };
    }, [
      activeAccountId,
      initializationError,
      isAppStateLoading,
      isAvailable,
      isInitializing,
      processPendingRating,
      reloadToken,
      services,
      setActiveAccountId,
    ]),
  );

  return {
    overview,
    status,
    isResolving:
      status === 'app_state_loading' ||
      status === 'database_loading' ||
      status === 'account_resolving',
    errorMessage,
    reload: () => setReloadToken((current) => current + 1),
  };
}

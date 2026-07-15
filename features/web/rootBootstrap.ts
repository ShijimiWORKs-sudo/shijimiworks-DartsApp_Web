export type DartsAppRootBootstrapInputs = {
  isAppStateLoading: boolean;
  isDatabaseInitializing: boolean;
  isDatabaseAvailable: boolean;
  initializationError: Error | null;
};

export type DartsAppRootBootstrapState = 'loading' | 'replace_home' | 'database_error';

export function resolveDartsAppRootBootstrapState({
  isAppStateLoading,
  isDatabaseInitializing,
  isDatabaseAvailable,
  initializationError,
}: DartsAppRootBootstrapInputs): DartsAppRootBootstrapState {
  if (initializationError) {
    return 'database_error';
  }

  if (isAppStateLoading || isDatabaseInitializing || !isDatabaseAvailable) {
    return 'loading';
  }

  return 'replace_home';
}

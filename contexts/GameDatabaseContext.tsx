import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Text, View } from 'react-native';

import { useAppState } from './AppStateContext';
import type {
  AccountBootstrapInputs,
  AccountBootstrapStatus,
} from '../features/account/application';
import {
  resolveAccountBootstrap,
  shouldRunAccountBootstrap,
} from '../features/account/application';
import type { GameRepositories } from '../features/game/application/ports';
import { createGameServices } from '../features/game/application/services';
import type { GameServices } from '../features/game/application/services';
import {
  GAME_DATABASE_FILE_NAME,
  initializeGameDatabase,
} from '../features/game/infrastructure/sqlite/database';
import { createGameRepositories } from '../features/game/infrastructure/sqlite/repositories';
import type { GameDatabaseConnection } from '../features/game/infrastructure/sqlite/types';

type GameDatabaseContextValue = {
  isInitializing: boolean;
  isAvailable: boolean;
  initializationError: Error | null;
  accountBootstrapStatus: AccountBootstrapStatus;
  accountBootstrapError: Error | null;
  repositories: GameRepositories | null;
  services: GameServices | null;
};

const GameDatabaseContext = createContext<GameDatabaseContextValue>({
  isInitializing: true,
  isAvailable: false,
  initializationError: null,
  accountBootstrapStatus: 'loading',
  accountBootstrapError: null,
  repositories: null,
  services: null,
});

export function GameDatabaseProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<GameDatabaseContextValue>({
    isInitializing: true,
    isAvailable: false,
    initializationError: null,
    accountBootstrapStatus: 'loading',
    accountBootstrapError: null,
    repositories: null,
    services: null,
  });

  const handleInit = useCallback(async (db: GameDatabaseConnection) => {
    await initializeGameDatabase(db);
  }, []);

  const handleError = useCallback((error: Error) => {
    setValue({
      isInitializing: false,
      isAvailable: false,
      initializationError: error,
      accountBootstrapStatus: 'temporarilyUnavailable',
      accountBootstrapError: error,
      repositories: null,
      services: null,
    });
  }, []);

  if (value.initializationError) {
    return (
      <GameDatabaseContext.Provider value={value}>
        {children}
        <GameDatabaseErrorBanner error={value.initializationError} />
      </GameDatabaseContext.Provider>
    );
  }

  return (
    <GameDatabaseContext.Provider value={value}>
      <SQLiteProvider
        databaseName={GAME_DATABASE_FILE_NAME}
        onInit={handleInit}
        onError={handleError}
      >
        <GameDatabaseRepositoryBridge setValue={setValue}>{children}</GameDatabaseRepositoryBridge>
      </SQLiteProvider>
    </GameDatabaseContext.Provider>
  );
}

function GameDatabaseRepositoryBridge({
  children,
  setValue,
}: {
  children: ReactNode;
  setValue: Dispatch<SetStateAction<GameDatabaseContextValue>>;
}) {
  const db = useSQLiteContext() as GameDatabaseConnection;
  const { activeAccountId, isLoading: isAppStateLoading, setActiveAccountId } = useAppState();
  const repositories = useMemo(() => createGameRepositories(db), [db]);
  const services = useMemo(() => createGameServices(db), [db]);
  const lastBootstrapInputRef = useRef<AccountBootstrapInputs | null>(null);

  useEffect(() => {
    setValue({
      isInitializing: false,
      isAvailable: true,
      initializationError: null,
      accountBootstrapStatus: isAppStateLoading ? 'loading' : 'unregistered',
      accountBootstrapError: null,
      repositories,
      services,
    });

    return () => {
      setValue({
        isInitializing: true,
        isAvailable: false,
        initializationError: null,
        accountBootstrapStatus: 'loading',
        accountBootstrapError: null,
        repositories: null,
        services: null,
      });
    };
  }, [isAppStateLoading, repositories, services, setValue]);

  useEffect(() => {
    const nextBootstrapInput: AccountBootstrapInputs = {
      activeAccountId,
      isAppStateLoading,
      isDatabaseAvailable: true,
    };

    if (!shouldRunAccountBootstrap(lastBootstrapInputRef.current, nextBootstrapInput)) {
      return;
    }
    lastBootstrapInputRef.current = nextBootstrapInput;

    if (isAppStateLoading) {
      setValue((current) => ({
        ...current,
        accountBootstrapStatus: 'loading',
        accountBootstrapError: null,
      }));
      return;
    }

    let mounted = true;
    const accountId = activeAccountId;

    async function bootstrapActiveAccount() {
      setValue((current) => ({
        ...current,
        accountBootstrapStatus: 'loading',
        accountBootstrapError: null,
      }));

      const result = await resolveAccountBootstrap(services.account, accountId);

      if (!mounted) {
        return;
      }

      if (result.shouldPersistActiveAccountId && result.activeAccountId !== accountId) {
        await setActiveAccountId(result.activeAccountId);
      }

      if (!mounted) {
        return;
      }

      setValue((current) => ({
        ...current,
        accountBootstrapStatus: result.status,
        accountBootstrapError:
          result.temporaryError instanceof Error ? result.temporaryError : null,
      }));
    }

    void bootstrapActiveAccount().catch((error) => {
      console.warn('Account bootstrap failed', error);
      if (mounted) {
        setValue((current) => ({
          ...current,
          accountBootstrapStatus: 'temporarilyUnavailable',
          accountBootstrapError: error instanceof Error ? error : null,
        }));
      }
    });

    return () => {
      mounted = false;
    };
  }, [activeAccountId, isAppStateLoading, services, setActiveAccountId, setValue]);

  return <>{children}</>;
}

function GameDatabaseErrorBanner({ error }: { error: Error }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        borderRadius: 8,
        backgroundColor: '#7f1d1d',
        padding: 12,
      }}
    >
      <Text style={{ color: '#ffffff', fontWeight: '700' }}>ゲームDBを初期化できませんでした</Text>
      <Text style={{ color: '#fee2e2', marginTop: 4 }}>{error.message}</Text>
    </View>
  );
}

export function useGameDatabase() {
  return useContext(GameDatabaseContext);
}

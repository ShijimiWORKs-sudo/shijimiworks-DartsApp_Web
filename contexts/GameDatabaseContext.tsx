import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Text, View } from 'react-native';

import type { GameRepositories } from '../features/game/application/ports';
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
  repositories: GameRepositories | null;
};

const GameDatabaseContext = createContext<GameDatabaseContextValue>({
  isInitializing: true,
  isAvailable: false,
  initializationError: null,
  repositories: null,
});

export function GameDatabaseProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<GameDatabaseContextValue>({
    isInitializing: true,
    isAvailable: false,
    initializationError: null,
    repositories: null,
  });

  const handleInit = useCallback(async (db: GameDatabaseConnection) => {
    await initializeGameDatabase(db);
  }, []);

  const handleError = useCallback((error: Error) => {
    setValue({
      isInitializing: false,
      isAvailable: false,
      initializationError: error,
      repositories: null,
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
  const repositories = useMemo(() => createGameRepositories(db), [db]);

  useEffect(() => {
    setValue({
      isInitializing: false,
      isAvailable: true,
      initializationError: null,
      repositories,
    });

    return () => {
      setValue({
        isInitializing: true,
        isAvailable: false,
        initializationError: null,
        repositories: null,
      });
    };
  }, [repositories, setValue]);

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

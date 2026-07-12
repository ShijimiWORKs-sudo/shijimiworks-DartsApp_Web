import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStateProvider } from '../contexts/AppStateContext';
import { GameDatabaseProvider } from '../contexts/GameDatabaseContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <GameDatabaseProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#f7fbf8' },
            }}
          />
        </GameDatabaseProvider>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../contexts/AppStateContext';
import { useGameDatabase } from '../contexts/GameDatabaseContext';
import { resolveDartsAppRootBootstrapState } from '../features/web/rootBootstrap';

export default function DartsAppRootBootstrapScreen() {
  const router = useRouter();
  const { isLoading: isAppStateLoading } = useAppState();
  const { initializationError, isAvailable, isInitializing } = useGameDatabase();
  const bootstrapState = resolveDartsAppRootBootstrapState({
    isAppStateLoading,
    isDatabaseInitializing: isInitializing,
    isDatabaseAvailable: isAvailable,
    initializationError,
  });

  useEffect(() => {
    if (bootstrapState === 'replace_home') {
      router.replace('/home');
    }
  }, [bootstrapState, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DartsApp</Text>
      <Text style={styles.message}>
        {bootstrapState === 'database_error'
          ? 'ゲームデータを準備できませんでした。'
          : 'ゲームデータを準備しています...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7fbf8',
    padding: 24,
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
});

import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppState } from '../contexts/AppStateContext';
import { BottomNav } from './BottomNav';

type ScreenShellProps = PropsWithChildren<{
  showNav?: boolean;
}>;

export function ScreenShell({ children, showNav = true }: ScreenShellProps) {
  const { theme } = useAppState();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {showNav ? <BottomNav /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 20,
    paddingBottom: 140,
  },
});

import type { PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppState } from '../contexts/AppStateContext';
import { BottomNav } from './BottomNav';
import { WebTopNavigation } from './web/WebTopNavigation';
import {
  getWebContentMaxWidth,
  isDesktopWebLayout,
  shouldShowBottomNavigation,
  shouldShowWebTopNavigation,
} from './web/webLayout';

type ScreenShellProps = PropsWithChildren<{
  showNav?: boolean;
}>;

export function ScreenShell({ children, showNav = true }: ScreenShellProps) {
  const { theme } = useAppState();
  const { width } = useWindowDimensions();
  const isDesktopWeb = isDesktopWebLayout(Platform.OS, width);
  const showWebTopNav = shouldShowWebTopNavigation(Platform.OS, width, showNav);
  const showBottomNav = shouldShowBottomNavigation(Platform.OS, width, showNav);
  const maxWidth = getWebContentMaxWidth(width);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {showWebTopNav ? <WebTopNavigation /> : null}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && [styles.desktopScrollContent, { maxWidth }],
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {showBottomNav ? (
          <View style={styles.mobileBottomNav}>
            <BottomNav />
          </View>
        ) : null}
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 140,
  },
  desktopScrollContent: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 24,
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  mobileBottomNav: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
});

import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { getWebGameActionColumnWidth, isDesktopWebLayout, WEB_COMPACT_WIDTH } from './webLayout';

type WebGameShellProps = {
  top?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  footer?: ReactNode;
};

export function WebGameShell({ top, left, right, footer }: WebGameShellProps) {
  const { width } = useWindowDimensions();
  const isDesktop = isDesktopWebLayout(Platform.OS, width);

  if (!isDesktop) {
    return (
      <View style={styles.stack}>
        {top}
        {left}
        {right}
        {footer}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {top}
      <View style={[styles.desktopGrid, width <= WEB_COMPACT_WIDTH && styles.compactDesktopGrid]}>
        <View style={styles.scoreColumn}>{left}</View>
        <View style={[styles.actionColumn, { width: getWebGameActionColumnWidth(width) }]}>
          {right}
        </View>
      </View>
      {footer}
    </View>
  );
}

type WebResponsiveGridProps = {
  children: ReactNode;
};

export function WebResponsiveGrid({ children }: WebResponsiveGridProps) {
  const { width } = useWindowDimensions();
  const isDesktop = isDesktopWebLayout(Platform.OS, width);

  return (
    <View style={[styles.responsiveGrid, isDesktop && styles.desktopResponsiveGrid]}>
      {children}
    </View>
  );
}

export const webGameStyles = StyleSheet.create({
  desktopActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  desktopActionButton: {
    minWidth: 128,
    flexGrow: 1,
    flexBasis: '30%',
  },
  desktopFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  desktopFooterButton: {
    minWidth: 180,
  },
  desktopStatItem: {
    width: '31%',
  },
  desktopGridCard: {
    width: '48%',
    minWidth: 360,
    flexGrow: 1,
  },
  desktopFullWidthCard: {
    width: '100%',
  },
});

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  compactDesktopGrid: {
    gap: 14,
  },
  scoreColumn: {
    flex: 1,
    gap: 14,
  },
  actionColumn: {
    gap: 14,
  },
  responsiveGrid: {
    gap: 16,
  },
  desktopResponsiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
});

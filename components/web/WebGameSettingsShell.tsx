import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors } from '../../constants/theme';
import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { getWebGameSettingsShellDirection } from './webLayout';

type WebGameSettingsShellProps = {
  settings: ReactNode;
  summary: ReactNode;
};

type WebSettingsSummaryCardProps = {
  title: string;
  children: ReactNode;
  actions: ReactNode;
};

type WebSettingsSummaryRowProps = {
  label: string;
  value: string;
};

export function WebGameSettingsShell({ settings, summary }: WebGameSettingsShellProps) {
  const { width } = useWindowDimensions();
  const direction = getWebGameSettingsShellDirection(Platform.OS, width);
  const isDesktop = direction === 'row';

  return (
    <View
      testID="web-game-settings-shell"
      style={[styles.shell, isDesktop ? styles.desktopTwoColumn : styles.mobileStack]}
    >
      <View
        testID="web-game-settings-column"
        style={isDesktop ? styles.desktopSettingsColumn : styles.mobileColumn}
      >
        {settings}
      </View>
      <View
        testID="web-game-summary-column"
        style={isDesktop ? styles.desktopSummaryColumn : styles.mobileColumn}
      >
        {summary}
      </View>
    </View>
  );
}

export function WebSettingsSummaryCard({ title, children, actions }: WebSettingsSummaryCardProps) {
  return (
    <Card style={styles.summaryCard}>
      <SectionTitle title={title} tone="card" />
      <View style={styles.summaryRows}>{children}</View>
      <View style={styles.summaryActions}>{actions}</View>
    </Card>
  );
}

export function WebSettingsSummaryRow({ label, value }: WebSettingsSummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export const webGameSettingsStyles = StyleSheet.create({
  settingsStack: {
    gap: 14,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  settingsGridCard: {
    minWidth: 260,
    flexBasis: '48%',
    flexGrow: 1,
  },
  summaryButton: {
    width: '100%',
  },
});

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  desktopTwoColumn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 22,
  },
  mobileStack: {
    flexDirection: 'column',
    gap: 16,
  },
  desktopSettingsColumn: {
    flexBasis: '64%',
    flexGrow: 1,
    flexShrink: 1,
  },
  desktopSummaryColumn: {
    flexBasis: '36%',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  mobileColumn: {
    width: '100%',
  },
  summaryCard: {
    width: '100%',
  },
  summaryRows: {
    gap: 10,
    marginTop: 14,
  },
  summaryRow: {
    gap: 3,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  summaryActions: {
    gap: 10,
    marginTop: 18,
  },
});

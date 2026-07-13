import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { colors } from '../../constants/theme';
import type { AccountOverview } from '../../features/account/domain';
import { getAccountStatusLabel } from './accountUiModel';

type AccountSummaryCardProps = {
  overview: AccountOverview;
};

export function AccountSummaryCard({ overview }: AccountSummaryCardProps) {
  return (
    <Card>
      <SectionTitle title="Account" subtitle="この端末内のRating所有者です。" tone="card" />
      <View style={styles.rows}>
        <InfoRow label="ユーザーID" value={overview.account.userName ?? '未設定'} />
        <InfoRow label="表示名" value={overview.account.displayName} />
        <InfoRow label="メール" value={overview.account.emailNormalized ?? '未設定'} />
        <InfoRow label="状態" value={getAccountStatusLabel(overview.account.status)} />
        <InfoRow label="OWNER" value={overview.ownerPlayer.displayName} />
      </View>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 10,
    marginTop: 14,
  },
  row: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
});

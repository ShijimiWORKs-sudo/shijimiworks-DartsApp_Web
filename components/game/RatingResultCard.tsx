import { StyleSheet, Text, View } from 'react-native';

import type { RatingSourceResult } from '../../features/game/application/ports';
import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { formatConfidence, formatRatingTenths } from '../account/accountUiModel';
import { colors } from '../../constants/theme';

type RatingResultCardProps = {
  result: RatingSourceResult | null;
  countUp?: boolean;
};

export function RatingResultCard({ result, countUp = false }: RatingResultCardProps) {
  if (countUp) {
    return (
      <Card>
        <SectionTitle title="Rating" tone="card" />
        <Text style={styles.status}>Rating対象外</Text>
        <Text style={styles.message}>COUNT-UPはRating計算には使用されません。</Text>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <SectionTitle title="Rating" tone="card" />
        <Text style={styles.status}>評価処理中</Text>
        <Text style={styles.message}>Rating評価結果を確認しています。</Text>
      </Card>
    );
  }

  if (result.status === 'applied') {
    return (
      <Card>
        <SectionTitle title="Rating" tone="card" />
        <Text style={styles.status}>{result.label}</Text>
        <Text style={styles.message}>{result.message}</Text>
        <View style={styles.detailRows}>
          <DetailRow
            label="previous → new"
            value={`${formatRatingTenths(result.snapshot.previousRatingTenths)} → ${formatRatingTenths(result.snapshot.ratingTenths)}`}
          />
          <DetailRow label="delta" value={formatDelta(result.snapshot.appliedDeltaMilli)} />
          <DetailRow label="Confidence" value={formatConfidence(result.snapshot.confidenceBp)} />
        </View>
      </Card>
    );
  }

  if (result.status === 'excluded') {
    return (
      <Card>
        <SectionTitle title="Rating" tone="card" />
        <Text style={styles.status}>{result.label}</Text>
        <Text style={styles.message}>{result.message}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle title="Rating" tone="card" />
      <Text style={styles.status}>{result.label}</Text>
      <Text style={styles.message}>{result.message}</Text>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDelta(deltaMilli: number | null) {
  if (deltaMilli === null) return '-';
  const value = deltaMilli / 1000;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(3)}`;
}

const styles = StyleSheet.create({
  status: {
    marginTop: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  message: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  detailRows: {
    gap: 8,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});

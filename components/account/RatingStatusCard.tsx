import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import { colors } from '../../constants/theme';
import type { AccountOverview } from '../../features/account/domain';
import {
  formatConfidence,
  formatEvaluatedAt,
  formatRatingIndex,
  formatRatingTenths,
  getEligibleMatchProgress,
  getRatingMeasurementLabel,
} from './accountUiModel';

type RatingStatusCardProps = {
  overview: AccountOverview;
};

export function RatingStatusCard({ overview }: RatingStatusCardProps) {
  const profile = overview.ratingProfile;
  const standaloneEligible = profile.establishedAt !== null;
  const ratingLabel = formatRatingTenths(profile.ratingTenths);

  return (
    <Card>
      <SectionTitle
        title="Rating状態"
        subtitle="初回RatingはEligible MATCH 3件で確定します。"
        tone="card"
      />

      <View style={styles.metricGrid}>
        <Metric label="測定状態" value={getRatingMeasurementLabel(profile.measurementStatus)} />
        <Metric
          label="Eligible MATCH"
          value={getEligibleMatchProgress(profile.eligibleMatchCount)}
        />
        <Metric label="DartsApp Rating" value={ratingLabel} />
        <Metric label="Confidence" value={formatConfidence(profile.confidenceBp)} />
        <Metric
          label="単独Rating"
          value={standaloneEligible ? '対象可' : '対象外'}
          emphasis={standaloneEligible}
        />
        <Metric label="01 Index" value={formatRatingIndex(profile.zeroOneIndexMilli)} />
        <Metric label="Cricket Index" value={formatRatingIndex(profile.cricketIndexMilli)} />
        <Metric label="Match Index" value={formatRatingIndex(profile.matchIndexMilli)} />
        <Metric
          label="単独01 / CRICKET"
          value={`${profile.eligibleStandaloneZeroOneCount} / ${profile.eligibleStandaloneCricketCount}`}
        />
        <Metric label="最終評価" value={formatEvaluatedAt(profile.lastEvaluatedAt)} />
      </View>

      <Text style={styles.note}>
        {standaloneEligible
          ? '独自方式による参考値です。単独01とCRICKETは初回Rating確定後のゲームだけを更新対象にします。'
          : '単独01・CRICKETは初回3MATCH確定後のゲームからRating対象になります。'}
      </Text>
    </Card>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.metric, emphasis && styles.metricEmphasis]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, emphasis && styles.metricValueEmphasis]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metric: {
    width: '48%',
    minHeight: 82,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
  },
  metricEmphasis: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 6,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  metricValueEmphasis: {
    color: colors.primaryDark,
  },
  note: {
    marginTop: 14,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});

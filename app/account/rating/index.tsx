import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import {
  formatConfidence,
  formatEvaluatedAt,
  formatRatingIndex,
  formatRatingTenths,
  getEligibleMatchProgress,
  getRatingMeasurementLabel,
} from '../../../components/account/accountUiModel';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../../components/web/WebGameShell';
import { colors } from '../../../constants/theme';
import { useActiveAccountOverview } from '../../../hooks/useActiveAccountOverview';

export default function AccountRatingScreen() {
  const router = useRouter();
  const isDesktopWeb = useDesktopWebLayout();
  const { errorMessage, isResolving, overview } = useActiveAccountOverview({
    processPendingRating: true,
  });

  const profile = overview?.ratingProfile ?? null;

  return (
    <ScreenShell>
      <SectionTitle title="DartsApp Rating" subtitle="独自方式による参考値です。" />

      {!profile ? (
        <Card muted>
          <Text style={styles.message}>{getMissingRatingMessage(isResolving, errorMessage)}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle
              title="現在のDartsApp Rating"
              subtitle="Eligible MATCH 3件で初回確定します。"
              tone="card"
            />
            <View style={styles.metricGrid}>
              <Metric label="DartsApp Rating" value={formatRatingTenths(profile.ratingTenths)} />
              <Metric
                label="測定状態"
                value={getRatingMeasurementLabel(profile.measurementStatus)}
              />
              <Metric label="Confidence" value={formatConfidence(profile.confidenceBp)} />
              <Metric
                label="Eligible MATCH"
                value={getEligibleMatchProgress(profile.eligibleMatchCount)}
              />
              <Metric label="単独01" value={`${profile.eligibleStandaloneZeroOneCount}`} />
              <Metric label="単独CRICKET" value={`${profile.eligibleStandaloneCricketCount}`} />
            </View>
          </Card>

          <Card>
            <SectionTitle title="Index" subtitle="Rating Engine v2の内部指標です。" tone="card" />
            <View style={styles.detailRows}>
              <DetailRow label="01 Index" value={formatIndexForDetail(profile.zeroOneIndexMilli)} />
              <DetailRow
                label="Cricket Index"
                value={formatIndexForDetail(profile.cricketIndexMilli)}
              />
              <DetailRow
                label="Match Index"
                value={formatIndexForDetail(profile.matchIndexMilli)}
              />
              <DetailRow label="established_at" value={profile.establishedAt ?? '-'} />
              <DetailRow label="最終評価日時" value={formatEvaluatedAt(profile.lastEvaluatedAt)} />
            </View>
          </Card>
        </>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="Rating履歴を見る"
          onPress={() => router.push('/account/rating/history')}
          disabled={!overview}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="戻る"
          onPress={() => router.back()}
          variant="secondary"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
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

function formatIndexForDetail(indexMilli: number | null) {
  return indexMilli === null ? '未確定' : formatRatingIndex(indexMilli);
}

function getMissingRatingMessage(isResolving: boolean, errorMessage: string | null) {
  if (isResolving) {
    return 'Ratingを読み込んでいます。';
  }
  if (errorMessage) {
    return 'Rating状態を読み込めませんでした。';
  }
  return 'Account登録後にRating状態を表示します。';
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
    minHeight: 74,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: 12,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    marginTop: 5,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  detailRows: {
    gap: 8,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 44,
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
    marginTop: 4,
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
});

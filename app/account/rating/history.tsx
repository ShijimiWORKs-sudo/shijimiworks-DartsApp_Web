import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { Card } from '../../../components/Card';
import {
  formatConfidence,
  formatEvaluatedAt,
  formatRatingIndex,
  formatRatingTenths,
  getRatingMeasurementLabel,
} from '../../../components/account/accountUiModel';
import { ScreenShell } from '../../../components/ScreenShell';
import { SectionTitle } from '../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../components/web/useDesktopWebLayout';
import { webGameStyles } from '../../../components/web/WebGameShell';
import { colors } from '../../../constants/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../contexts/GameDatabaseContext';
import type { RatingSnapshotHistoryItem } from '../../../features/game/application/ports';

export default function AccountRatingHistoryScreen() {
  const router = useRouter();
  const isDesktopWeb = useDesktopWebLayout();
  const { activeAccountId } = useAppState();
  const { services } = useGameDatabase();
  const [history, setHistory] = useState<RatingSnapshotHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadHistory() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          await services?.rating.processPending();
          const account = await services?.account.getActiveAccount(activeAccountId);
          const snapshots =
            account && services ? await services.rating.listSnapshots(account.account.id) : [];
          if (mounted) {
            setHistory(snapshots);
          }
        } catch (error) {
          if (mounted) setErrorMessage(getErrorMessage(error));
        } finally {
          if (mounted) setIsLoading(false);
        }
      }

      void loadHistory();
      return () => {
        mounted = false;
      };
    }, [activeAccountId, services]),
  );

  return (
    <ScreenShell>
      <SectionTitle title="Rating履歴" subtitle="有効なRating Snapshotを新しい順に表示します。" />

      {history.length === 0 ? (
        <Card muted>
          <Text style={styles.message}>
            {isLoading
              ? 'Rating履歴を読み込んでいます。'
              : 'Rating履歴はまだありません。\nEligible MATCHを完了すると、ここに履歴が表示されます。'}
          </Text>
        </Card>
      ) : (
        <View style={styles.historyList}>
          {history.map((snapshot) => (
            <Card key={snapshot.id}>
              <SectionTitle
                title={`${formatSourceType(snapshot.sourceType)} / ${formatRatingTenths(snapshot.ratingTenths)}`}
                subtitle={formatEvaluatedAt(snapshot.createdAt)}
                tone="card"
              />
              <View style={styles.detailRows}>
                <DetailRow label="previous → new" value={formatBeforeAfter(snapshot)} />
                <DetailRow label="delta" value={formatDelta(snapshot.appliedDeltaMilli)} />
                <DetailRow
                  label="measurement status"
                  value={getRatingMeasurementLabel(snapshot.measurementStatus)}
                />
                <DetailRow label="Confidence" value={formatConfidence(snapshot.confidenceBp)} />
                <DetailRow label="01 Index" value={formatRatingIndex(snapshot.zeroOneIndexMilli)} />
                <DetailRow
                  label="Cricket Index"
                  value={formatRatingIndex(snapshot.cricketIndexMilli)}
                />
                <DetailRow
                  label="Match Index"
                  value={formatRatingIndex(snapshot.matchIndexMilli)}
                />
                <DetailRow label="calculation version" value={`${snapshot.calculationVersion}`} />
              </View>
            </Card>
          ))}
        </View>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="Rating詳細へ"
          onPress={() => router.replace('/account/rating')}
          variant="secondary"
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatSourceType(sourceType: RatingSnapshotHistoryItem['sourceType']) {
  if (sourceType === 'match') return 'MATCH';
  if (sourceType === 'standalone_zero_one') return '単独01';
  return '単独CRICKET';
}

function formatBeforeAfter(snapshot: RatingSnapshotHistoryItem) {
  return `${formatRatingTenths(snapshot.previousRatingTenths)} → ${formatRatingTenths(snapshot.ratingTenths)}`;
}

function formatDelta(deltaMilli: number | null) {
  if (deltaMilli === null) return '-';
  const value = deltaMilli / 1000;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(3)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  historyList: {
    gap: 12,
  },
  detailRows: {
    gap: 8,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
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

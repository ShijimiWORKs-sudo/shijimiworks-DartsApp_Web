import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../../components/web/useDesktopWebLayout';
import { WebResponsiveGrid, webGameStyles } from '../../../../components/web/WebGameShell';
import { colors } from '../../../../constants/theme';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import type { ZeroOneGameState, ZeroOneResult } from '../../../../features/game/domain/zeroOne';

export default function ZeroOneResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [game, setGame] = useState<ZeroOneGameState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadGame() {
        if (!services || !gameId) {
          return;
        }

        try {
          const nextGame = await services.zeroOne.loadGame(gameId);
          if (nextGame.status === 'in_progress' || nextGame.status === 'paused') {
            router.replace(`/game/01/${nextGame.gameId}`);
            return;
          }
          if (nextGame.status !== 'completed') {
            router.replace('/game');
            return;
          }
          if (mounted) {
            setGame(nextGame);
          }
        } catch {
          router.replace('/game');
        }
      }

      void loadGame();
      return () => {
        mounted = false;
      };
    }, [gameId, router, services]),
  );

  const result = game?.result;

  return (
    <ScreenShell showNav={false}>
      <SectionTitle title="01 GAME結果" subtitle="DBへ保存された01集計結果です。" />

      <WebResponsiveGrid>
        <Card muted style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <Text style={styles.remainingScore}>{result?.finalRemainingScore ?? '-'}</Text>
          <Text style={styles.totalLabel}>FINAL REMAINING</Text>
          <Text style={styles.reasonText}>{formatReason(result)}</Text>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="スタッツ" tone="card" />
          <View style={styles.statGrid}>
            <ResultStat label="Start" value={result?.startScore ?? '-'} />
            <ResultStat label="Effective" value={result?.effectiveScore ?? 0} />
            <ResultStat label="Darts" value={result?.dartsThrown ?? 0} />
            <ResultStat label="BUST" value={result?.bustCount ?? 0} />
            <ResultStat label="PPD" value={formatMilli(result?.ppdMilli ?? 0)} />
            <ResultStat label="3DA" value={formatMilli(result?.threeDartAverageMilli ?? 0)} />
            <ResultStat label="Bull" value={result?.bullCount ?? 0} />
            <ResultStat label="Triple" value={result?.tripleCount ?? 0} />
            <ResultStat label="Double" value={result?.doubleCount ?? 0} />
            <ResultStat label="Miss" value={result?.missCount ?? 0} />
            <ResultStat label="100+" value={result?.turns100Plus ?? 0} />
            <ResultStat label="180" value={result?.turns180 ?? 0} />
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="01詳細" tone="card" />
          <View style={styles.detailRows}>
            <DetailRow
              label="Out"
              value={game?.outRule === 'master_out' ? 'Master Out' : 'Single Out'}
            />
            <DetailRow label="Bull" value={game?.bullRule ?? '-'} />
            <DetailRow label="Checkout Round" value={result?.checkoutRoundNo ?? '-'} />
            <DetailRow label="Checkout Darts" value={result?.checkoutDarts ?? '-'} />
            <DetailRow label="140+" value={result?.turns140Plus ?? 0} />
            <DetailRow
              label="Outer / Inner Bull"
              value={`${result?.outerBullCount ?? 0} / ${result?.innerBullCount ?? 0}`}
            />
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="連携状態" tone="card" />
          <Text style={styles.outboxText}>{formatOutbox(result?.outboxStatus ?? null)}</Text>
          <Text style={styles.ratingText}>単独01はRating計算の対象外として保存されています。</Text>
        </Card>
      </WebResponsiveGrid>

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="もう一度01 GAME"
          onPress={() => router.replace('/game/01/settings')}
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
        <AppButton
          label="ゲーム一覧へ"
          onPress={() => router.replace('/game')}
          variant="secondary"
          style={isDesktopWeb && webGameStyles.desktopFooterButton}
        />
      </View>
    </ScreenShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatMilli(value: number) {
  return (value / 1000).toFixed(1);
}

function formatReason(result: ZeroOneResult | null | undefined) {
  if (!result) {
    return 'RESULT';
  }
  return result.completionReason === 'checkout' ? 'CHECKOUT' : 'ROUND LIMIT';
}

function formatOutbox(status: ZeroOneResult['outboxStatus']) {
  if (status === 'pending') {
    return 'OutboxにPracticeRecord upsert待ちとして保存済みです。';
  }
  if (status === 'linked') {
    return 'PracticeRecordへ連携済みです。';
  }
  if (status === 'error') {
    return 'PracticeRecord連携でエラーが発生しています。';
  }
  return 'Outbox状態を確認中です。';
}

const styles = StyleSheet.create({
  remainingScore: {
    color: colors.primaryDark,
    fontSize: 64,
    fontWeight: '900',
    textAlign: 'center',
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  reasonText: {
    marginTop: 6,
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statItem: {
    width: '48%',
    minHeight: 74,
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.surfaceMuted,
  },
  statValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  detailRows: {
    gap: 8,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  outboxText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  ratingText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
  },
  actions: {
    gap: 10,
  },
});

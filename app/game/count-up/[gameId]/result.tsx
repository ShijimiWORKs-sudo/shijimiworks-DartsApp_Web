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
import type { CountUpGameState } from '../../../../features/game/domain/countUp';

export default function CountUpResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [game, setGame] = useState<CountUpGameState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadGame() {
        if (!services || !gameId) {
          return;
        }

        const nextGame = await services.countUp.loadGame(gameId);
        if (mounted) {
          setGame(nextGame);
        }
      }

      void loadGame();
      return () => {
        mounted = false;
      };
    }, [gameId, services]),
  );

  const result = game?.result;

  return (
    <ScreenShell showNav={false}>
      <SectionTitle title="COUNT-UP結果" subtitle="DBへ保存された集計結果です。" />

      <WebResponsiveGrid>
        <Card muted style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <Text style={styles.totalScore}>{result?.totalScore ?? game?.totalScore ?? '-'}</Text>
          <Text style={styles.totalLabel}>TOTAL SCORE</Text>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="スタッツ" tone="card" />
          <View style={styles.statGrid}>
            <ResultStat label="Bull" value={result?.bullCount ?? 0} />
            <ResultStat label="Triple" value={result?.tripleCount ?? 0} />
            <ResultStat label="Double" value={result?.doubleCount ?? 0} />
            <ResultStat label="Miss" value={result?.missCount ?? 0} />
            <ResultStat label="Round Avg" value={formatMilli(result?.roundAverageMilli ?? 0)} />
            <ResultStat label="Dart Avg" value={formatMilli(result?.dartAverageMilli ?? 0)} />
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="ラウンド別" tone="card" />
          <View style={styles.roundList}>
            {(result?.roundScores ?? []).map((score, index) => (
              <View key={`${index}-${score}`} style={styles.roundRow}>
                <Text style={styles.roundLabel}>R{index + 1}</Text>
                <View style={styles.roundBarTrack}>
                  <View style={[styles.roundBar, { flex: Math.max(score, 1) }]} />
                  <View style={{ flex: Math.max(180 - score, 1) }} />
                </View>
                <Text style={styles.roundScore}>{score}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="Practice連携" tone="card" />
          <Text style={styles.outboxText}>
            {game?.outboxStatus === 'pending'
              ? 'OutboxにPracticeRecord upsert待ちとして保存済みです。'
              : game?.outboxStatus === 'linked'
                ? 'PracticeRecordへ連携済みです。'
                : game?.outboxStatus === 'error'
                  ? 'PracticeRecord連携でエラーが発生しています。'
                  : 'Outbox状態を確認中です。'}
          </Text>
        </Card>
      </WebResponsiveGrid>

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="もう一度COUNT-UP"
          onPress={() => router.replace('/game/count-up/settings')}
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

function formatMilli(value: number) {
  return (value / 1000).toFixed(1);
}

const styles = StyleSheet.create({
  totalScore: {
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
  roundList: {
    gap: 8,
    marginTop: 14,
  },
  roundRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundLabel: {
    width: 28,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  roundBarTrack: {
    flex: 1,
    height: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  roundBar: {
    backgroundColor: colors.primary,
  },
  roundScore: {
    width: 38,
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  outboxText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: 10,
  },
});

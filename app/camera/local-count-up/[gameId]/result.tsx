import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { colors } from '../../../../constants/theme';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import type { CountUpGameState } from '../../../../features/game/domain/countUp';

export default function CameraLocalCountUpResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { services } = useGameDatabase();
  const [game, setGame] = useState<CountUpGameState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      async function loadResult() {
        if (!services || !gameId) {
          return;
        }
        const nextGame = await services.countUp.loadGame(gameId);
        if (mounted) {
          setGame(nextGame);
        }
      }
      void loadResult();
      return () => {
        mounted = false;
      };
    }, [gameId, services]),
  );

  const result = game?.result;

  return (
    <ScreenShell>
      <SectionTitle
        title="カメラCOUNT-UP結果"
        subtitle="COUNT-UP Serviceの結果保存を表示します。"
      />

      <Card muted>
        <Text style={styles.totalScore}>{result?.totalScore ?? game?.totalScore ?? '-'}</Text>
        <Text style={styles.totalLabel}>TOTAL SCORE</Text>
      </Card>

      <Card>
        <SectionTitle title="スタッツ" tone="card" />
        <View style={styles.statGrid}>
          <ResultStat label="Darts" value={result?.dartsThrown ?? game?.dartsThrown ?? 0} />
          <ResultStat label="Bull" value={result?.bullCount ?? 0} />
          <ResultStat label="Inner Bull" value={result?.innerBullCount ?? 0} />
          <ResultStat label="Outer Bull" value={result?.outerBullCount ?? 0} />
          <ResultStat label="High Round" value={result?.highRoundScore ?? 0} />
          <ResultStat label="Dart Avg" value={formatMilli(result?.dartAverageMilli ?? 0)} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="ラウンド別" tone="card" />
        <View style={styles.roundList}>
          {(result?.roundScores ?? []).map((score, index) => (
            <View key={`${index}-${score}`} style={styles.roundRow}>
              <Text style={styles.roundLabel}>R{index + 1}</Text>
              <Text style={styles.roundScore}>{score}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.actions}>
        <AppButton
          label="もう一度カメラCOUNT-UP"
          onPress={() => router.replace('/camera/local-count-up/settings')}
        />
        <AppButton
          label="カメラHomeへ"
          onPress={() => router.replace('/camera/home')}
          variant="secondary"
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
    marginTop: 12,
  },
  statItem: {
    width: '48%',
    minHeight: 72,
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.surfaceMuted,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  roundList: {
    gap: 8,
    marginTop: 12,
  },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.surfaceMuted,
  },
  roundLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  roundScore: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  actions: {
    gap: 10,
  },
});

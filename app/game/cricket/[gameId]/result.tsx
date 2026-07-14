import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { colors } from '../../../../constants/theme';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import type { CricketGameState, CricketResult } from '../../../../features/game/domain/cricket';

export default function CricketResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { services } = useGameDatabase();
  const [game, setGame] = useState<CricketGameState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadGame() {
        if (!services || !gameId) {
          return;
        }

        try {
          const nextGame = await services.cricket.loadGame(gameId);
          if (nextGame.status === 'in_progress' || nextGame.status === 'paused') {
            router.replace(`/game/cricket/${nextGame.gameId}`);
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
      <SectionTitle title="STANDARD CRICKET結果" subtitle="DBへ保存されたCRICKET集計結果です。" />

      <Card muted>
        <Text style={styles.totalScore}>{result?.finalCricketScore ?? '-'}</Text>
        <Text style={styles.totalLabel}>FINAL CRICKET SCORE</Text>
        <Text style={styles.reasonText}>{formatReason(result)}</Text>
      </Card>

      <Card>
        <SectionTitle title="スタッツ" tone="card" />
        <View style={styles.statGrid}>
          <ResultStat label="Marks" value={result?.marksTotal ?? 0} />
          <ResultStat label="MPR" value={formatMilli(result?.mprMilli ?? 0)} />
          <ResultStat label="Darts" value={result?.dartsThrown ?? 0} />
          <ResultStat label="Rounds" value={result?.roundsPlayed ?? 0} />
          <ResultStat label="Closed" value={`${result?.closedTargetCount ?? 0}/7`} />
          <ResultStat label="Bull" value={result?.bullCount ?? 0} />
          <ResultStat label="Triple" value={result?.tripleCount ?? 0} />
          <ResultStat label="Double" value={result?.doubleCount ?? 0} />
          <ResultStat label="Miss" value={result?.missCount ?? 0} />
          <ResultStat label="5M+" value={result?.turns5MarksPlus ?? 0} />
          <ResultStat label="7M+" value={result?.turns7MarksPlus ?? 0} />
          <ResultStat label="9M" value={result?.turns9Marks ?? 0} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="ターゲット結果" tone="card" />
        <View style={styles.detailRows}>
          {(result?.targetStates ?? game?.targetStates ?? []).map((state) => (
            <DetailRow
              key={state.target}
              label={state.target}
              value={`${state.marksTotal} marks / ${state.pointsScored} pt`}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="連携状態" tone="card" />
        <Text style={styles.outboxText}>{formatOutbox(result?.outboxStatus ?? null)}</Text>
        <Text style={styles.ratingText}>
          Rating計算本体は未実装です。対象条件を満たす単独CRICKETは候補として保存されます。
        </Text>
      </Card>

      <View style={styles.actions}>
        <AppButton
          label="もう一度CRICKET"
          onPress={() => router.replace('/game/cricket/settings')}
        />
        <AppButton
          label="ゲーム一覧へ"
          onPress={() => router.replace('/game')}
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

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatMilli(value: number) {
  return (value / 1000).toFixed(2);
}

function formatReason(result: CricketResult | null | undefined) {
  if (!result) {
    return 'RESULT';
  }
  return result.completionReason === 'all_closed_with_score'
    ? 'ALL CLOSED WITH SCORE'
    : 'ROUND LIMIT';
}

function formatOutbox(status: CricketResult['outboxStatus']) {
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

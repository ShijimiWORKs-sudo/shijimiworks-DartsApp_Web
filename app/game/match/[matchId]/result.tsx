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
import type { MatchResultSummary, MatchState } from '../../../../features/game/domain/match';

export default function MatchResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [match, setMatch] = useState<MatchState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadMatch() {
        if (!services || !matchId) return;
        try {
          const nextMatch = await services.match.loadMatch(matchId);
          if (nextMatch.status === 'in_progress' || nextMatch.status === 'paused') {
            router.replace(`/game/match/${nextMatch.matchId}`);
            return;
          }
          if (nextMatch.status !== 'completed') {
            router.replace('/game');
            return;
          }
          if (mounted) setMatch(nextMatch);
        } catch {
          router.replace('/game');
        }
      }

      void loadMatch();
      return () => {
        mounted = false;
      };
    }, [matchId, router, services]),
  );

  const result = match?.result;

  return (
    <ScreenShell showNav={false}>
      <SectionTitle title="MATCH結果" subtitle="2人対戦MATCHの結果と連携候補状態です。" />

      <WebResponsiveGrid>
        <Card muted style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <Text style={styles.winner}>{getWinnerName(match)}</Text>
          <Text style={styles.winnerLabel}>MATCH WINNER</Text>
          <Text style={styles.reason}>{formatCompletionReason(match)}</Text>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="ゲーム勝敗" tone="card" />
          <View style={styles.detailRows}>
            {match?.players.map((player) => (
              <DetailRow
                key={player.playerId}
                label={player.displayName}
                value={`${result?.gamesWon[player.playerId] ?? player.gamesWon} win`}
              />
            ))}
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="スタッツ" tone="card" />
          <View style={styles.statGrid}>
            <ResultStat label="Games" value={result?.gameIds.length ?? 0} />
            <ResultStat label="Darts" value={result?.totalDarts ?? 0} />
            <ResultStat label="01 PPD" value={formatMilli(result?.zeroOnePpdMilli)} />
            <ResultStat label="CR MPR" value={formatMilli(result?.cricketMprMilli)} />
            <ResultStat label="Bull" value={result?.bullCount ?? 0} />
            <ResultStat label="Triple" value={result?.tripleCount ?? 0} />
            <ResultStat label="Double" value={result?.doubleCount ?? 0} />
            <ResultStat label="Bust" value={result?.bustCount ?? 0} />
          </View>
        </Card>

        <Card style={isDesktopWeb && webGameStyles.desktopGridCard}>
          <SectionTitle title="連携状態" tone="card" />
          <Text style={styles.outboxText}>{formatRating(result)}</Text>
          <Text style={styles.outboxText}>{formatOutbox(result)}</Text>
        </Card>
      </WebResponsiveGrid>

      <View style={[styles.actions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
        <AppButton
          label="もう一度MATCH"
          onPress={() => router.replace('/game/match/settings')}
          variant="match"
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

function getWinnerName(match: MatchState | null) {
  const winnerId = match?.winnerPlayerId;
  return match?.players.find((player) => player.playerId === winnerId)?.displayName ?? '-';
}

function formatCompletionReason(match: MatchState | null) {
  if (match?.completionReason === 'two_zero') return '2-0';
  if (match?.completionReason === 'two_one') return '2-1';
  return 'RESULT';
}

function formatMilli(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : (value / 1000).toFixed(2);
}

function formatRating(result: MatchResultSummary | null | undefined) {
  return result?.ratingCandidate
    ? 'OWNER PlayerのRating Evaluation v2候補として保存済みです。'
    : 'Rating候補は作成されていません。';
}

function formatOutbox(result: MatchResultSummary | null | undefined) {
  return result?.commonOutboxStatus === 'local_only'
    ? 'CommonEvent / CommonOutbox は local_only として保存済みです。'
    : 'CommonOutbox状態を確認中です。';
}

const styles = StyleSheet.create({
  winner: {
    color: colors.primaryDark,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  winnerLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  reason: {
    marginTop: 8,
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
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
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  detailValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
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
  outboxText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
});

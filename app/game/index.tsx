import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { colors } from '../../constants/theme';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import type { CountUpGameState } from '../../features/game/domain/countUp';
import type { ZeroOneGameState } from '../../features/game/domain/zeroOne';

type ActiveGame =
  { mode: 'count_up'; game: CountUpGameState } | { mode: 'zero_one'; game: ZeroOneGameState };

type RecentGame =
  { mode: 'count_up'; game: CountUpGameState } | { mode: 'zero_one'; game: ZeroOneGameState };

export default function GameHubScreen() {
  const router = useRouter();
  const { services, isAvailable } = useGameDatabase();
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [recentResults, setRecentResults] = useState<RecentGame[]>([]);

  const loadGames = useCallback(async () => {
    if (!services) {
      return;
    }

    const [activeCountUp, activeZeroOne, recentCountUp, recentZeroOne] = await Promise.all([
      services.countUp.getActiveGame(),
      services.zeroOne.getActiveGame(),
      services.countUp.listRecentResults(5),
      services.zeroOne.listRecentResults(5),
    ]);
    setActiveGame(
      activeZeroOne
        ? { mode: 'zero_one', game: activeZeroOne }
        : activeCountUp
          ? { mode: 'count_up', game: activeCountUp }
          : null,
    );
    setRecentResults(
      [
        ...recentZeroOne.map((game) => ({ mode: 'zero_one' as const, game })),
        ...recentCountUp.map((game) => ({ mode: 'count_up' as const, game })),
      ].slice(0, 5),
    );
  }, [services]);

  useFocusEffect(
    useCallback(() => {
      void loadGames();
    }, [loadGames]),
  );

  return (
    <ScreenShell>
      <SectionTitle title="ゲーム" subtitle="COUNT-UPと単独01をDBへ保存しながらプレイできます。" />

      {activeGame ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(getPlayRoute(activeGame))}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card muted>
            <SectionTitle
              title={getActiveTitle(activeGame)}
              subtitle={getActiveSubtitle(activeGame)}
              tone="card"
            />
            <View style={styles.cardAction}>
              <AppButton
                label={activeGame.game.status === 'paused' ? '再開する' : 'ゲームへ戻る'}
                onPress={() => router.push(getPlayRoute(activeGame))}
              />
            </View>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <SectionTitle title="ゲームモード" subtitle="単独練習を記録できます。" tone="card" />
        <View style={styles.modeList}>
          <AppButton
            label="COUNT-UPを始める"
            onPress={() => router.push('/game/count-up/settings')}
            disabled={!isAvailable}
          />
          <AppButton
            label="01 GAMEを始める"
            onPress={() => router.push('/game/01/settings')}
            disabled={!isAvailable}
            variant="secondary"
          />
          <View style={styles.disabledMode}>
            <Text style={styles.disabledModeTitle}>CRICKET</Text>
            <Text style={styles.disabledModeText}>Phase 4以降で実装予定</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle title="最近のゲーム" subtitle="完了済みゲームを表示します。" tone="card" />
        {recentResults.length > 0 ? (
          <View style={styles.resultList}>
            {recentResults.map((recent) => (
              <Pressable
                key={`${recent.mode}-${recent.game.gameId}`}
                accessibilityRole="button"
                onPress={() => router.push(getResultRoute(recent))}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
              >
                <Text style={styles.resultScore}>{getResultScore(recent)}</Text>
                <Text style={styles.resultMeta}>{getResultMeta(recent)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>まだ完了したゲームはありません。</Text>
        )}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cardAction: {
    marginTop: 14,
  },
  modeList: {
    gap: 10,
    marginTop: 14,
  },
  disabledMode: {
    minHeight: 58,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
  },
  disabledModeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledModeText: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  resultList: {
    gap: 8,
    marginTop: 12,
  },
  resultRow: {
    minHeight: 56,
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
  },
  resultScore: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});

function getPlayRoute(active: ActiveGame) {
  return active.mode === 'zero_one'
    ? `/game/01/${active.game.gameId}`
    : `/game/count-up/${active.game.gameId}`;
}

function getResultRoute(recent: RecentGame) {
  return recent.mode === 'zero_one'
    ? `/game/01/${recent.game.gameId}/result`
    : `/game/count-up/${recent.game.gameId}/result`;
}

function getActiveTitle(active: ActiveGame) {
  const prefix = active.game.status === 'paused' ? '一時停止中の' : '進行中の';
  return `${prefix}${active.mode === 'zero_one' ? '01 GAME' : 'COUNT-UP'}`;
}

function getActiveSubtitle(active: ActiveGame) {
  if (active.mode === 'zero_one') {
    return `Round ${active.game.currentRoundNo} / 15、残り ${active.game.currentRemainingScore} 点`;
  }
  return `Round ${active.game.currentRoundNo} / 8、現在 ${active.game.totalScore} 点`;
}

function getResultScore(recent: RecentGame) {
  if (recent.mode === 'zero_one') {
    return `01 残り ${recent.game.result?.finalRemainingScore ?? recent.game.currentRemainingScore} 点`;
  }
  return `COUNT-UP ${recent.game.result?.totalScore ?? recent.game.totalScore} 点`;
}

function getResultMeta(recent: RecentGame) {
  if (recent.mode === 'zero_one') {
    return `PPD ${((recent.game.result?.ppdMilli ?? 0) / 1000).toFixed(1)} / ${recent.game.outRule}`;
  }
  return `Bull ${recent.game.result?.bullCount ?? 0} / ${recent.game.bullRule}`;
}

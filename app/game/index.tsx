import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Card } from '../../components/Card';
import { AccountLocalNotice } from '../../components/account/AccountLocalNotice';
import { RatingStatusCard } from '../../components/account/RatingStatusCard';
import { ScreenShell } from '../../components/ScreenShell';
import { SectionTitle } from '../../components/SectionTitle';
import { useDesktopWebLayout } from '../../components/web/useDesktopWebLayout';
import { colors } from '../../constants/theme';
import { useAppState } from '../../contexts/AppStateContext';
import { useGameDatabase } from '../../contexts/GameDatabaseContext';
import type { AccountOverview } from '../../features/account/domain';
import type { CountUpGameState } from '../../features/game/domain/countUp';
import type { CricketGameState } from '../../features/game/domain/cricket';
import type { MatchState } from '../../features/game/domain/match';
import type { ZeroOneGameState } from '../../features/game/domain/zeroOne';

type ActiveGame =
  | { mode: 'count_up'; game: CountUpGameState }
  | { mode: 'zero_one'; game: ZeroOneGameState }
  | { mode: 'cricket'; game: CricketGameState }
  | { mode: 'match'; match: MatchState };

type RecentGame =
  | { mode: 'count_up'; game: CountUpGameState }
  | { mode: 'zero_one'; game: ZeroOneGameState }
  | { mode: 'cricket'; game: CricketGameState }
  | { mode: 'match'; match: MatchState };

export default function GameHubScreen() {
  const router = useRouter();
  const { activeAccountId } = useAppState();
  const { accountBootstrapStatus, services, isAvailable } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [recentResults, setRecentResults] = useState<RecentGame[]>([]);
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);

  const loadGames = useCallback(async () => {
    if (!services) {
      return;
    }

    const [
      activeCountUp,
      activeZeroOne,
      activeCricket,
      activeMatch,
      recentCountUp,
      recentZeroOne,
      recentCricket,
      recentMatch,
      account,
    ] = await Promise.all([
      services.countUp.getActiveGame(),
      services.zeroOne.getActiveGame(),
      services.cricket.getActiveGame(),
      services.match.getActiveMatch(),
      services.countUp.listRecentResults(5),
      services.zeroOne.listRecentResults(5),
      services.cricket.listRecentResults(5),
      services.match.listRecentResults(5),
      services.account.getActiveAccount(activeAccountId),
    ]);
    setActiveGame(
      activeMatch
        ? { mode: 'match', match: activeMatch }
        : activeCricket
          ? { mode: 'cricket', game: activeCricket }
          : activeZeroOne
            ? { mode: 'zero_one', game: activeZeroOne }
            : activeCountUp
              ? { mode: 'count_up', game: activeCountUp }
              : null,
    );
    setRecentResults(
      [
        ...recentMatch.map((match) => ({ mode: 'match' as const, match })),
        ...recentCricket.map((game) => ({ mode: 'cricket' as const, game })),
        ...recentZeroOne.map((game) => ({ mode: 'zero_one' as const, game })),
        ...recentCountUp.map((game) => ({ mode: 'count_up' as const, game })),
      ].slice(0, 5),
    );
    setAccountOverview(account);
  }, [activeAccountId, services]);

  useFocusEffect(
    useCallback(() => {
      void loadGames();
    }, [loadGames]),
  );

  return (
    <ScreenShell>
      <SectionTitle
        title="ゲーム"
        subtitle="COUNT-UP、単独01、STANDARD CRICKET、MATCHをDBへ保存しながらプレイできます。"
      />

      {activeGame ? (
        <Card muted>
          <SectionTitle
            title={getActiveTitle(activeGame)}
            subtitle={getActiveSubtitle(activeGame)}
            tone="card"
          />
          <View style={styles.cardAction}>
            <AppButton
              label={getActiveStatus(activeGame) === 'paused' ? '再開する' : 'ゲームへ戻る'}
              onPress={() => router.push(getPlayRoute(activeGame))}
            />
          </View>
        </Card>
      ) : null}

      {accountOverview ? (
        <RatingStatusCard overview={accountOverview} />
      ) : accountBootstrapStatus === 'loading' ? (
        <Card muted>
          <SectionTitle
            title="Rating状態を確認中"
            subtitle="保存済みAccountとRating Profileを確認しています。"
            tone="card"
          />
        </Card>
      ) : accountBootstrapStatus === 'temporarilyUnavailable' ? (
        <Card muted>
          <SectionTitle
            title="Account情報を確認できませんでした"
            subtitle="少し待ってからもう一度お試しください。"
            tone="card"
          />
        </Card>
      ) : (
        <>
          <AccountLocalNotice />
          <Card>
            <SectionTitle
              title="Rating所有者未登録"
              subtitle="単独01をRating候補にするにはローカルAccountが必要です。"
              tone="card"
            />
            <View style={styles.cardAction}>
              <AppButton label="Account登録へ" onPress={() => router.push('/account/register')} />
            </View>
          </Card>
        </>
      )}

      <Card>
        <SectionTitle title="ゲームモード" subtitle="単独練習を記録できます。" tone="card" />
        <View style={[styles.modeList, isDesktopWeb && styles.desktopModeList]}>
          <View style={[styles.modeItem, isDesktopWeb && styles.desktopModeItem]}>
            <AppButton
              label="COUNT-UPを始める"
              onPress={() => router.push('/game/count-up/settings')}
              disabled={!isAvailable}
              variant="countUp"
            />
            <Text style={styles.ratingNote}>COUNT-UPはRating対象外です。</Text>
          </View>
          <View style={[styles.modeItem, isDesktopWeb && styles.desktopModeItem]}>
            <AppButton
              label="01 GAMEを始める"
              onPress={() => router.push('/game/01/settings')}
              disabled={!isAvailable}
              variant="zeroOne"
            />
            <Text style={styles.ratingNote}>{getZeroOneRatingNote(accountOverview)}</Text>
          </View>
          <View style={[styles.modeItem, isDesktopWeb && styles.desktopModeItem]}>
            <AppButton
              label="STANDARD CRICKETを始める"
              onPress={() => router.push('/game/cricket/settings')}
              disabled={!isAvailable}
              variant="cricket"
            />
            <Text style={styles.ratingNote}>{getCricketRatingNote(accountOverview)}</Text>
          </View>
          <View style={[styles.modeItem, isDesktopWeb && styles.desktopModeItem]}>
            <AppButton
              label="MATCHを始める"
              onPress={() => router.push('/game/match/settings')}
              disabled={!isAvailable}
              variant="match"
            />
            <Text style={styles.ratingNote}>
              MATCHは初回Rating確定前でも候補として保存されます。
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="カメラ撮影テスト"
          subtitle="ダーツボードの静止画撮影とレビューだけを確認できます。スコア判定は行いません。"
          tone="card"
        />
        <View style={styles.cardAction}>
          <AppButton
            label="LAN Camera接続へ"
            onPress={() => router.push('/camera/lan')}
            disabled={!isAvailable}
            variant="secondary"
          />
        </View>
      </Card>

      <Card>
        <SectionTitle title="最近のゲーム" subtitle="完了済みゲームを表示します。" tone="card" />
        {recentResults.length > 0 ? (
          <View style={styles.resultList}>
            {recentResults.map((recent) => (
              <Pressable
                key={getRecentKey(recent)}
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
  desktopModeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 12,
  },
  modeItem: {
    gap: 6,
  },
  desktopModeItem: {
    width: '48%',
    minWidth: 280,
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
  ratingNote: {
    marginTop: -4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
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
  if (active.mode === 'match') {
    return `/game/match/${active.match.matchId}`;
  }
  if (active.mode === 'zero_one') {
    return `/game/01/${active.game.gameId}`;
  }
  if (active.mode === 'cricket') {
    return `/game/cricket/${active.game.gameId}`;
  }
  return `/game/count-up/${active.game.gameId}`;
}

function getResultRoute(recent: RecentGame) {
  if (recent.mode === 'match') {
    return `/game/match/${recent.match.matchId}/result`;
  }
  if (recent.mode === 'zero_one') {
    return `/game/01/${recent.game.gameId}/result`;
  }
  if (recent.mode === 'cricket') {
    return `/game/cricket/${recent.game.gameId}/result`;
  }
  return `/game/count-up/${recent.game.gameId}/result`;
}

function getRecentKey(recent: RecentGame) {
  return recent.mode === 'match'
    ? `${recent.mode}-${recent.match.matchId}`
    : `${recent.mode}-${recent.game.gameId}`;
}

function getActiveStatus(active: ActiveGame) {
  return active.mode === 'match' ? active.match.status : active.game.status;
}

function getActiveTitle(active: ActiveGame) {
  const prefix = getActiveStatus(active) === 'paused' ? '一時停止中の' : '進行中の';
  if (active.mode === 'match') {
    return `${prefix}MATCH`;
  }
  if (active.mode === 'zero_one') {
    return `${prefix}01 GAME`;
  }
  if (active.mode === 'cricket') {
    return `${prefix}STANDARD CRICKET`;
  }
  return `${prefix}COUNT-UP`;
}

function getActiveSubtitle(active: ActiveGame) {
  if (active.mode === 'match') {
    const activeGame = active.match.activeGame;
    if (!activeGame) {
      return active.match.phase === 'choice_required'
        ? 'GAME 3 CHOICE待ち'
        : '次のGAMEを開始できます';
    }
    return `GAME ${activeGame.gameNo} / Round ${activeGame.currentRoundNo}、${active.match.players
      .map((player) => `${player.displayName} ${player.gamesWon}`)
      .join(' - ')}`;
  }
  if (active.mode === 'zero_one') {
    return `Round ${active.game.currentRoundNo} / 15、残り ${active.game.currentRemainingScore} 点`;
  }
  if (active.mode === 'cricket') {
    return `Round ${active.game.currentRoundNo} / 15、現在 ${active.game.currentCricketScore} 点`;
  }
  return `Round ${active.game.currentRoundNo} / 8、現在 ${active.game.totalScore} 点`;
}

function getResultScore(recent: RecentGame) {
  if (recent.mode === 'match') {
    const winner = recent.match.players.find(
      (player) => player.playerId === recent.match.winnerPlayerId,
    );
    return `MATCH ${winner?.displayName ?? '-'} WIN`;
  }
  if (recent.mode === 'zero_one') {
    return `01 残り ${recent.game.result?.finalRemainingScore ?? recent.game.currentRemainingScore} 点`;
  }
  if (recent.mode === 'cricket') {
    return `CRICKET ${recent.game.result?.finalCricketScore ?? recent.game.currentCricketScore} 点`;
  }
  return `COUNT-UP ${recent.game.result?.totalScore ?? recent.game.totalScore} 点`;
}

function getResultMeta(recent: RecentGame) {
  if (recent.mode === 'match') {
    const score = recent.match.players
      .map((player) => `${player.displayName} ${player.gamesWon}`)
      .join(' - ');
    return `${score} / ${recent.match.completionReason ?? 'completed'}`;
  }
  if (recent.mode === 'zero_one') {
    return `PPD ${((recent.game.result?.ppdMilli ?? 0) / 1000).toFixed(1)} / ${recent.game.outRule}`;
  }
  if (recent.mode === 'cricket') {
    return `MPR ${((recent.game.result?.mprMilli ?? 0) / 1000).toFixed(2)} / ${recent.game.bullRule}`;
  }
  return `Bull ${recent.game.result?.bullCount ?? 0} / ${recent.game.bullRule}`;
}

function getZeroOneRatingNote(accountOverview: AccountOverview | null) {
  if (!accountOverview) {
    return '単独01のRating候補化にはAccount登録が必要です。';
  }

  return accountOverview.ratingProfile.establishedAt
    ? '単独01はRating更新候補として記録されます。'
    : '単独01は初回Rating確定後のゲームからRating候補になります。';
}

function getCricketRatingNote(accountOverview: AccountOverview | null) {
  if (!accountOverview) {
    return '単独CRICKETのRating候補化にはAccount登録が必要です。';
  }

  return accountOverview.ratingProfile.establishedAt
    ? '単独CRICKETはRating更新候補として記録されます。'
    : '単独CRICKETは初回Rating確定後のゲームからRating候補になります。';
}

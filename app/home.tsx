import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { AccountLocalNotice } from '../components/account/AccountLocalNotice';
import { AccountSummaryCard } from '../components/account/AccountSummaryCard';
import { RatingStatusCard } from '../components/account/RatingStatusCard';
import { RoundIconButton } from '../components/RoundIconButton';
import { ScreenShell } from '../components/ScreenShell';
import { SectionTitle } from '../components/SectionTitle';
import { StatCard } from '../components/StatCard';
import {
  DartsAppDesktopHome,
  type DartsAppHomeActiveGame,
  type DartsAppHomeRecentGame,
} from '../components/web/DartsAppDesktopHome';
import { useDesktopWebLayout } from '../components/web/useDesktopWebLayout';
import { conditionLabels, gameLabels, machineLabels } from '../constants/labels';
import { levelLabels } from '../constants/levels';
import { colors } from '../constants/theme';
import { useAppState } from '../contexts/AppStateContext';
import { useGameDatabase } from '../contexts/GameDatabaseContext';
import type { AccountOverview } from '../features/account/domain';
import type { CountUpGameState } from '../features/game/domain/countUp';
import type { CricketGameState } from '../features/game/domain/cricket';
import type { MatchState } from '../features/game/domain/match';
import type { ZeroOneGameState } from '../features/game/domain/zeroOne';
import { calculateAnalysisSummary } from '../utils/analyzePracticeRecords';
import { recommendPracticeMenus } from '../utils/recommendPracticeMenus';

const logo = require('../assets/images/logo.png');

const menuLinks = [
  { label: '今日の練習', href: '/practice', helper: 'レベル別メニュー' },
  { label: '練習記録', href: '/records', helper: '一覧・詳細・編集' },
  { label: '写真スコア記録', href: '/photo-score', helper: '自宅練習を写真から記録' },
  { label: '分析', href: '/analysis', helper: '改善コメントを見る' },
  { label: 'フォーム相談', href: '/consult', helper: '固定アドバイス確認' },
  { label: 'フォーム写真相談', href: '/consult/form-photo', helper: '3枚写真と自己チェック' },
  { label: '資料ライブラリ', href: '/library', helper: '検索と関連資料' },
  { label: 'お気に入り練習', href: '/favorites', helper: '登録済みメニュー' },
  { label: '設定を編集', href: '/settings', helper: 'RTと悩みを更新' },
] as const;

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

export default function HomeScreen() {
  const router = useRouter();
  const { accountBootstrapStatus, initializationError, isAvailable, services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [recentResults, setRecentResults] = useState<RecentGame[]>([]);
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null);
  const {
    activeAccountId,
    isLoading,
    profile,
    records,
    getWeeklyPracticeCount,
    getLatestRecord,
    isFavoritePracticeMenu,
    toggleFavoritePracticeMenu,
    theme,
  } = useAppState();

  const weeklyPracticeCount = getWeeklyPracticeCount();
  const latestRecord = getLatestRecord();
  const analysisSummary = calculateAnalysisSummary(records, 'last30Days', profile);
  const recommendation = recommendPracticeMenus(profile, records);
  const recommended = recommendation.todayMenus[0];
  const recommendedMenu = recommended?.menu;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadHomeData() {
        if (!services) {
          return;
        }

        await services.rating.processPending();

        const [
          countUp,
          zeroOne,
          cricket,
          match,
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
          services.countUp.listRecentResults(3),
          services.zeroOne.listRecentResults(3),
          services.cricket.listRecentResults(3),
          services.match.listRecentResults(3),
          services.account.getActiveAccount(activeAccountId),
        ]);
        if (mounted) {
          setActiveGame(
            match
              ? { mode: 'match', match }
              : cricket
                ? { mode: 'cricket', game: cricket }
                : zeroOne
                  ? { mode: 'zero_one', game: zeroOne }
                  : countUp
                    ? { mode: 'count_up', game: countUp }
                    : null,
          );
          setRecentResults(
            [
              ...recentMatch.map((recentMatchState) => ({
                mode: 'match' as const,
                match: recentMatchState,
              })),
              ...recentCricket.map((game) => ({ mode: 'cricket' as const, game })),
              ...recentZeroOne.map((game) => ({ mode: 'zero_one' as const, game })),
              ...recentCountUp.map((game) => ({ mode: 'count_up' as const, game })),
            ].slice(0, 5),
          );
          setAccountOverview(account);
        }
      }

      void loadHomeData();
      return () => {
        mounted = false;
      };
    }, [activeAccountId, services]),
  );

  if (isDesktopWeb) {
    return (
      <ScreenShell>
        <DartsAppDesktopHome
          activeGame={activeGame as DartsAppHomeActiveGame | null}
          recentResults={recentResults as DartsAppHomeRecentGame[]}
          accountOverview={accountOverview}
          accountBootstrapStatus={accountBootstrapStatus}
          isDatabaseAvailable={isAvailable}
          initializationError={initializationError}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <View style={[styles.header, isDesktopWeb && styles.desktopHeader]}>
        <Image source={logo} resizeMode="contain" style={styles.logo} />
        <View style={styles.headerText}>
          <Text style={[styles.appName, { color: theme.onBackground }]}>DartsApp</Text>
          <Text style={[styles.meta, { color: theme.onBackgroundMuted }]}>
            {profile ? levelLabels[profile.level] : 'プロフィール未設定'}
          </Text>
        </View>
      </View>

      {!isLoading && !profile ? (
        <Card muted>
          <SectionTitle
            title="初期設定がまだありません"
            subtitle="レーティングと利用機種を保存すると、ホームと分析に反映されます。"
            tone="card"
          />
          <View style={styles.setupAction}>
            <AppButton label="初期設定へ戻る" onPress={() => router.push('/')} />
          </View>
        </Card>
      ) : null}

      <Card muted>
        <SectionTitle
          title="ゲームを始める"
          subtitle="COUNT-UP、単独01、STANDARD CRICKETをDBへ保存しながらプレイできます。"
          tone="card"
        />
        <View style={styles.gameAction}>
          <AppButton label="ゲームを始める" onPress={() => router.push('/game')} />
        </View>
      </Card>

      {accountOverview ? (
        <>
          <AccountSummaryCard overview={accountOverview} />
          <RatingStatusCard overview={accountOverview} />
        </>
      ) : accountBootstrapStatus === 'loading' ? (
        <Card muted>
          <SectionTitle
            title="Account確認中"
            subtitle="保存済みAccount情報を確認しています。"
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
              title="Account未登録"
              subtitle="Rating所有者をこの端末に登録できます。"
              tone="card"
            />
            <View style={styles.accountAction}>
              <AppButton
                label="ローカルAccount登録"
                onPress={() => router.push('/account/register')}
              />
            </View>
          </Card>
        </>
      )}

      {activeGame ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(getActiveRoute(activeGame))}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card>
            <SectionTitle
              title={getActiveTitle(activeGame)}
              subtitle={getActiveSubtitle(activeGame)}
              tone="card"
            />
          </Card>
        </Pressable>
      ) : null}

      <View style={[styles.statsRow, isDesktopWeb && styles.desktopStatsRow]}>
        <StatCard
          label="現在レーティング"
          value={profile ? `RT ${profile.rating}` : '-'}
          helper={profile ? machineLabels[profile.machineType] : '未設定'}
        />
        <StatCard
          label="今週の練習回数"
          value={`${weeklyPracticeCount}回`}
          helper={
            weeklyPracticeCount >= 3 ? 'いいペース' : `目標まであと${3 - weeklyPracticeCount}回`
          }
        />
      </View>

      <Card>
        <SectionTitle
          title="分析サマリー"
          subtitle="直近30日の保存記録から表示します。"
          tone="card"
        />
        <View style={styles.analysisSummaryGrid}>
          <View style={styles.analysisSummaryItem}>
            <Text style={styles.analysisSummaryValue}>
              {analysisSummary.countUpAverage === null ? 'なし' : analysisSummary.countUpAverage}
            </Text>
            <Text style={styles.analysisSummaryLabel}>
              {analysisSummary.countUpAverage === null ? 'COUNT-UP記録なし' : 'COUNT-UP平均'}
            </Text>
          </View>
          <View style={styles.analysisSummaryItem}>
            <Text style={styles.analysisSummaryValue}>
              {trendLabel(analysisSummary.trendDirection)}
            </Text>
            <Text style={styles.analysisSummaryLabel}>最近の傾向</Text>
          </View>
        </View>
        <View style={styles.analysisAction}>
          <AppButton
            label="分析を見る"
            onPress={() => router.push('/analysis')}
            variant="secondary"
          />
        </View>
      </Card>

      <Card muted>
        <SectionTitle title="今日のおすすめ練習" subtitle={recommendation.reasonText} tone="card" />
        {recommendedMenu ? (
          <>
            <Text style={styles.recommendTitle}>{recommendedMenu.title}</Text>
            <Text style={styles.recommendReason}>{recommended.reason}</Text>
            <Text style={styles.recommendBody}>{trimSummary(recommendedMenu.purpose, 70)}</Text>
            <View style={styles.recommendFooter}>
              <Text style={styles.pill}>{recommendedMenu.durationMinutes}分</Text>
              <Text style={styles.pill}>{recommendedMenu.gameTypes.join(' / ')}</Text>
            </View>
            <View style={styles.practiceAction}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>詳細</Text>
                <RoundIconButton
                  accessibilityLabel={`${recommendedMenu.title}の詳細を開く`}
                  onPress={() => router.push(`/practice/${recommendedMenu.id}`)}
                />
              </View>
              <AppButton
                label={isFavoritePracticeMenu(recommendedMenu.id) ? '★ 登録済み' : '☆ お気に入り'}
                onPress={() => void toggleFavoritePracticeMenu(recommendedMenu.id)}
                variant="secondary"
              />
              <AppButton
                label="練習する"
                onPress={() =>
                  router.push({
                    pathname: '/record',
                    params: { practiceMenuId: recommendedMenu.id },
                  })
                }
              />
            </View>
          </>
        ) : (
          <Text style={styles.recommendBody}>おすすめ練習を準備中です。</Text>
        )}
      </Card>

      {latestRecord ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/records/${latestRecord.id}`)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card>
            <SectionTitle title="最新の練習記録" subtitle="タップで詳細を開きます。" tone="card" />
            <Text style={styles.latestTitle}>{latestRecord.practiceMenuName}</Text>
            <Text style={styles.latestBody}>
              {formatDate(latestRecord.date)} / {gameLabels[latestRecord.gameType]} / スコア{' '}
              {latestRecord.score}
            </Text>
            <Text style={styles.latestBody}>
              Bull {latestRecord.bullCount} / Cricket {latestRecord.cricketMarks} /{' '}
              {conditionLabels[latestRecord.condition]}
            </Text>
          </Card>
        </Pressable>
      ) : (
        <Card>
          <SectionTitle title="最新の練習記録" tone="card" />
          <Text style={styles.latestBody}>
            まだ練習記録がありません。記録入力から1件保存しましょう。
          </Text>
        </Card>
      )}

      <SectionTitle title="主要メニュー" />
      <View style={[styles.menuGrid, isDesktopWeb && styles.desktopMenuGrid]}>
        {menuLinks.map((item) => (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [
              styles.menuCard,
              isDesktopWeb && styles.desktopMenuCard,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.menuTitle}>{item.label}</Text>
            <Text style={styles.menuHelper}>{item.helper}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenShell>
  );
}

function trimSummary(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getActiveRoute(active: ActiveGame) {
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

function getActiveTitle(active: ActiveGame) {
  if (active.mode === 'match') {
    return active.match.status === 'paused' ? 'MATCHを再開' : '進行中のMATCH';
  }
  if (active.mode === 'zero_one') {
    return active.game.status === 'paused' ? '01 GAMEを再開' : '進行中の01 GAME';
  }
  if (active.mode === 'cricket') {
    return active.game.status === 'paused' ? 'STANDARD CRICKETを再開' : '進行中のSTANDARD CRICKET';
  }
  return active.game.status === 'paused' ? 'COUNT-UPを再開' : '進行中のCOUNT-UP';
}

function getActiveSubtitle(active: ActiveGame) {
  if (active.mode === 'match') {
    const activeMatchGame = active.match.activeGame;
    if (!activeMatchGame) {
      return active.match.phase === 'choice_required'
        ? 'GAME 3 CHOICE待ち'
        : '次のGAMEを開始できます';
    }
    return `GAME ${activeMatchGame.gameNo} / Round ${activeMatchGame.currentRoundNo}、${active.match.players
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

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function trendLabel(trendDirection: 'up' | 'down' | 'flat' | 'unknown') {
  switch (trendDirection) {
    case 'up':
      return '上向き';
    case 'down':
      return '下向き';
    case 'flat':
      return '横ばい';
    case 'unknown':
      return '判定前';
  }
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  desktopHeader: {
    minHeight: 84,
  },
  logo: {
    width: 64,
    height: 64,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  appName: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  desktopStatsRow: {
    maxWidth: 720,
  },
  setupAction: {
    marginTop: 14,
  },
  gameAction: {
    marginTop: 14,
  },
  accountAction: {
    marginTop: 14,
  },
  recommendTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  latestTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  latestBody: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  recommendBody: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  recommendReason: {
    marginTop: 8,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  recommendFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  practiceAction: {
    gap: 10,
    marginTop: 14,
  },
  detailRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  analysisSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  analysisSummaryItem: {
    flex: 1,
    minHeight: 74,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  analysisSummaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  analysisSummaryLabel: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  analysisAction: {
    marginTop: 14,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: colors.surface,
  },
  menuGrid: {
    gap: 10,
  },
  desktopMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 12,
  },
  menuCard: {
    minHeight: 72,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  desktopMenuCard: {
    width: '31%',
    minWidth: 260,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  menuHelper: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.72,
  },
});

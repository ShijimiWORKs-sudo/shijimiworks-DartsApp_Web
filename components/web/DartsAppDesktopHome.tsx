import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AccountBootstrapStatus } from '../../features/account/application';
import type { AccountOverview } from '../../features/account/domain';
import type { CountUpGameState } from '../../features/game/domain/countUp';
import type { CricketGameState } from '../../features/game/domain/cricket';
import type { MatchState } from '../../features/game/domain/match';
import type { ZeroOneGameState } from '../../features/game/domain/zeroOne';
import { AppButton } from '../AppButton';
import { Card } from '../Card';
import { SectionTitle } from '../SectionTitle';
import {
  formatRatingTenths,
  getAccountStatusLabel,
  getEligibleMatchProgress,
  getRatingMeasurementLabel,
} from '../account/accountUiModel';

export type DartsAppHomeActiveGame =
  | { mode: 'count_up'; game: CountUpGameState }
  | { mode: 'zero_one'; game: ZeroOneGameState }
  | { mode: 'cricket'; game: CricketGameState }
  | { mode: 'match'; match: MatchState };

export type DartsAppHomeRecentGame =
  | { mode: 'count_up'; game: CountUpGameState }
  | { mode: 'zero_one'; game: ZeroOneGameState }
  | { mode: 'cricket'; game: CricketGameState }
  | { mode: 'match'; match: MatchState };

type DartsAppDesktopHomeProps = {
  activeGame: DartsAppHomeActiveGame | null;
  recentResults: DartsAppHomeRecentGame[];
  accountOverview: AccountOverview | null;
  accountBootstrapStatus: AccountBootstrapStatus;
  isDatabaseAvailable: boolean;
  initializationError: Error | null;
};

export function DartsAppDesktopHome({
  activeGame,
  recentResults,
  accountOverview,
  accountBootstrapStatus,
  isDatabaseAvailable,
  initializationError,
}: DartsAppDesktopHomeProps) {
  const router = useRouter();

  return (
    <View style={styles.page} testID="darts-app-desktop-home">
      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>PC WEB</Text>
        <Text style={styles.title}>DartsApp</Text>
      </View>

      <View style={styles.heroGrid}>
        <Card muted style={styles.primaryCard}>
          {activeGame ? (
            <>
              <SectionTitle
                title={getActiveTitle(activeGame)}
                subtitle={getActiveSubtitle(activeGame)}
                tone="card"
              />
              <View style={styles.cardAction}>
                <AppButton
                  label="再開する"
                  onPress={() => router.push(getActiveRoute(activeGame))}
                />
              </View>
            </>
          ) : (
            <>
              <SectionTitle
                title="新しいゲームを始める"
                subtitle="COUNT-UP / 01 / CRICKET / MATCHをローカルDBへ保存しながらプレイします。"
                tone="card"
              />
              <View style={styles.modeActions}>
                <AppButton
                  label="COUNT-UP"
                  onPress={() => router.push('/game/count-up/settings')}
                  variant="countUp"
                  style={styles.modeButton}
                />
                <AppButton
                  label="01 GAME"
                  onPress={() => router.push('/game/01/settings')}
                  variant="zeroOne"
                  style={styles.modeButton}
                />
                <AppButton
                  label="CRICKET"
                  onPress={() => router.push('/game/cricket/settings')}
                  variant="cricket"
                  style={styles.modeButton}
                />
                <AppButton
                  label="MATCH"
                  onPress={() => router.push('/game/match/settings')}
                  variant="match"
                  style={styles.modeButton}
                />
              </View>
              <View style={styles.cardAction}>
                <AppButton
                  label="GAMEを開く"
                  onPress={() => router.push('/game')}
                  variant="secondary"
                />
              </View>
            </>
          )}
        </Card>

        <View style={styles.sideColumn}>
          <AccountOverviewCard
            accountOverview={accountOverview}
            accountBootstrapStatus={accountBootstrapStatus}
          />
          <RatingOverviewCard accountOverview={accountOverview} />
        </View>
      </View>

      <View style={styles.lowerGrid}>
        <Card style={styles.lowerCard}>
          <SectionTitle
            title="最近のゲーム結果"
            subtitle="ゲームDBに保存された完了済みゲームを表示します。"
            tone="card"
          />
          {recentResults.length > 0 ? (
            <View style={styles.resultList}>
              {recentResults.map((recent) => (
                <Pressable
                  key={getRecentKey(recent)}
                  accessibilityRole="button"
                  onPress={() => router.push(getResultRoute(recent))}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  <View>
                    <Text style={styles.resultTitle}>{getRecentTitle(recent)}</Text>
                    <Text style={styles.resultMeta}>{getRecentMeta(recent)}</Text>
                  </View>
                  <Text style={styles.resultOpen}>結果</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>最近のゲーム結果はまだありません。</Text>
          )}
        </Card>

        <Card style={styles.lowerCard}>
          <SectionTitle title="Web DB状態" tone="card" />
          <View style={styles.statusRows}>
            <InfoRow label="ゲームDB" value={isDatabaseAvailable ? '利用可能' : '準備中'} />
            <InfoRow
              label="初期化"
              value={initializationError ? 'エラー' : isDatabaseAvailable ? '完了' : '確認中'}
            />
            <InfoRow label="保存先" value="端末内SQLite" />
          </View>
          <Text style={styles.note}>
            Rating計算本体、音源、動画、カメラ判定は未実装です。ゲーム進行と結果保存を優先しています。
          </Text>
        </Card>
      </View>
    </View>
  );
}

function AccountOverviewCard({
  accountOverview,
  accountBootstrapStatus,
}: {
  accountOverview: AccountOverview | null;
  accountBootstrapStatus: AccountBootstrapStatus;
}) {
  const router = useRouter();

  if (!accountOverview) {
    const loading = accountBootstrapStatus === 'loading';
    return (
      <Card>
        <SectionTitle
          title="DartsApp Account"
          subtitle={loading ? 'Account状態を確認しています。' : 'Rating所有者を登録できます。'}
          tone="card"
        />
        <View style={styles.cardAction}>
          <AppButton
            label={loading ? '確認中...' : 'Account登録'}
            onPress={() => router.push('/account/register')}
            disabled={loading}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title="DartsApp Account"
        subtitle="この端末内のRating所有者です。"
        tone="card"
      />
      <View style={styles.statusRows}>
        <InfoRow label="表示名" value={accountOverview.account.displayName} />
        <InfoRow label="状態" value={getAccountStatusLabel(accountOverview.account.status)} />
      </View>
      <View style={styles.cardAction}>
        <AppButton
          label="Accountを開く"
          onPress={() => router.push('/account/profile')}
          variant="secondary"
        />
      </View>
    </Card>
  );
}

function RatingOverviewCard({ accountOverview }: { accountOverview: AccountOverview | null }) {
  if (!accountOverview) {
    return (
      <Card>
        <SectionTitle
          title="DartsApp Rating状態"
          subtitle="Account登録後、Eligible MATCHの進捗を表示します。"
          tone="card"
        />
        <View style={styles.statusRows}>
          <InfoRow label="測定状態" value="未測定" />
          <InfoRow label="Eligible MATCH" value="0/3" />
          <InfoRow label="DartsApp Rating" value="未確定" />
          <InfoRow label="単独Rating" value="対象外" />
        </View>
      </Card>
    );
  }

  const profile = accountOverview.ratingProfile;
  return (
    <Card>
      <SectionTitle
        title="DartsApp Rating状態"
        subtitle="初回RatingはEligible MATCH 3件で確定します。"
        tone="card"
      />
      <View style={styles.statusRows}>
        <InfoRow label="測定状態" value={getRatingMeasurementLabel(profile.measurementStatus)} />
        <InfoRow
          label="Eligible MATCH"
          value={getEligibleMatchProgress(profile.eligibleMatchCount)}
        />
        <InfoRow label="DartsApp Rating" value={formatRatingTenths(profile.ratingTenths)} />
        <InfoRow label="単独Rating" value={profile.establishedAt ? '対象可' : '対象外'} />
      </View>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getActiveRoute(active: DartsAppHomeActiveGame) {
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

function getResultRoute(recent: DartsAppHomeRecentGame) {
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

function getRecentKey(recent: DartsAppHomeRecentGame) {
  return recent.mode === 'match'
    ? `${recent.mode}-${recent.match.matchId}`
    : `${recent.mode}-${recent.game.gameId}`;
}

function getActiveTitle(active: DartsAppHomeActiveGame) {
  const prefix = getActiveStatus(active) === 'paused' ? '一時停止中の' : '進行中の';
  if (active.mode === 'match') {
    return `${prefix}MATCHを再開`;
  }
  if (active.mode === 'zero_one') {
    return `${prefix}01 GAMEを再開`;
  }
  if (active.mode === 'cricket') {
    return `${prefix}STANDARD CRICKETを再開`;
  }
  return `${prefix}COUNT-UPを再開`;
}

function getActiveSubtitle(active: DartsAppHomeActiveGame) {
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

function getActiveStatus(active: DartsAppHomeActiveGame) {
  return active.mode === 'match' ? active.match.status : active.game.status;
}

function getRecentTitle(recent: DartsAppHomeRecentGame) {
  if (recent.mode === 'match') {
    const winner = recent.match.players.find(
      (player) => player.playerId === recent.match.winnerPlayerId,
    );
    return `MATCH ${winner?.displayName ?? '-'} WIN`;
  }
  if (recent.mode === 'zero_one') {
    return `01 GAME 残り ${recent.game.result?.finalRemainingScore ?? recent.game.currentRemainingScore}`;
  }
  if (recent.mode === 'cricket') {
    return `STANDARD CRICKET ${recent.game.result?.finalCricketScore ?? recent.game.currentCricketScore} pt`;
  }
  return `COUNT-UP ${recent.game.result?.totalScore ?? recent.game.totalScore}`;
}

function getRecentMeta(recent: DartsAppHomeRecentGame) {
  if (recent.mode === 'match') {
    const completedAt = recent.match.completedAt
      ? formatDate(recent.match.completedAt)
      : '完了日時未記録';
    const ppd = recent.match.result?.zeroOnePpdMilli
      ? `PPD ${(recent.match.result.zeroOnePpdMilli / 1000).toFixed(1)}`
      : null;
    const mpr = recent.match.result?.cricketMprMilli
      ? `MPR ${(recent.match.result.cricketMprMilli / 1000).toFixed(2)}`
      : null;
    return [completedAt, ppd, mpr].filter(Boolean).join(' / ');
  }
  if (recent.mode === 'zero_one') {
    return `PPD ${((recent.game.result?.ppdMilli ?? 0) / 1000).toFixed(1)} / ${recent.game.result?.dartsThrown ?? recent.game.dartsThrown} darts`;
  }
  if (recent.mode === 'cricket') {
    return `MPR ${((recent.game.result?.mprMilli ?? recent.game.mprMilli) / 1000).toFixed(2)} / ${recent.game.result?.dartsThrown ?? recent.game.dartsThrown} darts`;
  }
  return `Bull ${recent.game.result?.bullCount ?? 0} / ${recent.game.result?.dartsThrown ?? recent.game.dartsThrown} darts`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const styles = StyleSheet.create({
  page: {
    gap: 18,
  },
  titleBlock: {
    minHeight: 72,
    justifyContent: 'center',
  },
  kicker: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    marginTop: 4,
    color: '#111827',
    fontSize: 34,
    fontWeight: '900',
  },
  heroGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  primaryCard: {
    flex: 1.35,
    minHeight: 236,
  },
  sideColumn: {
    flex: 1,
    gap: 14,
  },
  lowerGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  lowerCard: {
    flex: 1,
  },
  modeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  modeButton: {
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '45%',
  },
  cardAction: {
    marginTop: 14,
  },
  statusRows: {
    gap: 8,
    marginTop: 14,
  },
  infoRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  resultList: {
    gap: 8,
    marginTop: 14,
  },
  resultRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  resultMeta: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  resultOpen: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});

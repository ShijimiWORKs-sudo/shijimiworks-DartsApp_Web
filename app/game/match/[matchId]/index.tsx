import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { useDesktopWebLayout } from '../../../../components/web/useDesktopWebLayout';
import { WebGameShell, webGameStyles } from '../../../../components/web/WebGameShell';
import { colors } from '../../../../constants/theme';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import {
  clearMatchRedoSession,
  createMatchLeaveChoices,
  MatchManualWinnerRequiredError,
  MatchRedoSession,
} from '../../../../features/game/application/services';
import type {
  MatchDartInput,
  MatchGameState,
  MatchPlayerState,
  MatchState,
} from '../../../../features/game/domain/match';
import type { DartArea } from '../../../../features/game/domain/types';

const zeroOneSegments = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
const cricketSegments = [20, 19, 18, 17, 16, 15];

type BeforeRemoveEvent = {
  preventDefault: () => void;
};

type BeforeRemoveNavigation = {
  addListener(event: 'beforeRemove', callback: (event: BeforeRemoveEvent) => void): () => void;
};

export default function MatchPlayScreen() {
  const router = useRouter();
  const navigation = useNavigation<BeforeRemoveNavigation>();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [match, setMatch] = useState<MatchState | null>(null);
  const [selectedSegment, setSelectedSegment] = useState(20);
  const [selectedArea, setSelectedArea] =
    useState<Exclude<DartArea, 'outer_bull' | 'inner_bull' | 'miss'>>('single');
  const [isBusy, setIsBusy] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const allowNavigationRef = useRef(false);
  const redoSessionRef = useRef(new MatchRedoSession());

  const activeGame = match?.activeGame ?? null;
  const activeDarts = useMemo(
    () => activeGame?.currentTurn?.darts.filter((dart) => dart.status === 'active') ?? [],
    [activeGame],
  );
  const inputDisabled =
    !match || !activeGame || match.status !== 'in_progress' || activeDarts.length >= 3 || isBusy;

  const clearRedoSession = useCallback(() => {
    clearMatchRedoSession(redoSessionRef.current, setCanRedo);
  }, []);

  const navigateToGameHub = useCallback(() => {
    clearRedoSession();
    allowNavigationRef.current = true;
    router.replace('/game');
  }, [clearRedoSession, router]);

  const loadMatch = useCallback(async () => {
    if (!services || !matchId) return;

    try {
      const nextMatch = await services.match.loadMatch(matchId);
      if (nextMatch.status === 'completed') {
        clearRedoSession();
        allowNavigationRef.current = true;
        router.replace(`/game/match/${nextMatch.matchId}/result`);
        return;
      }
      if (nextMatch.status === 'aborted' || nextMatch.status === 'invalid') {
        navigateToGameHub();
        return;
      }
      setMatch(nextMatch);
    } catch {
      navigateToGameHub();
    }
  }, [clearRedoSession, matchId, navigateToGameHub, router, services]);

  const promptLeave = useCallback(() => {
    if (!services || !match) {
      navigateToGameHub();
      return;
    }

    if (match.status !== 'in_progress') {
      navigateToGameHub();
      return;
    }

    const choices = createMatchLeaveChoices({
      matchId: match.matchId,
      match: services.match,
      navigateToGameHub,
    });

    Alert.alert(
      'MATCHを離れますか？',
      '進行中のMATCHを保存して戻るか、途中終了として保存できます。',
      choices.map((choice) => ({
        text: choice.label,
        style: choice.style,
        onPress: () => {
          void choice.run().catch((error) => {
            Alert.alert('操作できませんでした', getErrorMessage(error));
          });
        },
      })),
    );
  }, [match, navigateToGameHub, services]);

  useFocusEffect(
    useCallback(() => {
      void loadMatch();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        promptLeave();
        return true;
      });
      return () => subscription.remove();
    }, [loadMatch, promptLeave]),
  );

  useFocusEffect(
    useCallback(() => {
      clearRedoSession();
      return () => {
        clearMatchRedoSession(redoSessionRef.current, setCanRedo);
      };
    }, [clearRedoSession]),
  );

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (allowNavigationRef.current || !match || match.status !== 'in_progress') return;
        event.preventDefault();
        promptLeave();
      });

      return unsubscribe;
    }, [match, navigation, promptLeave]),
  );

  const runAction = useCallback(
    async (action: () => Promise<MatchState | void>) => {
      setIsBusy(true);
      try {
        const nextMatch = await action();
        if (nextMatch) {
          setMatch(nextMatch);
          if (nextMatch.status === 'completed') {
            clearRedoSession();
            allowNavigationRef.current = true;
            router.replace(`/game/match/${nextMatch.matchId}/result`);
          }
        } else {
          await loadMatch();
        }
      } catch (error) {
        if (error instanceof MatchManualWinnerRequiredError) {
          Alert.alert('勝者を選択してください', '同点のため、手動で勝者を確定してください。');
          return;
        }
        Alert.alert('操作できませんでした', getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    },
    [clearRedoSession, loadMatch, router],
  );

  const recordDart = useCallback(
    (area: DartArea, segmentNumber: number | null) => {
      if (!services || !match || inputDisabled) return;

      const input: MatchDartInput = {
        area,
        segmentNumber,
        inputSource: 'manual_segment',
        clientActionId: `${match.matchId}:${Date.now()}:${Math.random()}`,
      };
      void runAction(async () => {
        const nextMatch = await services.match.recordDart(match.matchId, input);
        clearRedoSession();
        return nextMatch;
      });
    },
    [clearRedoSession, inputDisabled, match, runAction, services],
  );

  const handleUndo = useCallback(() => {
    if (!services || !match || !activeDarts.length) return;
    const dartId = activeDarts[activeDarts.length - 1]?.id;
    if (!dartId) return;
    void runAction(async () => {
      const nextMatch = await services.match.undoDart(match.matchId);
      redoSessionRef.current.push(dartId);
      setCanRedo(redoSessionRef.current.canRedo);
      return nextMatch;
    });
  }, [activeDarts, match, runAction, services]);

  const handleRedo = useCallback(() => {
    if (!services || !match || !canRedo) return;
    const dartId = redoSessionRef.current.pop();
    setCanRedo(redoSessionRef.current.canRedo);
    if (!dartId) return;
    void runAction(async () => services.match.redoDart(match.matchId, dartId));
  }, [canRedo, match, runAction, services]);

  const handleConfirmTurn = useCallback(() => {
    if (!services || !match) return;
    clearRedoSession();
    void runAction(async () => services.match.confirmTurn(match.matchId));
  }, [clearRedoSession, match, runAction, services]);

  const handleManualWinner = useCallback(
    (playerId: string) => {
      if (!services || !match) return;
      clearRedoSession();
      void runAction(async () =>
        services.match.completeCurrentGameByManualWinner(match.matchId, {
          winnerPlayerId: playerId,
          reason: '画面から手動で勝者を確定',
        }),
      );
    },
    [clearRedoSession, match, runAction, services],
  );

  const handleNextStep = useCallback(() => {
    if (!services || !match) return;
    clearRedoSession();
    if (match.phase === 'choice_required') {
      allowNavigationRef.current = true;
      router.replace(`/game/match/${match.matchId}/choice`);
      return;
    }
    void runAction(async () => services.match.startNextGame(match.matchId));
  }, [clearRedoSession, match, router, runAction, services]);

  const handleAbort = useCallback(() => {
    if (!services || !match) return;
    Alert.alert('MATCHを中断しますか？', '中断したMATCHはRating候補になりません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '中断する',
        style: 'destructive',
        onPress: () => {
          void runAction(async () => {
            await services.match.abortMatch(match.matchId);
            navigateToGameHub();
          });
        },
      },
    ]);
  }, [match, navigateToGameHub, runAction, services]);

  if (!match) {
    return (
      <ScreenShell showNav={false}>
        <SectionTitle title="MATCHを読み込み中" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <WebGameShell
        top={
          <SectionTitle
            title="MATCH"
            subtitle={`${getPlayerName(match.players, match.players[0]?.playerId)} ${match.players[0]?.gamesWon ?? 0} - ${
              match.players[1]?.gamesWon ?? 0
            } ${getPlayerName(match.players, match.players[1]?.playerId)}`}
          />
        }
        left={
          activeGame ? (
            <>
              <Card muted>
                <SectionTitle
                  title={`GAME ${activeGame.gameNo} ${formatGameMode(activeGame)}`}
                  subtitle={`Round ${activeGame.currentRoundNo} / 15`}
                  tone="card"
                />
                <View style={styles.playerRows}>
                  {activeGame.players.map((player) => (
                    <PlayerScoreRow
                      key={player.playerId}
                      player={player}
                      active={player.playerId === activeGame.currentPlayerId}
                      mode={activeGame.mode}
                      displayName={getPlayerName(match.players, player.playerId)}
                    />
                  ))}
                </View>
              </Card>

              <Card>
                <SectionTitle
                  title={`${getPlayerName(match.players, activeGame.currentPlayerId)}の投擲`}
                  subtitle={`${activeDarts.length} / 3 darts`}
                  tone="card"
                />
                <View style={styles.dartRow}>
                  {activeDarts.map((dart) => (
                    <Text key={dart.id} style={styles.dartText}>
                      {formatDart(dart.area, dart.segmentNumber)}
                    </Text>
                  ))}
                  {activeDarts.length === 0 ? <Text style={styles.emptyText}>未入力</Text> : null}
                </View>
              </Card>

              <Card>
                <SectionTitle title="ターン操作" tone="card" />
                <View style={[styles.actionGrid, isDesktopWeb && webGameStyles.desktopActionGrid]}>
                  <AppButton
                    label="Undo"
                    onPress={handleUndo}
                    disabled={activeDarts.length === 0 || isBusy}
                    variant="secondary"
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                  <AppButton
                    label="Redo"
                    onPress={handleRedo}
                    disabled={!canRedo || isBusy}
                    variant="secondary"
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                  <AppButton
                    label="ターン確定"
                    onPress={handleConfirmTurn}
                    disabled={isBusy || activeDarts.length === 0}
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                </View>
              </Card>
            </>
          ) : (
            <Card muted>
              <SectionTitle
                title={getPhaseTitle(match)}
                subtitle={getPhaseSubtitle(match)}
                tone="card"
              />
              <View style={styles.cardAction}>
                <AppButton
                  label={match.phase === 'choice_required' ? 'CHOICEへ進む' : '次のGAMEを開始'}
                  onPress={handleNextStep}
                  disabled={isBusy}
                  variant="match"
                />
              </View>
            </Card>
          )
        }
        right={
          activeGame ? (
            <>
              <Card>
                <SectionTitle title="入力" tone="card" />
                <View style={styles.areaGrid}>
                  {(['single', 'double', 'triple'] as const).map((area) => (
                    <OptionButton
                      key={area}
                      label={area.toUpperCase()}
                      selected={selectedArea === area}
                      onPress={() => setSelectedArea(area)}
                    />
                  ))}
                </View>
                <View style={styles.segmentGrid}>
                  {(activeGame.mode === 'cricket' ? cricketSegments : zeroOneSegments).map(
                    (segment) => (
                      <OptionButton
                        key={segment}
                        label={`${segment}`}
                        selected={selectedSegment === segment}
                        onPress={() => setSelectedSegment(segment)}
                      />
                    ),
                  )}
                </View>
                <View style={[styles.actionGrid, isDesktopWeb && webGameStyles.desktopActionGrid]}>
                  <AppButton
                    label={`${selectedArea.toUpperCase()} ${selectedSegment}`}
                    onPress={() => recordDart(selectedArea, selectedSegment)}
                    disabled={inputDisabled}
                    variant="match"
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                  <AppButton
                    label="BULL"
                    onPress={() => recordDart('inner_bull', null)}
                    disabled={inputDisabled}
                    variant="secondary"
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                  <AppButton
                    label="MISS"
                    onPress={() => recordDart('miss', null)}
                    disabled={inputDisabled}
                    variant="secondary"
                    style={isDesktopWeb && webGameStyles.desktopActionButton}
                  />
                </View>
              </Card>

              <Card>
                <SectionTitle title="手動勝者" subtitle="15R同点時などに使用します。" tone="card" />
                <View style={styles.actionGrid}>
                  {match.players.map((player) => (
                    <AppButton
                      key={player.playerId}
                      label={`${player.displayName} 勝利`}
                      onPress={() => handleManualWinner(player.playerId)}
                      disabled={isBusy}
                      variant="secondary"
                    />
                  ))}
                </View>
              </Card>
            </>
          ) : null
        }
        footer={
          <View style={[styles.footerActions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
            <AppButton
              label="ゲーム一覧へ"
              onPress={promptLeave}
              variant="secondary"
              style={isDesktopWeb && webGameStyles.desktopFooterButton}
            />
            <AppButton
              label="MATCH中断"
              onPress={handleAbort}
              variant="danger"
              style={isDesktopWeb && webGameStyles.desktopFooterButton}
            />
          </View>
        }
      />
    </ScreenShell>
  );
}

function PlayerScoreRow({
  player,
  active,
  mode,
  displayName,
}: {
  player: MatchGameState['players'][number];
  active: boolean;
  mode: MatchGameState['mode'];
  displayName: string;
}) {
  return (
    <View style={[styles.playerRow, active && styles.playerRowActive]}>
      <Text style={[styles.playerName, active && styles.activeText]}>{displayName}</Text>
      <Text style={styles.playerScore}>
        {mode === 'zero_one'
          ? `残り ${player.currentRemainingScore ?? '-'}`
          : `${player.currentCricketScore} pt`}
      </Text>
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function getPlayerName(players: MatchPlayerState[], playerId: string | null | undefined) {
  return players.find((player) => player.playerId === playerId)?.displayName ?? 'PLAYER';
}

function formatGameMode(game: MatchGameState) {
  return game.mode === 'zero_one' ? `${game.players[0]?.startingScore ?? ''} GAME` : 'CRICKET';
}

function formatDart(area: DartArea, segmentNumber: number | null) {
  if (area === 'inner_bull' || area === 'outer_bull') return 'BULL';
  if (area === 'miss') return 'MISS';
  return `${area[0]?.toUpperCase() ?? ''}${segmentNumber ?? ''}`;
}

function getPhaseTitle(match: MatchState) {
  if (match.phase === 'choice_required') return 'CHOICE待ち';
  return '次のGAMEを開始できます';
}

function getPhaseSubtitle(match: MatchState) {
  if (match.phase === 'choice_required') {
    return '1勝1敗のため、GAME3の種目と先攻を選択します。';
  }
  return '次のGAMEは自動生成せず、明示操作で開始します。';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  playerRows: {
    gap: 8,
    marginTop: 14,
  },
  playerRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  playerRowActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  playerName: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  activeText: {
    color: colors.primaryDark,
  },
  playerScore: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  dartRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  dartText: {
    minWidth: 54,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  areaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  option: {
    minHeight: 42,
    minWidth: 58,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  actionGrid: {
    gap: 10,
    marginTop: 14,
  },
  cardAction: {
    marginTop: 14,
  },
  footerActions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});

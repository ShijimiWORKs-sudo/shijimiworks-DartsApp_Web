import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { colors } from '../../../../constants/theme';
import { useAppState } from '../../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import {
  clearCricketRedoSession,
  CricketRedoSession,
} from '../../../../features/game/application/services';
import type {
  CricketDartInput,
  CricketGameState,
  CricketTargetState,
} from '../../../../features/game/domain/cricket';
import type { DartArea } from '../../../../features/game/domain/types';

const segmentNumbers = [20, 19, 18, 17, 16, 15];

type BeforeRemoveEvent = {
  preventDefault: () => void;
};

type BeforeRemoveNavigation = {
  addListener(event: 'beforeRemove', callback: (event: BeforeRemoveEvent) => void): () => void;
};

export default function CricketPlayScreen() {
  const router = useRouter();
  const navigation = useNavigation<BeforeRemoveNavigation>();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { profile } = useAppState();
  const { services } = useGameDatabase();
  const [game, setGame] = useState<CricketGameState | null>(null);
  const [selectedSegment, setSelectedSegment] = useState(20);
  const [isBusy, setIsBusy] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const allowNavigationRef = useRef(false);
  const redoSessionRef = useRef(new CricketRedoSession());

  const activeDarts = useMemo(
    () => game?.currentTurn?.darts.filter((dart) => dart.status === 'active') ?? [],
    [game],
  );
  const inputDisabled = !game || game.status !== 'in_progress' || activeDarts.length >= 3 || isBusy;

  const syncRedoState = useCallback(() => {
    setCanRedo(redoSessionRef.current.canRedo);
  }, []);

  const clearRedoSession = useCallback(() => {
    clearCricketRedoSession(redoSessionRef.current, setCanRedo);
  }, []);

  const navigateToGameHub = useCallback(() => {
    clearRedoSession();
    allowNavigationRef.current = true;
    router.replace('/game');
  }, [clearRedoSession, router]);

  const loadGame = useCallback(async () => {
    if (!services || !gameId) {
      return;
    }

    try {
      const nextGame = await services.cricket.loadGame(gameId);
      if (nextGame.status === 'completed') {
        clearRedoSession();
        allowNavigationRef.current = true;
        router.replace(`/game/cricket/${nextGame.gameId}/result`);
        return;
      }
      if (nextGame.status === 'aborted' || nextGame.status === 'invalid') {
        navigateToGameHub();
        return;
      }
      setGame(nextGame);
    } catch {
      navigateToGameHub();
    }
  }, [clearRedoSession, gameId, navigateToGameHub, router, services]);

  const promptLeave = useCallback(() => {
    if (!services || !game) {
      navigateToGameHub();
      return;
    }

    if (game.status !== 'in_progress') {
      navigateToGameHub();
      return;
    }

    Alert.alert(
      'CRICKETを離れますか？',
      '進行中のゲームを保存して戻るか、途中終了として保存できます。',
      [
        {
          text: '一時停止してゲームハブへ戻る',
          onPress: () => {
            void services.cricket
              .pauseGame(game.gameId)
              .then(navigateToGameHub)
              .catch((error) => Alert.alert('操作できませんでした', getErrorMessage(error)));
          },
        },
        { text: 'ゲームを続ける', style: 'cancel' },
        {
          text: '途中終了する',
          style: 'destructive',
          onPress: () => {
            Alert.alert('ゲームを途中終了しますか？', 'CRICKETをabortedとして保存します。', [
              { text: 'キャンセル', style: 'cancel' },
              {
                text: '途中終了する',
                style: 'destructive',
                onPress: () => {
                  void services.cricket
                    .abortGame(game.gameId)
                    .then(navigateToGameHub)
                    .catch((error) => Alert.alert('操作できませんでした', getErrorMessage(error)));
                },
              },
            ]);
          },
        },
      ],
    );
  }, [game, navigateToGameHub, services]);

  useFocusEffect(
    useCallback(() => {
      void loadGame();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        promptLeave();
        return true;
      });
      return () => subscription.remove();
    }, [loadGame, promptLeave]),
  );

  useFocusEffect(
    useCallback(() => {
      clearRedoSession();
      return () => {
        clearCricketRedoSession(redoSessionRef.current, setCanRedo);
      };
    }, [clearRedoSession]),
  );

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        if (allowNavigationRef.current || !game || game.status !== 'in_progress') {
          return;
        }

        event.preventDefault();
        promptLeave();
      });

      return unsubscribe;
    }, [game, navigation, promptLeave]),
  );

  const runAction = useCallback(
    async (action: () => Promise<CricketGameState | void>) => {
      setIsBusy(true);
      try {
        const nextGame = await action();
        if (nextGame) {
          setGame(nextGame);
          if (nextGame.status === 'completed') {
            clearRedoSession();
            allowNavigationRef.current = true;
            router.replace(`/game/cricket/${nextGame.gameId}/result`);
          }
        } else {
          await loadGame();
        }
      } catch (error) {
        Alert.alert('操作できませんでした', getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    },
    [clearRedoSession, loadGame, router],
  );

  const recordDart = useCallback(
    (area: DartArea, segmentNumber: number | null) => {
      if (!services || !game || inputDisabled) {
        return;
      }

      const input: CricketDartInput = {
        area,
        segmentNumber,
        inputSource: 'manual_segment',
        clientActionId: `${game.gameId}:${Date.now()}:${Math.random()}`,
      };
      void runAction(async () => {
        const nextGame = await services.cricket.recordDart(game.gameId, input);
        clearRedoSession();
        return nextGame;
      });
    },
    [clearRedoSession, game, inputDisabled, runAction, services],
  );

  const handleAbort = useCallback(() => {
    if (!services || !game) {
      return;
    }

    Alert.alert('ゲームを中断しますか？', '中断したCRICKETは結果として保存されません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '中断する',
        style: 'destructive',
        onPress: () => {
          void runAction(async () => {
            await services.cricket.abortGame(game.gameId);
            navigateToGameHub();
          });
        },
      },
    ]);
  }, [game, navigateToGameHub, runAction, services]);

  if (!game) {
    return (
      <ScreenShell showNav={false}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <SectionTitle title="STANDARD CRICKET" subtitle="読み込み中..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>STANDARD CRICKET</Text>
          <Text style={styles.score}>{game.currentCricketScore}</Text>
          <Text style={styles.meta}>
            Round {game.currentRoundNo} / 15 ・ MPR {(game.mprMilli / 1000).toFixed(2)}
          </Text>
        </View>
        <View style={styles.roundBadge}>
          <Text style={styles.roundBadgeLabel}>MARKS</Text>
          <Text style={styles.roundBadgeScore}>{game.currentTurnMarks}</Text>
        </View>
      </View>

      {game.allClosedZeroScore ? (
        <Card muted>
          <SectionTitle
            title="全ターゲットCLOSE済み"
            subtitle="0点のためゲームは終了しません。1点以上を取るか15ラウンドまで続行します。"
            tone="card"
          />
        </Card>
      ) : null}

      {game.status === 'paused' ? (
        <Card muted>
          <SectionTitle title="一時停止中" subtitle="再開すると入力できます。" tone="card" />
          <View style={styles.cardActions}>
            <AppButton
              label="再開"
              onPress={() => {
                if (services) {
                  void runAction(() => services.cricket.resumeGame(game.gameId));
                }
              }}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="ターゲット" tone="card" />
        <View style={styles.targetGrid}>
          {game.targetStates.map((state) => (
            <TargetCell key={state.target} state={state} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle
          title="現在のターン"
          subtitle={`このターン ${game.currentTurnMarks}マーク / ${game.currentTurnPoints}点`}
          tone="card"
        />
        <View style={styles.dartRow}>
          {[1, 2, 3].map((dartNo) => {
            const dart = activeDarts[dartNo - 1];
            return (
              <View key={dartNo} style={styles.dartCell}>
                <Text style={styles.dartNo}>D{dartNo}</Text>
                <Text style={styles.dartScore}>{dart ? dart.cricketMarks : '-'}</Text>
                <Text style={styles.dartMeta}>
                  {dart ? formatDart(dart.area, dart.segmentNumber) : ''}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.cardActions}>
          <AppButton
            label="1投戻す"
            onPress={() => {
              if (services) {
                const undoneDartId = activeDarts[activeDarts.length - 1]?.id ?? null;
                void runAction(async () => {
                  const nextGame = await services.cricket.undoDart(game.gameId);
                  if (undoneDartId) {
                    redoSessionRef.current.push(undoneDartId);
                    syncRedoState();
                  }
                  return nextGame;
                });
              }
            }}
            variant="secondary"
            disabled={isBusy || game.status !== 'in_progress' || activeDarts.length === 0}
          />
          <AppButton
            label="やり直す"
            onPress={() => {
              if (services) {
                const redoDartId = redoSessionRef.current.pop();
                if (!redoDartId) {
                  syncRedoState();
                  return;
                }

                void runAction(async () => {
                  const nextGame = await services.cricket.redoDart(game.gameId, redoDartId);
                  syncRedoState();
                  return nextGame;
                });
              }
            }}
            variant="secondary"
            disabled={isBusy || game.status !== 'in_progress' || !canRedo}
          />
          <AppButton
            label={game.currentRoundNo >= 15 ? 'ゲームを完了' : 'TURN終了'}
            onPress={() => {
              if (services) {
                void runAction(async () => {
                  const nextGame = await services.cricket.confirmTurn(game.gameId, {
                    machineType: profile?.machineType ?? null,
                  });
                  clearRedoSession();
                  return nextGame;
                });
              }
            }}
            disabled={isBusy || game.status !== 'in_progress' || activeDarts.length === 0}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle title="入力" subtitle="STANDARD CRICKET対象を入力します。" tone="card" />
        <View style={styles.segmentGrid}>
          {segmentNumbers.map((segment) => (
            <Pressable
              key={segment}
              accessibilityRole="button"
              onPress={() => setSelectedSegment(segment)}
              style={({ pressed }) => [
                styles.segmentButton,
                selectedSegment === segment && styles.segmentSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedSegment === segment && styles.segmentTextSelected,
                ]}
              >
                {segment}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hitGrid}>
          <AppButton
            label="S"
            onPress={() => recordDart('single', selectedSegment)}
            disabled={inputDisabled}
          />
          <AppButton
            label="D"
            onPress={() => recordDart('double', selectedSegment)}
            disabled={inputDisabled}
          />
          <AppButton
            label="T"
            onPress={() => recordDart('triple', selectedSegment)}
            disabled={inputDisabled}
          />
          <AppButton
            label="Outer Bull"
            onPress={() => recordDart('outer_bull', null)}
            disabled={inputDisabled}
            variant="secondary"
          />
          <AppButton
            label="Inner Bull"
            onPress={() => recordDart('inner_bull', null)}
            disabled={inputDisabled}
            variant="secondary"
          />
          <AppButton
            label="MISS"
            onPress={() => recordDart('miss', null)}
            disabled={inputDisabled}
            variant="secondary"
          />
        </View>
      </Card>

      <View style={styles.footerActions}>
        <AppButton label="ゲーム一覧へ" onPress={promptLeave} variant="secondary" />
        <AppButton label="途中終了" onPress={handleAbort} variant="danger" />
      </View>
    </ScreenShell>
  );
}

function TargetCell({ state }: { state: CricketTargetState }) {
  return (
    <View style={[styles.targetCell, state.isClosed && styles.targetClosed]}>
      <Text style={[styles.targetName, state.isClosed && styles.targetClosedText]}>
        {state.target}
      </Text>
      <Text style={styles.targetMarks}>{formatMarks(state.marksTotal)}</Text>
      <Text style={styles.targetPoints}>{state.pointsScored} pt</Text>
    </View>
  );
}

function formatMarks(value: number) {
  if (value <= 0) {
    return '-';
  }
  return 'x'.repeat(Math.min(value, 3)) + (value > 3 ? `+${value - 3}` : '');
}

function formatDart(area: DartArea, segmentNumber: number | null) {
  if (area === 'miss') {
    return 'MISS';
  }
  if (area === 'outer_bull') {
    return 'OB';
  }
  if (area === 'inner_bull') {
    return 'IB';
  }
  return `${area.slice(0, 1).toUpperCase()}${segmentNumber ?? ''}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  score: {
    color: colors.primaryDark,
    fontSize: 56,
    fontWeight: '900',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  roundBadge: {
    width: 96,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  roundBadgeLabel: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  roundBadgeScore: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '900',
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  targetCell: {
    width: '31%',
    minHeight: 76,
    justifyContent: 'center',
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.surfaceMuted,
  },
  targetClosed: {
    backgroundColor: colors.primarySoft,
  },
  targetName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  targetClosedText: {
    color: colors.primaryDark,
  },
  targetMarks: {
    marginTop: 2,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  targetPoints: {
    marginTop: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  dartRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  dartCell: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  dartNo: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  dartScore: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  dartMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  cardActions: {
    gap: 8,
    marginTop: 14,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  segmentButton: {
    width: '31%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  segmentSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  segmentText: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  segmentTextSelected: {
    color: colors.primaryDark,
  },
  hitGrid: {
    gap: 8,
    marginTop: 12,
  },
  footerActions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});

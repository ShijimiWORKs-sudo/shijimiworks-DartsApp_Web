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
import { useAppState } from '../../../../contexts/AppStateContext';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';
import {
  clearCountUpRedoSession,
  CountUpRedoSession,
} from '../../../../features/game/application/services/CountUpRedoSession';
import { createCountUpLeaveChoices } from '../../../../features/game/application/services/countUpLeaveActions';
import type { CountUpDartInput, CountUpGameState } from '../../../../features/game/domain/countUp';
import type { DartArea } from '../../../../features/game/domain/types';

const segmentNumbers = Array.from({ length: 20 }, (_, index) => index + 1);

type BeforeRemoveEvent = {
  preventDefault: () => void;
};

type BeforeRemoveNavigation = {
  addListener(event: 'beforeRemove', callback: (event: BeforeRemoveEvent) => void): () => void;
};

export default function CountUpPlayScreen() {
  const router = useRouter();
  const navigation = useNavigation<BeforeRemoveNavigation>();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const { profile } = useAppState();
  const { services } = useGameDatabase();
  const isDesktopWeb = useDesktopWebLayout();
  const [game, setGame] = useState<CountUpGameState | null>(null);
  const [selectedSegment, setSelectedSegment] = useState(20);
  const [isBusy, setIsBusy] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const allowNavigationRef = useRef(false);
  const redoSessionRef = useRef(new CountUpRedoSession());

  const currentDarts = useMemo(
    () => game?.turns.find((turn) => turn.id === game.currentTurnId)?.darts ?? [],
    [game],
  );
  const activeDarts = currentDarts.filter((dart) => dart.status === 'active');
  const inputDisabled = !game || game.status !== 'in_progress' || activeDarts.length >= 3 || isBusy;

  const syncRedoState = useCallback(() => {
    setCanRedo(redoSessionRef.current.canRedo);
  }, []);

  const clearRedoSession = useCallback(() => {
    clearCountUpRedoSession(redoSessionRef.current, setCanRedo);
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

    const nextGame = await services.countUp.loadGame(gameId);
    setGame(nextGame);
    if (nextGame.status === 'completed') {
      clearRedoSession();
      allowNavigationRef.current = true;
      router.replace(`/game/count-up/${nextGame.gameId}/result`);
    }
  }, [clearRedoSession, gameId, router, services]);

  const promptLeave = useCallback(() => {
    if (!services || !game) {
      navigateToGameHub();
      return;
    }

    if (game.status !== 'in_progress') {
      navigateToGameHub();
      return;
    }

    const choices = createCountUpLeaveChoices({
      gameId: game.gameId,
      countUp: services.countUp,
      navigateToGameHub,
    });

    Alert.alert(
      'COUNT-UPを離れますか？',
      '進行中のゲームを保存して戻るか、途中終了として保存できます。',
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
        clearCountUpRedoSession(redoSessionRef.current, setCanRedo);
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
    async (action: () => Promise<CountUpGameState | void>) => {
      setIsBusy(true);
      try {
        const nextGame = await action();
        if (nextGame) {
          setGame(nextGame);
          if (nextGame.status === 'completed') {
            clearRedoSession();
            allowNavigationRef.current = true;
            router.replace(`/game/count-up/${nextGame.gameId}/result`);
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

      const input: CountUpDartInput = {
        area,
        segmentNumber,
        inputSource: 'manual_segment',
        clientActionId: `${game.gameId}:${Date.now()}:${Math.random()}`,
      };
      void runAction(async () => {
        const nextGame = await services.countUp.recordDart(game.gameId, input);
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

    Alert.alert('ゲームを中断しますか？', '中断したCOUNT-UPは結果として保存されません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '中断する',
        style: 'destructive',
        onPress: () => {
          void runAction(async () => {
            await services.countUp.abortGame(game.gameId);
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
        <SectionTitle title="COUNT-UP" subtitle="読み込み中..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell showNav={false}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <WebGameShell
        left={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.kicker}>COUNT-UP</Text>
                <Text style={[styles.score, isDesktopWeb && styles.desktopScore]}>
                  {game.totalScore}
                </Text>
                <Text style={styles.meta}>
                  Round {game.currentRoundNo} / 8 ・ {game.bullRule}
                </Text>
              </View>
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeLabel}>TURN</Text>
                <Text style={styles.roundBadgeScore}>{game.currentTurnScore}</Text>
              </View>
            </View>

            {game.status === 'paused' ? (
              <Card muted>
                <SectionTitle title="一時停止中" subtitle="再開すると入力できます。" tone="card" />
                <View style={styles.cardActions}>
                  <AppButton
                    label="再開"
                    onPress={() => {
                      if (services) {
                        void runAction(() => services.countUp.resumeGame(game.gameId));
                      }
                    }}
                  />
                </View>
              </Card>
            ) : null}

            <Card>
              <SectionTitle
                title="現在のラウンド"
                subtitle="入力済みダーツを確認できます。"
                tone="card"
              />
              <View style={styles.dartRow}>
                {[1, 2, 3].map((dartNo) => {
                  const dart = activeDarts[dartNo - 1];
                  return (
                    <View key={dartNo} style={styles.dartCell}>
                      <Text style={styles.dartNo}>D{dartNo}</Text>
                      <Text style={styles.dartScore}>{dart ? dart.score : '-'}</Text>
                      <Text style={styles.dartMeta}>
                        {dart ? formatDart(dart.area, dart.segmentNumber) : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.cardActions, isDesktopWeb && webGameStyles.desktopActionGrid]}>
                <AppButton
                  label="1投戻す"
                  onPress={() => {
                    if (services) {
                      const undoneDartId = activeDarts[activeDarts.length - 1]?.id ?? null;
                      void runAction(async () => {
                        const nextGame = await services.countUp.undoDart(game.gameId);
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
                  style={isDesktopWeb && webGameStyles.desktopActionButton}
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
                        const nextGame = await services.countUp.redoDart(game.gameId, redoDartId);
                        syncRedoState();
                        return nextGame;
                      });
                    }
                  }}
                  variant="secondary"
                  disabled={isBusy || game.status !== 'in_progress' || !canRedo}
                  style={isDesktopWeb && webGameStyles.desktopActionButton}
                />
                <AppButton
                  label={game.currentRoundNo >= 8 ? 'ゲームを完了' : 'ラウンド確定'}
                  onPress={() => {
                    if (services) {
                      void runAction(async () => {
                        const nextGame = await services.countUp.confirmTurn(game.gameId, {
                          machineType: profile?.machineType ?? null,
                        });
                        clearRedoSession();
                        return nextGame;
                      });
                    }
                  }}
                  disabled={isBusy || game.status !== 'in_progress' || activeDarts.length === 0}
                  style={isDesktopWeb && webGameStyles.desktopActionButton}
                />
              </View>
            </Card>
          </>
        }
        right={
          <Card>
            <SectionTitle
              title="ダーツ入力"
              subtitle="数字を選び、Single / Double / Triple を押します。"
              tone="card"
            />
            <View style={styles.segmentGrid}>
              {segmentNumbers.map((number) => (
                <Pressable
                  key={number}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedSegment === number }}
                  onPress={() => setSelectedSegment(number)}
                  style={({ pressed }) => [
                    styles.segmentButton,
                    selectedSegment === number && styles.segmentButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      selectedSegment === number && styles.segmentButtonTextSelected,
                    ]}
                  >
                    {number}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.inputGrid, isDesktopWeb && webGameStyles.desktopActionGrid]}>
              <AppButton
                label="Single"
                onPress={() => recordDart('single', selectedSegment)}
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
              <AppButton
                label="Double"
                onPress={() => recordDart('double', selectedSegment)}
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
              <AppButton
                label="Triple"
                onPress={() => recordDart('triple', selectedSegment)}
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
              <AppButton
                label="Outer Bull"
                onPress={() => recordDart('outer_bull', null)}
                variant="secondary"
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
              <AppButton
                label="Inner Bull"
                onPress={() => recordDart('inner_bull', null)}
                variant="secondary"
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
              <AppButton
                label="MISS"
                onPress={() => recordDart('miss', null)}
                variant="secondary"
                disabled={inputDisabled}
                style={isDesktopWeb && webGameStyles.desktopActionButton}
              />
            </View>
          </Card>
        }
        footer={
          <View style={[styles.footerActions, isDesktopWeb && webGameStyles.desktopFooterActions]}>
            <AppButton
              label="一時停止"
              onPress={() => {
                if (services) {
                  void runAction(() => services.countUp.pauseGame(game.gameId));
                }
              }}
              variant="secondary"
              disabled={isBusy || game.status !== 'in_progress'}
              style={isDesktopWeb && webGameStyles.desktopFooterButton}
            />
            <AppButton
              label="中断"
              onPress={handleAbort}
              variant="danger"
              disabled={isBusy}
              style={isDesktopWeb && webGameStyles.desktopFooterButton}
            />
            <AppButton
              label="ゲーム一覧へ"
              onPress={promptLeave}
              variant="secondary"
              disabled={isBusy}
              style={isDesktopWeb && webGameStyles.desktopFooterButton}
            />
          </View>
        }
      />
    </ScreenShell>
  );
}

function formatDart(area: DartArea, segmentNumber: number | null) {
  switch (area) {
    case 'single':
      return `S${segmentNumber}`;
    case 'double':
      return `D${segmentNumber}`;
    case 'triple':
      return `T${segmentNumber}`;
    case 'outer_bull':
      return 'OB';
    case 'inner_bull':
      return 'IB';
    case 'miss':
      return 'MISS';
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: colors.text,
    fontSize: 58,
    fontWeight: '900',
  },
  desktopScore: {
    fontSize: 82,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  roundBadge: {
    width: 104,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  roundBadgeLabel: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  roundBadgeScore: {
    color: colors.primaryDark,
    fontSize: 31,
    fontWeight: '900',
  },
  dartRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  dartCell: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  dartNo: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  dartScore: {
    marginTop: 4,
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  dartMeta: {
    minHeight: 16,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  cardActions: {
    gap: 10,
    marginTop: 14,
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
  segmentButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  segmentButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  segmentButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  segmentButtonTextSelected: {
    color: colors.primaryDark,
  },
  inputGrid: {
    gap: 10,
    marginTop: 14,
  },
  footerActions: {
    gap: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});

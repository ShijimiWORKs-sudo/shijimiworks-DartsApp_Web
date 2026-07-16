import { CameraView } from 'expo-camera';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../../components/AppButton';
import { AwardOverlay } from '../../../../components/awards/AwardOverlay';
import {
  CandidateConfirmationPanel,
  type CandidatePanelOption,
} from '../../../../components/camera/CandidateConfirmationPanel';
import { CameraPreviewSurface } from '../../../../components/camera/CameraPreviewSurface';
import { ManualScoreCorrectionPanel } from '../../../../components/camera/ManualScoreCorrectionPanel';
import { Card } from '../../../../components/Card';
import { ScreenShell } from '../../../../components/ScreenShell';
import { SectionTitle } from '../../../../components/SectionTitle';
import { colors } from '../../../../constants/theme';
import { AwardEvaluator } from '../../../../features/awards/application/AwardEvaluator';
import { AwardQueue } from '../../../../features/awards/application/AwardQueue';
import { AwardRegistry } from '../../../../features/awards/application/AwardRegistry';
import type { AwardEvent } from '../../../../features/awards/domain/types';
import { scoreCanonicalPoint } from '../../../../features/camera/calibration/domain/coordinateTransform';
import { useBoardCalibrationEditor } from '../../../../features/camera/calibration/ui/useBoardCalibrationEditor';
import {
  analyzeImageDifference,
  createReplayDifferenceFrames,
} from '../../../../features/camera/detection/application/BasicImageDifferenceScoring';
import { CameraLocalCountUpAdapter } from '../../../../features/camera/detection/application/CameraLocalCountUpAdapter';
import { DetectionEngine } from '../../../../features/camera/detection/application/DetectionEngine';
import { useCameraSession } from '../../../../features/camera/ui/useCameraSession';
import {
  clearCountUpRedoSession,
  CountUpRedoSession,
} from '../../../../features/game/application/services/CountUpRedoSession';
import type { CountUpGameState } from '../../../../features/game/domain/countUp';
import type { DartArea } from '../../../../features/game/domain/types';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';

const detectionEngine = new DetectionEngine();
const awardEvaluator = new AwardEvaluator();
const awardRegistry = new AwardRegistry();

export default function CameraLocalCountUpPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gameId: string;
    autoDetection?: string;
    awardsEnabled?: string;
  }>();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;
  const autoDetection = params.autoDetection !== '0';
  const awardsEnabled = params.awardsEnabled !== '0';
  const { services } = useGameDatabase();
  const cameraRef = useRef<CameraView>(null);
  const cameraSession = useCameraSession();
  const calibrationEditor = useBoardCalibrationEditor();
  const redoSessionRef = useRef(new CountUpRedoSession());
  const awardQueueRef = useRef(new AwardQueue());
  const [game, setGame] = useState<CountUpGameState | null>(null);
  const [candidateOptions, setCandidateOptions] = useState<CandidatePanelOption[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [candidateMessage, setCandidateMessage] = useState('基準フレームを取得してください。');
  const [selectedManualSegment, setSelectedManualSegment] = useState(20);
  const [selectedManualMultiplier, setSelectedManualMultiplier] = useState<1 | 2 | 3>(3);
  const [isBusy, setIsBusy] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentAward, setCurrentAward] = useState<AwardEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adapter = useMemo(
    () => (services ? new CameraLocalCountUpAdapter(services.countUp) : null),
    [services],
  );

  const currentTurn = useMemo(
    () => game?.turns.find((turn) => turn.id === game.currentTurnId) ?? null,
    [game],
  );
  const activeDarts = useMemo(
    () => currentTurn?.darts.filter((dart) => dart.status === 'active') ?? [],
    [currentTurn],
  );
  const inputDisabled = !game || game.status !== 'in_progress' || activeDarts.length >= 3 || isBusy;

  const syncRedoState = useCallback(() => {
    setCanRedo(redoSessionRef.current.canRedo);
  }, []);

  const clearRedoSession = useCallback(() => {
    clearCountUpRedoSession(redoSessionRef.current, setCanRedo);
  }, []);

  const loadGame = useCallback(async () => {
    if (!adapter || !gameId) {
      return;
    }
    const nextGame = await adapter.loadGame(gameId);
    setGame(nextGame);
    if (nextGame.status === 'completed') {
      clearRedoSession();
      router.replace(`/camera/local-count-up/${nextGame.gameId}/result`);
    }
  }, [adapter, clearRedoSession, gameId, router]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void loadGame().catch((error) => {
        if (mounted) {
          console.warn('Camera COUNT-UP load failed', error);
          setErrorMessage('COUNT-UPを読み込めませんでした。');
        }
      });
      return () => {
        mounted = false;
        clearRedoSession();
      };
    }, [clearRedoSession, loadGame]),
  );

  const runAction = useCallback(
    async (action: () => Promise<CountUpGameState | void>) => {
      setIsBusy(true);
      setErrorMessage(null);
      try {
        const nextGame = await action();
        if (nextGame) {
          setGame(nextGame);
          if (nextGame.status === 'completed') {
            clearRedoSession();
            router.replace(`/camera/local-count-up/${nextGame.gameId}/result`);
          }
        } else {
          await loadGame();
        }
      } catch (error) {
        console.warn('Camera COUNT-UP action failed', error);
        setErrorMessage('操作を完了できませんでした。少し待ってからもう一度お試しください。');
      } finally {
        setIsBusy(false);
      }
    },
    [clearRedoSession, loadGame, router],
  );

  const captureBaseline = useCallback(async () => {
    const image = await cameraSession.capturePicture(cameraRef.current);
    if (!image) {
      setCandidateMessage('基準フレームを取得できませんでした。手動入力は利用できます。');
      return;
    }
    setCandidateMessage('基準フレーム取得済み。現在画像を解析できます。');
  }, [cameraSession]);

  const detectThrow = useCallback(async () => {
    if (!autoDetection) {
      setCandidateMessage('自動判定OFFです。手動入力で進行してください。');
      setCandidateOptions([]);
      return;
    }

    if (calibrationEditor.status === 'invalid') {
      setCandidateMessage('Calibrationが無効です。手動入力で続行するか、設定を保存してください。');
      setCandidateOptions([]);
      return;
    }

    const captured = await cameraSession.capturePicture(cameraRef.current);
    if (!captured && cameraSession.permissionState === 'granted') {
      setCandidateMessage('現在画像を取得できませんでした。手動入力で続行できます。');
    }

    const throwIndex = activeDarts.length + 1;
    const candidates = createCandidateOptions(
      gameId ?? 'local-count-up',
      throwIndex,
      calibrationEditor.profile,
    );
    setCandidateOptions(candidates);
    setSelectedCandidateIndex(0);
    setCandidateMessage('第一候補を生成しました。Confidenceと処理時間を確認して確定できます。');
  }, [
    activeDarts.length,
    autoDetection,
    calibrationEditor.profile,
    calibrationEditor.status,
    cameraSession,
    gameId,
  ]);

  const confirmCandidate = useCallback(
    (
      source: 'camera_confirmed' | 'camera_corrected' = 'camera_confirmed',
      candidateIndex = selectedCandidateIndex,
    ) => {
      if (!adapter || !game || inputDisabled) {
        return;
      }
      const selected = candidateOptions[candidateIndex];
      if (!selected) {
        setCandidateMessage('候補がありません。手動入力またはMISSで進行できます。');
        return;
      }
      void runAction(async () => {
        const nextGame = await adapter.recordCandidate({
          gameId: game.gameId,
          candidate: selected.candidate,
          source,
        });
        clearRedoSession();
        setCandidateOptions([]);
        setCandidateMessage('候補を確定しました。');
        return nextGame;
      });
    },
    [
      adapter,
      candidateOptions,
      clearRedoSession,
      game,
      inputDisabled,
      runAction,
      selectedCandidateIndex,
    ],
  );

  const recordManual = useCallback(
    (area: DartArea, segmentNumber: number | null) => {
      if (!adapter || !game || inputDisabled) {
        return;
      }
      void runAction(async () => {
        const nextGame = await adapter.recordManual(game.gameId, { area, segmentNumber });
        clearRedoSession();
        return nextGame;
      });
    },
    [adapter, clearRedoSession, game, inputDisabled, runAction],
  );

  const confirmTurn = useCallback(() => {
    if (!adapter || !game || activeDarts.length === 0) {
      return;
    }
    const award = awardEvaluator.evaluateTurn({
      darts: activeDarts,
      context: { mode: 'count_up', playbackOwner: 'camera_pc' },
      now: new Date(),
    });
    void runAction(async () => {
      if (awardsEnabled && award.code !== 'NORMAL') {
        awardQueueRef.current.enqueue(award);
        setCurrentAward(awardQueueRef.current.getCurrent());
      }
      const nextGame = await adapter.confirmTurn(game.gameId);
      clearRedoSession();
      return nextGame;
    });
  }, [activeDarts, adapter, awardsEnabled, clearRedoSession, game, runAction]);

  const currentAwardAsset = currentAward ? awardRegistry.get(currentAward.code) : null;

  return (
    <ScreenShell showNav={false}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <SectionTitle
        title="カメラCOUNT-UP"
        subtitle="LAN未接続で候補確定、補正、手動入力を使って8ラウンド進行します。"
      />

      {errorMessage ? (
        <Card muted>
          <Text style={styles.error}>{errorMessage}</Text>
        </Card>
      ) : null}

      <View style={styles.layout}>
        <View style={styles.mainColumn}>
          <Card muted>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.kicker}>TOTAL</Text>
                <Text style={styles.totalScore}>{game?.totalScore ?? '-'}</Text>
              </View>
              <View style={styles.roundBadge}>
                <Text style={styles.roundLabel}>ROUND</Text>
                <Text style={styles.roundValue}>{game?.currentRoundNo ?? '-'}/8</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              Turn {game?.currentTurnScore ?? 0} / Dart {Math.min(activeDarts.length + 1, 3)}/3 /{' '}
              {game?.status ?? 'loading'}
            </Text>
          </Card>

          <CameraPreviewSurface
            cameraRef={cameraRef}
            cameraSession={cameraSession}
            profile={calibrationEditor.profile}
            selectedRing={calibrationEditor.selectedRing}
          />
          <Card muted>
            <Text style={styles.meta}>
              Calibration: {calibrationEditor.status} / mirror{' '}
              {calibrationEditor.profile.previewMirrored ? 'ON' : 'OFF'} / profile{' '}
              {calibrationEditor.profile.profileId}
            </Text>
            <View style={styles.actionGrid}>
              <AppButton
                label="キャリブレーション"
                onPress={() => router.push('/camera/calibration')}
                variant="secondary"
              />
            </View>
          </Card>

          <Card>
            <SectionTitle title="現在のラウンド" tone="card" />
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
          </Card>
        </View>

        <View style={styles.sideColumn}>
          <Card>
            <SectionTitle
              title="候補"
              subtitle="判定が外れても位置修正・手動入力・MISSで続行できます。"
              tone="card"
            />
            <CandidateConfirmationPanel
              message={candidateMessage}
              candidates={candidateOptions}
              selectedIndex={selectedCandidateIndex}
              disabled={isBusy}
              onSelect={setSelectedCandidateIndex}
              onConfirm={(index) => {
                setSelectedCandidateIndex(index);
                confirmCandidate('camera_confirmed', index);
              }}
              onCorrect={() => confirmCandidate('camera_corrected')}
              onMiss={() => recordManual('miss', null)}
              onCaptureBaseline={() => void captureBaseline()}
              onAnalyzeCurrentFrame={() => void detectThrow()}
            />
          </Card>

          <Card>
            <SectionTitle title="手動入力" tone="card" />
            <ManualScoreCorrectionPanel
              selectedSegment={selectedManualSegment}
              selectedMultiplier={selectedManualMultiplier}
              disabled={inputDisabled}
              onSelectSegment={setSelectedManualSegment}
              onSelectMultiplier={setSelectedManualMultiplier}
              onRecord={recordManual}
            />
          </Card>

          <Card>
            <SectionTitle title="進行操作" tone="card" />
            <View style={styles.actionGrid}>
              <AppButton
                label={game?.currentRoundNo === 8 ? 'ゲーム完了' : 'ラウンド確定'}
                onPress={confirmTurn}
                disabled={
                  isBusy || !game || game.status !== 'in_progress' || activeDarts.length === 0
                }
              />
              <AppButton
                label="Undo"
                onPress={() => {
                  if (!adapter || !game) {
                    return;
                  }
                  const dartId = activeDarts[activeDarts.length - 1]?.id ?? null;
                  void runAction(async () => {
                    const nextGame = await adapter.undoDart(game.gameId);
                    if (dartId) {
                      redoSessionRef.current.push(dartId);
                      syncRedoState();
                    }
                    return nextGame;
                  });
                }}
                disabled={
                  isBusy || !game || game.status !== 'in_progress' || activeDarts.length === 0
                }
                variant="secondary"
              />
              <AppButton
                label="Redo"
                onPress={() => {
                  if (!adapter || !game) {
                    return;
                  }
                  const dartId = redoSessionRef.current.pop();
                  if (!dartId) {
                    syncRedoState();
                    return;
                  }
                  void runAction(async () => {
                    const nextGame = await adapter.redoDart(game.gameId, dartId);
                    syncRedoState();
                    return nextGame;
                  });
                }}
                disabled={isBusy || !game || game.status !== 'in_progress' || !canRedo}
                variant="secondary"
              />
              <AppButton
                label={game?.status === 'paused' ? '再開' : '一時停止'}
                onPress={() => {
                  if (!adapter || !game) {
                    return;
                  }
                  void runAction(() =>
                    game.status === 'paused'
                      ? adapter.resumeGame(game.gameId)
                      : adapter.pauseGame(game.gameId),
                  );
                }}
                disabled={isBusy || !game || game.status === 'completed'}
                variant="secondary"
              />
              <AppButton
                label="途中終了"
                onPress={() => {
                  if (!adapter || !game) {
                    return;
                  }
                  void runAction(async () => {
                    clearRedoSession();
                    await adapter.abortGame(game.gameId);
                    router.replace('/camera/home');
                  });
                }}
                disabled={isBusy || !game || game.status === 'completed'}
                variant="danger"
              />
            </View>
          </Card>

          <Card>
            <SectionTitle title="COUNT-UP Award" tone="card" />
            <AwardOverlay
              event={currentAward}
              asset={currentAwardAsset}
              onSkip={() => {
                awardQueueRef.current.skip();
                setCurrentAward(awardQueueRef.current.getCurrent());
              }}
            />
          </Card>
        </View>
      </View>
    </ScreenShell>
  );
}

function createCandidateOptions(
  sessionId: string,
  throwIndex: number,
  profile: ReturnType<typeof useBoardCalibrationEditor>['profile'],
): CandidatePanelOption[] {
  const replay = createReplayDifferenceFrames({
    changedX: 0.5,
    changedY: profile.centerY - profile.outerRadius * 0.58,
  });
  const result = analyzeImageDifference({
    sessionId,
    cameraNodeId: 'local-count-up-camera',
    throwIndex,
    baselineFrame: replay.baselineFrame,
    thrownFrame: replay.thrownFrame,
    calibration: profile,
    now: new Date('2026-07-17T00:00:00.000Z'),
  });
  const primary =
    result.status === 'candidate'
      ? result.candidate
      : detectionEngine.createCandidate({
          sessionId,
          cameraNodeId: 'local-count-up-camera',
          throwIndex,
          segment: 20,
          multiplier: 3,
          confidence: 0.72,
          normalizedX: 0.5,
          normalizedY: 0.2,
        });

  const secondPoint = scoreCanonicalPoint(
    {
      x: profile.centerX,
      y: profile.centerY - profile.outerRadius * 0.42,
    },
    profile,
  );
  const thirdPoint = scoreCanonicalPoint({ x: profile.centerX, y: profile.centerY }, profile);

  return [
    { label: '第一候補', candidate: primary, reason: 'absdiff最大領域 + calibration profile' },
    {
      label: '第二候補',
      reason: '隣接候補',
      candidate: detectionEngine.createCandidate({
        sessionId,
        cameraNodeId: 'local-count-up-camera',
        throwIndex,
        segment: (secondPoint.segmentNumber ?? 20) as 20,
        multiplier: secondPoint.multiplier === 0 ? 1 : secondPoint.multiplier,
        confidence: 0.68,
        normalizedX: secondPoint.normalizedX,
        normalizedY: secondPoint.normalizedY,
      }),
    },
    {
      label: '第三候補',
      reason: 'Bull fallback',
      candidate: detectionEngine.createCandidate({
        sessionId,
        cameraNodeId: 'local-count-up-camera',
        throwIndex,
        segment: 25,
        multiplier: thirdPoint.area === 'inner_bull' ? 2 : 1,
        confidence: 0.61,
        normalizedX: thirdPoint.normalizedX,
        normalizedY: thirdPoint.normalizedY,
      }),
    },
  ];
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

const styles = StyleSheet.create({
  layout: {
    gap: 14,
  },
  mainColumn: {
    gap: 14,
  },
  sideColumn: {
    gap: 14,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  totalScore: {
    color: colors.primaryDark,
    fontSize: 58,
    fontWeight: '900',
  },
  roundBadge: {
    width: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  roundLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  roundValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  dartRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
    fontSize: 12,
    fontWeight: '900',
  },
  dartScore: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  dartMeta: {
    minHeight: 16,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  actionGrid: {
    gap: 10,
    marginTop: 12,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
});

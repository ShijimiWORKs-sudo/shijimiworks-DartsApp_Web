import { CameraView } from 'expo-camera';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useBoardCalibrationEditor } from '../../../../features/camera/calibration/ui/useBoardCalibrationEditor';
import { analyzeImageDifference } from '../../../../features/camera/detection/application/BasicImageDifferenceScoring';
import { CameraLocalCountUpAdapter } from '../../../../features/camera/detection/application/CameraLocalCountUpAdapter';
import {
  analyzePersistentBoardDifference,
  analyzeTemporalMotion,
  resizeAnalysisFrame,
  throwDetectionThresholds,
  toGrayscaleFrame,
  type CameraAnalysisFrame,
  type CameraFrameSource,
  type DetectionState,
  type MotionAnalysis,
} from '../../../../features/camera/detection/application/CameraFrameSource';
import { WebCameraFrameSource } from '../../../../features/camera/detection/infrastructure/WebCameraFrameSource';
import { useCameraSession } from '../../../../features/camera/ui/useCameraSession';
import {
  clearCountUpRedoSession,
  CountUpRedoSession,
} from '../../../../features/game/application/services/CountUpRedoSession';
import type { CountUpGameState } from '../../../../features/game/domain/countUp';
import type { DartArea } from '../../../../features/game/domain/types';
import { useGameDatabase } from '../../../../contexts/GameDatabaseContext';

const awardEvaluator = new AwardEvaluator();
const awardRegistry = new AwardRegistry();
const localCameraNodeId = 'local-count-up-camera';
const baselineRetryLimit = 3;
const baselineRetryBackoffMs = 1000;
const captureTimeoutMs = 8000;
const monitorFrameMaxSize = throwDetectionThresholds.monitorMaxSize;
const analysisFrameMaxSize = throwDetectionThresholds.analysisMaxSize;

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
  const [detectionState, setDetectionState] = useState<DetectionState>(
    autoDetection ? 'camera_not_ready' : 'disabled',
  );
  const [autoMonitorEnabled, setAutoMonitorEnabled] = useState(autoDetection);
  const [baselineFrameId, setBaselineFrameId] = useState<string | null>(null);
  const [temporalAnalysis, setTemporalAnalysis] = useState<MotionAnalysis | null>(null);
  const [persistentAnalysis, setPersistentAnalysis] = useState<MotionAnalysis | null>(null);
  const [stableStartedAt, setStableStartedAt] = useState<number | null>(null);
  const [lastProcessingMs, setLastProcessingMs] = useState<number | null>(null);
  const [monitorError, setMonitorError] = useState<{ code: string; message: string } | null>(null);
  const [motionSeen, setMotionSeen] = useState(false);
  const [persistentChangeSeen, setPersistentChangeSeen] = useState(false);
  const [lastTransitionReason, setLastTransitionReason] = useState('initializing');
  const baselineFrameRef = useRef<CameraAnalysisFrame | null>(null);
  const baselineMonitorFrameRef = useRef<CameraAnalysisFrame | null>(null);
  const previousFrameRef = useRef<CameraAnalysisFrame | null>(null);
  const lastStableFrameRef = useRef<CameraAnalysisFrame | null>(null);
  const pendingThrownFrameRef = useRef<CameraAnalysisFrame | null>(null);
  const monitorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorInFlightRef = useRef(false);
  const monitorGenerationRef = useRef(0);
  const mountedRef = useRef(false);
  const stableStartedAtRef = useRef<number | null>(null);
  const motionSeenSinceBaselineRef = useRef(false);
  const persistentChangeSeenRef = useRef(false);
  const baselineRetryCountRef = useRef(0);
  const baselineRetryBlockedUntilRef = useRef(0);
  const capturePictureRef = useRef(cameraSession.capturePicture);
  const frameSourceRef = useRef<WebCameraFrameSource | null>(null);

  capturePictureRef.current = cameraSession.capturePicture;
  if (!frameSourceRef.current) {
    frameSourceRef.current = new WebCameraFrameSource({
      captureImage: () => capturePictureRef.current(cameraRef.current),
    });
  }

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
  const cameraReady =
    cameraSession.permissionState === 'granted' &&
    cameraSession.shouldMountCamera &&
    cameraSession.isReady;
  const canAutoMonitor =
    autoMonitorEnabled &&
    autoDetection &&
    cameraReady &&
    calibrationEditor.status === 'saved' &&
    game?.status === 'in_progress' &&
    activeDarts.length < 3 &&
    candidateOptions.length === 0 &&
    currentAward === null &&
    !isBusy;

  const syncRedoState = useCallback(() => {
    setCanRedo(redoSessionRef.current.canRedo);
  }, []);

  const clearRedoSession = useCallback(() => {
    clearCountUpRedoSession(redoSessionRef.current, setCanRedo);
  }, []);

  const stopMonitorLoop = useCallback(() => {
    monitorGenerationRef.current += 1;
    if (monitorTimerRef.current) {
      clearTimeout(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
  }, []);

  const resetThrowDetectionRefs = useCallback((frame?: CameraAnalysisFrame | null) => {
    if (frame) {
      const monitorFrame = resizeAnalysisFrame(frame, monitorFrameMaxSize);
      baselineMonitorFrameRef.current = monitorFrame;
      previousFrameRef.current = monitorFrame;
      lastStableFrameRef.current = monitorFrame;
    } else {
      baselineMonitorFrameRef.current = null;
      previousFrameRef.current = null;
      lastStableFrameRef.current = null;
    }
    motionSeenSinceBaselineRef.current = false;
    persistentChangeSeenRef.current = false;
    stableStartedAtRef.current = null;
    setMotionSeen(false);
    setPersistentChangeSeen(false);
    setStableStartedAt(null);
    setTemporalAnalysis(null);
    setPersistentAnalysis(null);
  }, []);

  const clearBaseline = useCallback(
    (message: string) => {
      baselineFrameRef.current = null;
      baselineMonitorFrameRef.current = null;
      previousFrameRef.current = null;
      lastStableFrameRef.current = null;
      pendingThrownFrameRef.current = null;
      setBaselineFrameId(null);
      resetThrowDetectionRefs(null);
      setCandidateOptions([]);
      setCandidateMessage(message);
      setDetectionState('paused');
      setMonitorError(null);
      setLastTransitionReason('baseline cleared');
    },
    [resetThrowDetectionRefs],
  );

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
      mountedRef.current = true;
      void loadGame().catch((error) => {
        if (mounted) {
          console.warn('Camera COUNT-UP load failed', error);
          setErrorMessage('COUNT-UPを読み込めませんでした。');
        }
      });
      return () => {
        mounted = false;
        mountedRef.current = false;
        stopMonitorLoop();
        clearRedoSession();
      };
    }, [clearRedoSession, loadGame, stopMonitorLoop]),
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

  const captureBaseline = useCallback(
    async (options?: { manual?: boolean }) => {
      if (options?.manual && monitorInFlightRef.current) {
        const concurrentError = {
          code: 'CONCURRENT_CAPTURE_BLOCKED',
          message: getMonitorErrorMessage('CONCURRENT_CAPTURE_BLOCKED'),
        };
        setMonitorError(concurrentError);
        setCandidateMessage(`基準画像を取得できませんでした（${concurrentError.code}）。`);
        return;
      }

      if (options?.manual) {
        baselineRetryCountRef.current = 0;
        baselineRetryBlockedUntilRef.current = 0;
        setAutoMonitorEnabled(autoDetection);
        setMonitorError(null);
      } else if (Date.now() < baselineRetryBlockedUntilRef.current) {
        logMonitor('baseline backoff', {
          retryCount: baselineRetryCountRef.current,
          blockedUntil: baselineRetryBlockedUntilRef.current,
        });
        return;
      }

      if (calibrationEditor.status !== 'saved') {
        setMonitorError({
          code: 'CALIBRATION_NOT_SAVED',
          message: 'Calibrationを保存してから自動判定を開始してください。',
        });
        setCandidateMessage(
          'Calibrationを保存してから自動判定を開始してください。手動入力は利用できます。',
        );
        setDetectionState('error');
        return;
      }

      if (!cameraReady) {
        setMonitorError({
          code: 'CAMERA_NOT_READY',
          message: 'カメラの準備完了を待っています。',
        });
        setDetectionState('camera_not_ready');
        setCandidateMessage('カメラの準備完了を待っています。');
        return;
      }

      const frameSource = frameSourceRef.current;
      if (!frameSource) {
        setMonitorError({
          code: 'CAMERA_FRAME_SOURCE_UNAVAILABLE',
          message: 'カメラフレーム取得処理を初期化できませんでした。',
        });
        setDetectionState('error');
        return;
      }

      logMonitor('state transition', { to: 'baseline_capturing' });
      setDetectionState('baseline_capturing');
      setCandidateMessage('基準画像を取得中です。');
      try {
        logMonitor('capture start', { kind: 'baseline' });
        const frame = await captureFrameWithTimeout(frameSource, {
          maxSize: analysisFrameMaxSize,
        });
        logMonitor('capture end', { kind: 'baseline', frameId: frame.frameId });
        if (!mountedRef.current) {
          return;
        }
        baselineFrameRef.current = frame;
        pendingThrownFrameRef.current = null;
        resetThrowDetectionRefs(frame);
        baselineRetryCountRef.current = 0;
        baselineRetryBlockedUntilRef.current = 0;
        setBaselineFrameId(frame.frameId);
        setCandidateOptions([]);
        setLastProcessingMs(null);
        setMonitorError(null);
        setLastTransitionReason('baseline captured');
        setDetectionState('waiting_throw');
        setCandidateMessage('基準画像を取得しました。投擲待機中です。');
      } catch (error) {
        console.warn('Baseline frame capture failed', error);
        if (mountedRef.current) {
          const nextRetryCount = baselineRetryCountRef.current + 1;
          baselineRetryCountRef.current = nextRetryCount;
          baselineRetryBlockedUntilRef.current = Date.now() + baselineRetryBackoffMs;
          const monitorCaptureError = toMonitorError(error);
          setMonitorError(monitorCaptureError);
          setDetectionState('error');
          logMonitor('baseline retry', {
            retryCount: nextRetryCount,
            errorCode: monitorCaptureError.code,
          });
          if (nextRetryCount >= baselineRetryLimit) {
            setAutoMonitorEnabled(false);
            setCandidateMessage(
              `基準画像を取得できませんでした（${monitorCaptureError.code}）。基準画像を再取得してください。`,
            );
          } else {
            setCandidateMessage(
              `基準画像を取得できませんでした（${monitorCaptureError.code}）。少し待って再試行します。`,
            );
          }
        }
      }
    },
    [autoDetection, calibrationEditor.status, cameraReady, resetThrowDetectionRefs],
  );

  const detectThrow = useCallback(
    async (options?: { manual?: boolean; thrownFrame?: CameraAnalysisFrame }) => {
      if (options?.manual && monitorInFlightRef.current) {
        const concurrentError = {
          code: 'CONCURRENT_CAPTURE_BLOCKED',
          message: getMonitorErrorMessage('CONCURRENT_CAPTURE_BLOCKED'),
        };
        setMonitorError(concurrentError);
        setCandidateMessage(`候補を生成できませんでした（${concurrentError.code}）。`);
        return;
      }

      if (!autoDetection) {
        setCandidateMessage('自動判定OFFです。手動入力で進行してください。');
        setCandidateOptions([]);
        return;
      }

      if (calibrationEditor.status !== 'saved') {
        setMonitorError({
          code: 'CALIBRATION_NOT_SAVED',
          message: 'Calibrationを保存してから自動判定を開始してください。',
        });
        setCandidateMessage(
          'Calibrationを保存してから自動判定を開始してください。手動入力は利用できます。',
        );
        setCandidateOptions([]);
        return;
      }

      if (!baselineFrameRef.current) {
        setMonitorError({
          code: 'BASELINE_FRAME_MISSING',
          message: '基準画像が未取得です。',
        });
        setCandidateMessage('基準画像が未取得です。先に基準画像を再取得してください。');
        setCandidateOptions([]);
        setDetectionState('baseline_capturing');
        return;
      }

      const frameSource = frameSourceRef.current;
      if (!frameSource) {
        setMonitorError({
          code: 'CAMERA_FRAME_SOURCE_UNAVAILABLE',
          message: 'カメラフレーム取得処理を初期化できませんでした。',
        });
        setDetectionState('error');
        setCandidateOptions([]);
        return;
      }

      logMonitor('state transition', { to: 'analyzing' });
      setDetectionState('analyzing');
      setCandidateMessage('判定中です。');
      try {
        logMonitor('capture start', { kind: 'throw' });
        const thrownFrame =
          options?.thrownFrame ??
          (await captureFrameWithTimeout(frameSource, {
            maxSize: analysisFrameMaxSize,
          }));
        logMonitor('capture end', { kind: 'throw', frameId: thrownFrame.frameId });
        if (!mountedRef.current || !baselineFrameRef.current) {
          return;
        }
        const throwIndex = activeDarts.length + 1;
        const result = analyzeImageDifference({
          sessionId: gameId ?? 'local-count-up',
          cameraNodeId: localCameraNodeId,
          throwIndex,
          baselineFrame: toGrayscaleFrame(baselineFrameRef.current),
          thrownFrame: toGrayscaleFrame(thrownFrame),
          calibration: calibrationEditor.profile,
          now: new Date(),
        });
        setLastProcessingMs(result.processingMs);
        if (result.status === 'candidate') {
          pendingThrownFrameRef.current = thrownFrame;
          const options = createCandidateOptionsFromResult(result);
          setCandidateOptions(options);
          setSelectedCandidateIndex(0);
          setMonitorError(null);
          setDetectionState('waiting_confirmation');
          setCandidateMessage('候補確認待ちです。第一候補から確認してください。');
          return;
        }

        pendingThrownFrameRef.current = null;
        setCandidateOptions([]);
        if (result.reason === 'NO_SIGNIFICANT_CHANGE' && !options?.manual) {
          motionSeenSinceBaselineRef.current = false;
          persistentChangeSeenRef.current = false;
          setMotionSeen(false);
          setPersistentChangeSeen(false);
          setDetectionState('waiting_throw');
          setMonitorError(null);
          setLastTransitionReason('no persistent candidate');
          setCandidateMessage('投擲を待機しています。');
          return;
        }

        setDetectionState(options?.manual ? 'waiting_throw' : 'error');
        setMonitorError(
          options?.manual
            ? null
            : {
                code: result.reason,
                message: '候補を生成できませんでした。',
              },
        );
        setCandidateMessage(
          options?.manual && result.reason === 'NO_SIGNIFICANT_CHANGE'
            ? '盤面に有意な変化がありません。'
            : `候補を生成できませんでした（${result.reason}）。基準画像を再取得するか手動入力で続行してください。`,
        );
      } catch (error) {
        console.warn('Throw frame analysis failed', error);
        if (mountedRef.current) {
          const monitorCaptureError = toMonitorError(error);
          setMonitorError(monitorCaptureError);
          setDetectionState('error');
          setCandidateOptions([]);
          setCandidateMessage(
            `候補を生成できませんでした（${monitorCaptureError.code}）。手動入力で続行できます。`,
          );
        }
      }
    },
    [
      activeDarts.length,
      autoDetection,
      calibrationEditor.profile,
      calibrationEditor.status,
      gameId,
    ],
  );

  const processMonitorFrame = useCallback(
    async (generation: number) => {
      if (monitorInFlightRef.current || !canAutoMonitor) {
        if (!canAutoMonitor) {
          logMonitor('canAutoMonitor false', {
            autoMonitorEnabled,
            autoDetection,
            cameraReady,
            calibrationStatus: calibrationEditor.status,
            gameStatus: game?.status,
            activeDartsCount: activeDarts.length,
            candidateCount: candidateOptions.length,
            hasAward: currentAward !== null,
            isBusy,
          });
        }
        return;
      }

      monitorInFlightRef.current = true;
      try {
        if (
          !baselineFrameRef.current ||
          !baselineMonitorFrameRef.current ||
          !previousFrameRef.current
        ) {
          await captureBaseline();
          return;
        }

        const frameSource = frameSourceRef.current;
        if (!frameSource) {
          throw new Error('CAMERA_FRAME_SOURCE_UNAVAILABLE');
        }

        logMonitor('capture start', { kind: 'monitor', generation });
        const currentFrame = await captureFrameWithTimeout(frameSource, {
          maxSize: monitorFrameMaxSize,
        });
        logMonitor('capture end', { kind: 'monitor', generation, frameId: currentFrame.frameId });
        if (!mountedRef.current || generation !== monitorGenerationRef.current) {
          return;
        }

        const temporal = analyzeTemporalMotion({
          previousFrame: previousFrameRef.current,
          currentFrame,
          calibration: calibrationEditor.profile,
        });
        const persistent = analyzePersistentBoardDifference({
          baselineFrame: baselineMonitorFrameRef.current,
          currentFrame,
          calibration: calibrationEditor.profile,
        });
        setTemporalAnalysis(temporal);
        setPersistentAnalysis(persistent);
        persistentChangeSeenRef.current =
          persistentChangeSeenRef.current || persistent.hasPersistentChange;
        setPersistentChangeSeen(persistentChangeSeenRef.current);

        if (
          temporal.reason === 'frame_size_mismatch' ||
          persistent.reason === 'frame_size_mismatch'
        ) {
          setDetectionState('error');
          setMonitorError({
            code: 'FRAME_SIZE_MISMATCH',
            message: 'フレームサイズが変わりました。',
          });
          setCandidateMessage('フレームサイズが変わりました。基準画像を再取得してください。');
          return;
        }

        if (temporal.reason === 'obstruction') {
          motionSeenSinceBaselineRef.current = true;
          setMotionSeen(true);
          setDetectionState('waiting_stable');
          setLastTransitionReason('obstruction');
          stableStartedAtRef.current = null;
          setStableStartedAt(null);
          previousFrameRef.current = currentFrame;
          setCandidateMessage(
            '大きな動きを検出しました。手や身体が映らなくなるまで待機しています。',
          );
          return;
        }

        if (temporal.reason === 'motion') {
          motionSeenSinceBaselineRef.current = true;
          setMotionSeen(true);
          setDetectionState('motion_detected');
          setLastTransitionReason('temporal motion');
          stableStartedAtRef.current = null;
          setStableStartedAt(null);
          previousFrameRef.current = currentFrame;
          setCandidateMessage('動きを検出しました。静止待ちです。');
          return;
        }

        if (!motionSeenSinceBaselineRef.current) {
          stableStartedAtRef.current = null;
          setStableStartedAt(null);
          previousFrameRef.current = currentFrame;
          lastStableFrameRef.current = currentFrame;
          setDetectionState('waiting_throw');
          setLastTransitionReason('no temporal motion');
          setCandidateMessage('投擲を待機しています。');
          return;
        }

        if (temporal.reason === 'stable') {
          const now = Date.now();
          const startedAt = stableStartedAtRef.current ?? now;
          stableStartedAtRef.current = startedAt;
          setStableStartedAt(startedAt);
          const stableMs = now - startedAt;
          setDetectionState('waiting_stable');
          setLastTransitionReason('temporal stable');
          setCandidateMessage(
            stableMs >= throwDetectionThresholds.stableDurationMs
              ? '静止しました。盤面差分を確認しています。'
              : '静止待ちです。',
          );
          if (stableMs >= throwDetectionThresholds.stableDurationMs) {
            lastStableFrameRef.current = currentFrame;
            if (persistentChangeSeenRef.current) {
              setDetectionState('analyzing');
              setLastTransitionReason('motion and persistent change');
              const analysisFrame = await captureFrameWithTimeout(frameSource, {
                maxSize: analysisFrameMaxSize,
              });
              await detectThrow({ thrownFrame: analysisFrame });
              previousFrameRef.current = currentFrame;
              return;
            }

            motionSeenSinceBaselineRef.current = false;
            persistentChangeSeenRef.current = false;
            setMotionSeen(false);
            setPersistentChangeSeen(false);
            stableStartedAtRef.current = null;
            setStableStartedAt(null);
            previousFrameRef.current = currentFrame;
            setDetectionState('waiting_throw');
            setMonitorError(null);
            setLastTransitionReason('motion without persistent change');
            setCandidateMessage('投擲を待機しています。');
          }
          return;
        }

        stableStartedAtRef.current = null;
        setStableStartedAt(null);
        previousFrameRef.current = currentFrame;
        setDetectionState('waiting_throw');
        setLastTransitionReason('temporal idle');
      } catch (error) {
        console.warn('Automatic throw monitor failed', error);
        if (mountedRef.current) {
          const monitorCaptureError = toMonitorError(error);
          setMonitorError(monitorCaptureError);
          setDetectionState('error');
          setCandidateMessage(
            `自動監視でフレームを取得できませんでした（${monitorCaptureError.code}）。手動入力で続行できます。`,
          );
        }
      } finally {
        monitorInFlightRef.current = false;
      }
    },
    [
      activeDarts.length,
      autoDetection,
      autoMonitorEnabled,
      calibrationEditor.profile,
      calibrationEditor.status,
      cameraReady,
      canAutoMonitor,
      captureBaseline,
      candidateOptions.length,
      currentAward,
      detectThrow,
      game?.status,
      isBusy,
    ],
  );

  useEffect(() => {
    stopMonitorLoop();
    if (!canAutoMonitor) {
      if (!autoDetection) {
        setDetectionState('disabled');
      } else if (!cameraReady) {
        setDetectionState('camera_not_ready');
      } else if (game?.status === 'paused') {
        setDetectionState('paused');
      }
      logMonitor('canAutoMonitor false', {
        autoMonitorEnabled,
        autoDetection,
        cameraReady,
        calibrationStatus: calibrationEditor.status,
        gameStatus: game?.status,
        activeDartsCount: activeDarts.length,
        candidateCount: candidateOptions.length,
        hasAward: currentAward !== null,
        isBusy,
      });
      return;
    }

    const generation = monitorGenerationRef.current;
    logMonitor('monitor generation', { generation });
    const tick = () => {
      if (generation !== monitorGenerationRef.current || !mountedRef.current) {
        return;
      }
      void processMonitorFrame(generation).finally(() => {
        if (generation === monitorGenerationRef.current && mountedRef.current) {
          monitorTimerRef.current = setTimeout(tick, throwDetectionThresholds.frameIntervalMs);
        }
      });
    };
    monitorTimerRef.current = setTimeout(tick, throwDetectionThresholds.frameIntervalMs);
    return stopMonitorLoop;
  }, [
    activeDarts.length,
    autoDetection,
    autoMonitorEnabled,
    calibrationEditor.status,
    canAutoMonitor,
    cameraReady,
    candidateOptions.length,
    currentAward,
    game?.status,
    isBusy,
    processMonitorFrame,
    stopMonitorLoop,
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
        if (pendingThrownFrameRef.current) {
          baselineFrameRef.current = pendingThrownFrameRef.current;
          setBaselineFrameId(pendingThrownFrameRef.current.frameId);
          resetThrowDetectionRefs(pendingThrownFrameRef.current);
          pendingThrownFrameRef.current = null;
          setDetectionState('waiting_throw');
          setLastTransitionReason('candidate confirmed baseline promoted');
        }
        setCandidateOptions([]);
        setMonitorError(null);
        setCandidateMessage('候補を確定しました。次の投擲待機中です。');
        return nextGame;
      });
    },
    [
      adapter,
      candidateOptions,
      clearRedoSession,
      game,
      inputDisabled,
      resetThrowDetectionRefs,
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
        clearBaseline(
          '手動入力を保存しました。盤面とDBを合わせるため基準画像を再取得してください。',
        );
        return nextGame;
      });
    },
    [adapter, clearBaseline, clearRedoSession, game, inputDisabled, runAction],
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
      clearBaseline('ラウンドを確定しました。ダーツを抜いて基準画像を再取得してください。');
      return nextGame;
    });
  }, [activeDarts, adapter, awardsEnabled, clearBaseline, clearRedoSession, game, runAction]);

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
            <SectionTitle title="自動判定状態" tone="card" />
            <View style={styles.statusGrid}>
              <InfoRow label="状態" value={formatDetectionState(detectionState)} />
              <InfoRow label="基準画像" value={baselineFrameId ? '取得済み' : '未取得'} />
              <InfoRow label="source" value={baselineFrameRef.current?.sourceKind ?? '-'} />
              <InfoRow label="mime" value={baselineFrameRef.current?.mimeType ?? '-'} />
              <InfoRow
                label="captured"
                value={
                  baselineFrameRef.current?.capturedWidth &&
                  baselineFrameRef.current?.capturedHeight
                    ? `${baselineFrameRef.current.capturedWidth}×${baselineFrameRef.current.capturedHeight}`
                    : '-'
                }
              />
              <InfoRow
                label="analysis"
                value={
                  baselineFrameRef.current?.analysisWidth &&
                  baselineFrameRef.current?.analysisHeight
                    ? `${baselineFrameRef.current.analysisWidth}×${baselineFrameRef.current.analysisHeight}`
                    : '-'
                }
              />
              <InfoRow label="uri prefix" value={baselineFrameRef.current?.uriPrefixKind ?? '-'} />
              <InfoRow label="base64" value={baselineFrameRef.current?.base64Kind ?? '-'} />
              <InfoRow label="decode" value={baselineFrameRef.current?.decodeStatus ?? '-'} />
              <InfoRow
                label="時間差分"
                value={
                  temporalAnalysis
                    ? `${(temporalAnalysis.changedPixelRatio * 100).toFixed(1)}%`
                    : '-'
                }
              />
              <InfoRow
                label="盤面差分"
                value={
                  persistentAnalysis
                    ? `${(persistentAnalysis.changedPixelRatio * 100).toFixed(1)}%`
                    : '-'
                }
              />
              <InfoRow label="motion seen" value={motionSeen ? 'yes' : 'no'} />
              <InfoRow label="persistent change" value={persistentChangeSeen ? 'yes' : 'no'} />
              <InfoRow
                label="temporal pixels"
                value={temporalAnalysis ? String(temporalAnalysis.changedPixelCount) : '-'}
              />
              <InfoRow
                label="persistent pixels"
                value={persistentAnalysis ? String(persistentAnalysis.changedPixelCount) : '-'}
              />
              <InfoRow
                label="静止時間"
                value={stableStartedAt ? `${Date.now() - stableStartedAt}ms` : '-'}
              />
              <InfoRow
                label="analysis resolution"
                value={`${monitorFrameMaxSize}/${analysisFrameMaxSize}`}
              />
              <InfoRow label="transition" value={lastTransitionReason} />
              <InfoRow label="処理時間" value={lastProcessingMs ? `${lastProcessingMs}ms` : '-'} />
              <InfoRow label="エラー" value={monitorError ? monitorError.code : '-'} />
            </View>
            {monitorError ? <Text style={styles.error}>{monitorError.message}</Text> : null}
            <View style={styles.actionGrid}>
              <AppButton
                label="自動監視開始"
                onPress={() => setAutoMonitorEnabled(true)}
                disabled={!autoDetection || autoMonitorEnabled}
              />
              <AppButton
                label="自動監視停止"
                onPress={() => {
                  setAutoMonitorEnabled(false);
                  stopMonitorLoop();
                  setDetectionState('paused');
                }}
                disabled={!autoMonitorEnabled}
                variant="secondary"
              />
              <AppButton
                label="ダーツを抜きました／次ラウンド開始"
                onPress={() => void captureBaseline({ manual: true })}
                disabled={isBusy || !cameraReady}
                variant="secondary"
              />
            </View>
          </Card>

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
              onReject={() => {
                pendingThrownFrameRef.current = null;
                setCandidateOptions([]);
                if (lastStableFrameRef.current) {
                  previousFrameRef.current = lastStableFrameRef.current;
                }
                motionSeenSinceBaselineRef.current = false;
                persistentChangeSeenRef.current = false;
                setMotionSeen(false);
                setPersistentChangeSeen(false);
                stableStartedAtRef.current = null;
                setStableStartedAt(null);
                setDetectionState('waiting_throw');
                setLastTransitionReason('candidate rejected baseline kept');
                setCandidateMessage(
                  '候補を拒否しました。基準画像は更新していません。再解析または手動入力を選んでください。',
                );
              }}
              onMiss={() => recordManual('miss', null)}
              onCaptureBaseline={() => void captureBaseline({ manual: true })}
              onAnalyzeCurrentFrame={() => void detectThrow({ manual: true })}
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
                    clearBaseline(
                      'Undoしました。盤面とDBを合わせるため基準画像を再取得してください。',
                    );
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
                    clearBaseline(
                      'Redoしました。盤面とDBを合わせるため基準画像を再取得してください。',
                    );
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
                      ? adapter.resumeGame(game.gameId).then((nextGame) => {
                          clearBaseline('再開しました。基準画像を再取得してください。');
                          return nextGame;
                        })
                      : adapter.pauseGame(game.gameId).then((nextGame) => {
                          stopMonitorLoop();
                          setDetectionState('paused');
                          return nextGame;
                        }),
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
                    stopMonitorLoop();
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

function createCandidateOptionsFromResult(
  result: Extract<ReturnType<typeof analyzeImageDifference>, { status: 'candidate' }>,
): CandidatePanelOption[] {
  return [result.candidate, ...result.alternateCandidates].slice(0, 3).map((candidate, index) => ({
    label: ['第一候補', '第二候補', '第三候補'][index] ?? `候補${index + 1}`,
    candidate,
    reason: `実カメラframe absdiff / changed ${(result.changedPixelRatio * 100).toFixed(1)}%`,
  }));
}

async function captureFrameWithTimeout(
  frameSource: CameraFrameSource,
  options?: { maxSize?: number },
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      frameSource.captureFrame(options),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('CAPTURE_TIMEOUT')), captureTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function toMonitorError(error: unknown) {
  const rawCode =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'CAMERA_FRAME_UNAVAILABLE';
  const code = rawCode.includes('timeout') ? 'CAPTURE_TIMEOUT' : rawCode;
  return {
    code,
    message: getMonitorErrorMessage(code),
  };
}

function getMonitorErrorMessage(code: string) {
  switch (code) {
    case 'CAMERA_FRAME_UNAVAILABLE':
      return 'カメラフレームを取得できませんでした。';
    case 'CAMERA_FRAME_REQUIRES_WEB_BASE64':
      return 'Webカメラのbase64画像を取得できませんでした。';
    case 'WEB_IMAGE_DECODE_FAILED':
      return '撮影画像を解析用に読み込めませんでした。';
    case 'WEB_IMAGE_SOURCE_EMPTY':
      return '撮影画像のsourceが空でした。';
    case 'WEB_IMAGE_DATA_URI_INVALID':
      return '撮影画像のData URI形式が不正でした。';
    case 'WEB_IMAGE_MIME_UNSUPPORTED':
      return '対応していない画像形式でした。';
    case 'WEB_CANVAS_UNAVAILABLE':
    case 'WEB_CANVAS_CONTEXT_UNAVAILABLE':
      return 'ブラウザの画像解析機能を利用できませんでした。';
    case 'CAPTURE_TIMEOUT':
      return '撮影がタイムアウトしました。';
    case 'CAMERA_FRAME_SOURCE_UNAVAILABLE':
      return 'カメラフレーム取得処理を初期化できませんでした。';
    case 'CONCURRENT_CAPTURE_BLOCKED':
      return '前の撮影処理が完了するまで待機してください。';
    default:
      return '自動判定を完了できませんでした。手動入力で続行できます。';
  }
}

function logMonitor(event: string, details?: Record<string, unknown>) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[camera-count-up-monitor]', event, details ?? {});
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDetectionState(state: DetectionState) {
  switch (state) {
    case 'disabled':
      return '自動判定OFF';
    case 'camera_not_ready':
      return 'カメラ準備中';
    case 'baseline_capturing':
      return '基準画像を取得中';
    case 'waiting_throw':
      return '投擲待機中';
    case 'motion_detected':
      return '動きを検出';
    case 'waiting_stable':
      return '静止待ち';
    case 'analyzing':
      return '判定中';
    case 'candidate_ready':
    case 'waiting_confirmation':
      return '候補確認待ち';
    case 'baseline_updating':
      return '次投を待機中';
    case 'paused':
      return '一時停止中';
    case 'error':
      return '確認が必要';
  }
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
  statusGrid: {
    gap: 8,
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
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

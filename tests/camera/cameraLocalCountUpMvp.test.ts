import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { CandidateRouter } from '../../features/camera/detection/application/CandidateRouter';
import { CandidateStore } from '../../features/camera/detection/application/CandidateStore';
import {
  CameraLocalCountUpAdapter,
  mapDartInputSource,
} from '../../features/camera/detection/application/CameraLocalCountUpAdapter';
import { DetectionEngine } from '../../features/camera/detection/application/DetectionEngine';
import type { CandidateRouterPort } from '../../features/camera/detection/domain/types';

const root = process.cwd();

test('local_count_up candidates route to local game without LAN pairing', () => {
  const calls: string[] = [];
  const router = new CandidateRouter(new CandidateStore(), createPort(calls));
  const result = router.route(createCandidate(), {
    operationMode: 'local_count_up',
    authority: 'camera_pc',
    isLanConnected: false,
  });

  assert.equal(result.destination, 'local_game');
  assert.equal(result.status, 'stored');
  assert.deepEqual(calls, ['local']);
});

test('local COUNT-UP input sources map to existing COUNT-UP DB input sources', () => {
  assert.equal(mapDartInputSource('manual'), 'manual_segment');
  assert.equal(mapDartInputSource('camera_confirmed'), 'photo_detected');
  assert.equal(mapDartInputSource('camera_corrected'), 'photo_adjusted');
});

test('CameraLocalCountUpAdapter records candidates through existing CountUpGameService', async () => {
  const recorded: unknown[] = [];
  const adapter = new CameraLocalCountUpAdapter({
    recordDart: async (_gameId: string, input: unknown) => {
      recorded.push(input);
      return {} as never;
    },
  } as never);

  await adapter.recordCandidate({ gameId: 'game-1', candidate: createCandidate() });
  await adapter.recordCandidate({
    gameId: 'game-1',
    candidate: createCandidate(),
    source: 'camera_corrected',
  });
  await adapter.recordManual('game-1', { area: 'miss', segmentNumber: null });

  assert.equal(recorded.length, 3);
  assert.deepEqual(
    recorded.map((input) => (input as { inputSource: string }).inputSource),
    ['photo_detected', 'photo_adjusted', 'manual_segment'],
  );
});

test('camera COUNT-UP routes expose playable MVP controls without WebSocket dependency', () => {
  const home = readRepoFile('app/camera/home.tsx');
  const settings = readRepoFile('app/camera/local-count-up/settings.tsx');
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const result = readRepoFile('app/camera/local-count-up/[gameId]/result.tsx');

  assert.match(home, /カメラPC単体モード/);
  assert.match(home, /COUNT-UPを始める/);
  assert.match(settings, /自動判定/);
  assert.match(settings, /音声・演出/);
  assert.match(play, /CameraView/);
  assert.match(play, /基準画像を取得/);
  assert.match(play, /onAnalyzeCurrentFrame/);
  assert.match(play, /位置修正/);
  assert.match(play, /手動入力/);
  assert.match(play, /Undo/);
  assert.match(play, /Redo/);
  assert.match(play, /一時停止/);
  assert.match(play, /途中終了/);
  assert.match(play, /AwardOverlay/);
  assert.match(result, /カメラCOUNT-UP結果/);
  assert.doesNotMatch(play, /useLanCameraPeer|WebSocket|pairingCode/);
});

test('camera COUNT-UP production route uses real frame source instead of replay fixtures', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /WebCameraFrameSource/);
  assert.match(play, /frameSource\.captureFrame\(options\)/);
  assert.match(play, /baselineFrameRef/);
  assert.match(play, /pendingThrownFrameRef/);
  assert.match(play, /analyzeTemporalMotion/);
  assert.match(play, /analyzePersistentBoardDifference/);
  assert.match(play, /analyzeImageDifference/);
  assert.match(play, /toGrayscaleFrame\(baselineFrameRef\.current\)/);
  assert.doesNotMatch(play, /createReplayDifferenceFrames/);
  assert.doesNotMatch(play, /changedX|changedY/);
  assert.doesNotMatch(play, /Bull fallback|fallback.*20|segment: 20,[\s\S]*confidence: 0\.72/);
});

test('camera COUNT-UP automatic detection exposes state machine and loop controls', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  for (const state of [
    'camera_not_ready',
    'baseline_capturing',
    'waiting_throw',
    'motion_detected',
    'waiting_stable',
    'analyzing',
    'waiting_confirmation',
    'paused',
    'error',
  ]) {
    assert.match(play, new RegExp(state));
  }

  assert.match(play, /自動判定状態/);
  assert.match(play, /時間差分/);
  assert.match(play, /盤面差分/);
  assert.match(play, /motion seen/);
  assert.match(play, /persistent change/);
  assert.match(play, /静止時間/);
  assert.match(play, /処理時間/);
  assert.match(play, /自動監視開始/);
  assert.match(play, /自動監視停止/);
  assert.match(play, /ダーツを抜きました／次ラウンド開始/);
  assert.match(play, /stopMonitorLoop/);
  assert.match(play, /monitorInFlightRef/);
  assert.match(play, /setTimeout\(tick, throwDetectionThresholds\.frameIntervalMs\)/);
});

test('camera COUNT-UP monitor requires temporal motion before persistent throw analysis', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const processMonitorFrameBlock = extractConstBlock(play, 'processMonitorFrame');

  assert.match(play, /previousFrameRef/);
  assert.match(play, /motionSeenSinceBaselineRef/);
  assert.match(play, /persistentChangeSeenRef/);
  assert.match(play, /lastStableFrameRef/);
  assert.match(processMonitorFrameBlock, /analyzeTemporalMotion/);
  assert.match(processMonitorFrameBlock, /analyzePersistentBoardDifference/);
  assert.match(processMonitorFrameBlock, /!motionSeenSinceBaselineRef\.current/);
  assert.match(processMonitorFrameBlock, /setLastTransitionReason\('no temporal motion'\)/);
  assert.match(processMonitorFrameBlock, /persistentChangeSeenRef\.current/);
  assert.match(processMonitorFrameBlock, /detectThrow\(\{ thrownFrame: analysisFrame \}\)/);
});

test('camera COUNT-UP baseline capture uses warm-up multi-frame median and noise floor', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /captureStableBaseline/);
  assert.match(play, /baselineWarmupCount/);
  assert.match(play, /baselineSampleCount/);
  assert.match(play, /createMedianBaselineFrame/);
  assert.match(play, /measureBaselineNoise/);
  assert.match(play, /BASELINE_UNSTABLE/);
  assert.match(play, /baselineNoiseRef/);
  assert.match(play, /baseline quality/);
  assert.match(play, /baseline noise/);
});

test('camera COUNT-UP does not latch persistent change before motion and confirms it continuously', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const processMonitorFrameBlock = extractConstBlock(play, 'processMonitorFrame');

  assert.match(play, /persistentCandidateCountRef/);
  assert.match(play, /persistentBoundingBoxRef/);
  assert.match(play, /persistentConfirmFrameCount = 3/);
  assert.match(processMonitorFrameBlock, /!motionSeenSinceBaselineRef\.current/);
  assert.match(processMonitorFrameBlock, /persistentChangeSeenRef\.current = false/);
  assert.match(
    processMonitorFrameBlock,
    /persistentCandidateCountRef\.current >= persistentConfirmFrameCount/,
  );
  assert.match(processMonitorFrameBlock, /boundingBoxesOverlap/);
  assert.match(play, /投擲後差分確定/);
  assert.match(play, /瞬間盤面差分/);
});

test('camera COUNT-UP baseline recapture resets stale persistent state', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const captureBaselineBlock = extractConstBlock(play, 'captureBaseline');
  const resetBlock = extractConstBlock(play, 'resetThrowDetectionRefs');

  assert.match(captureBaselineBlock, /baselineFrameRef\.current = null/);
  assert.match(captureBaselineBlock, /baselineMonitorFrameRef\.current = null/);
  assert.match(captureBaselineBlock, /previousFrameRef\.current = null/);
  assert.match(captureBaselineBlock, /lastStableFrameRef\.current = null/);
  assert.match(captureBaselineBlock, /pendingThrownFrameRef\.current = null/);
  assert.match(captureBaselineBlock, /baselineNoiseRef\.current = null/);
  assert.match(resetBlock, /persistentCandidateCountRef\.current = 0/);
  assert.match(resetBlock, /persistentBoundingBoxRef\.current = null/);
});

test('camera COUNT-UP monitor uses two stage resolution and treats no significant change as nonfatal', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /monitorFrameMaxSize = throwDetectionThresholds\.monitorMaxSize/);
  assert.match(play, /analysisFrameMaxSize = throwDetectionThresholds\.analysisMaxSize/);
  assert.match(play, /maxSize: monitorFrameMaxSize/);
  assert.match(play, /maxSize: analysisFrameMaxSize/);
  assert.match(play, /result\.reason === 'NO_SIGNIFICANT_CHANGE' && !options\?\.manual/);
  assert.match(play, /setDetectionState\('waiting_throw'\)/);
  assert.match(play, /投擲を待機しています。/);
  assert.doesNotMatch(play, /NO_SIGNIFICANT_CHANGE'[\s\S]{0,160}setDetectionState\('error'\)/);
});

test('camera COUNT-UP monitor lifecycle does not depend on capture in-progress state', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const canAutoMonitorBlock = extractConstBlock(play, 'canAutoMonitor');
  const monitorEffectBlock = extractUseEffectBlock(play, 'monitor generation');

  assert.match(canAutoMonitorBlock, /cameraReady/);
  assert.doesNotMatch(canAutoMonitorBlock, /canTakePicture|isCapturing/);
  assert.match(monitorEffectBlock, /cameraReady/);
  assert.doesNotMatch(monitorEffectBlock, /cameraSession\.canTakePicture|isCapturing/);
  assert.match(play, /const cameraReady =/);
});

test('camera COUNT-UP monitor uses stable frame source and in-flight capture guard', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /capturePictureRef\.current = cameraSession\.capturePicture/);
  assert.match(play, /frameSourceRef\.current = new WebCameraFrameSource/);
  assert.match(play, /captureImage: \(\) => capturePictureRef\.current\(cameraRef\.current\)/);
  assert.doesNotMatch(play, /new WebCameraFrameSource\(\{[\s\S]*\},\s*\[cameraSession\]/);
  assert.match(play, /if \(monitorInFlightRef\.current \|\| !canAutoMonitor\)/);
  assert.match(play, /finally \{\s*monitorInFlightRef\.current = false;/);
  assert.doesNotMatch(play, /stopMonitorLoop[\s\S]{0,180}monitorInFlightRef\.current = false/);
});

test('camera COUNT-UP baseline retry backoff stops after three failures and can recover manually', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /const baselineRetryLimit = 3/);
  assert.match(play, /const baselineRetryBackoffMs = 1000/);
  assert.match(
    play,
    /baselineRetryBlockedUntilRef\.current = Date\.now\(\) \+ baselineRetryBackoffMs/,
  );
  assert.match(play, /nextRetryCount >= baselineRetryLimit/);
  assert.match(play, /setAutoMonitorEnabled\(false\)/);
  assert.match(play, /captureBaseline\(\{ manual: true \}\)/);
  assert.match(play, /baselineRetryCountRef\.current = 0/);
});

test('camera COUNT-UP stable detection is ref based and candidate wait stops the loop', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const processMonitorFrameBlock = extractConstBlock(play, 'processMonitorFrame');
  const monitorEffectBlock = extractUseEffectBlock(play, 'monitor generation');

  assert.match(play, /stableStartedAtRef/);
  assert.match(processMonitorFrameBlock, /stableStartedAtRef\.current/);
  assert.doesNotMatch(processMonitorFrameBlock, /stableStartedAt \?\?/);
  assert.doesNotMatch(monitorEffectBlock, /stableStartedAt/);
  assert.match(play, /candidateOptions\.length === 0/);
  assert.match(play, /setDetectionState\('waiting_confirmation'\)/);
  assert.match(play, /setDetectionState\('waiting_throw'\)/);
});

test('camera COUNT-UP monitor shows explicit error codes and dev audit logs', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  for (const code of [
    'CAMERA_FRAME_UNAVAILABLE',
    'CAMERA_FRAME_REQUIRES_WEB_BASE64',
    'WEB_IMAGE_DECODE_FAILED',
    'CAPTURE_TIMEOUT',
    'CONCURRENT_CAPTURE_BLOCKED',
  ]) {
    assert.match(play, new RegExp(code));
  }
  assert.match(play, /<InfoRow label="エラー"/);
  assert.match(play, /\[camera-count-up-monitor\]/);
  assert.match(play, /monitor generation/);
  assert.match(play, /capture start/);
  assert.match(play, /capture end/);
  assert.match(play, /baseline retry/);
});

test('camera COUNT-UP baseline updates only after candidate confirmation', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');

  assert.match(play, /await adapter\.recordCandidate/);
  assert.match(play, /baselineFrameRef\.current = pendingThrownFrameRef\.current/);
  assert.match(play, /候補を拒否しました。基準画像は更新していません/);
  assert.match(play, /手動入力を保存しました。盤面とDBを合わせるため基準画像を再取得してください/);
  assert.match(play, /Undoしました。盤面とDBを合わせるため基準画像を再取得してください/);
  assert.match(play, /Redoしました。盤面とDBを合わせるため基準画像を再取得してください/);
});

test('camera COUNT-UP settings resolve active sessions from the screen', () => {
  const settings = readRepoFile('app/camera/local-count-up/settings.tsx');

  assert.match(settings, /services\.activeSession\.findActiveSession\(\)/);
  assert.match(settings, /buildCameraActiveSessionSummary/);
  assert.match(settings, /modeLabel: isCameraCountUp \? 'カメラCOUNT-UP' : 'COUNT-UP'/);
  assert.match(
    settings,
    /resumeRoute: isCameraCountUp \? `\/camera\/local-count-up\/\$\{game\.gameId\}` : session\.route/,
  );
  assert.match(settings, /modeLabel: '01 GAME'/);
  assert.match(settings, /modeLabel: 'STANDARD CRICKET'/);
  assert.match(settings, /modeLabel: 'MATCH'/);
  assert.match(settings, /進行中ゲームを再開/);
  assert.match(settings, /進行中ゲームを終了/);
  assert.match(settings, /ゲームハブを開く/);
  assert.match(settings, /router\.replace\('\/game'\)/);
});

test('camera COUNT-UP active session abort is confirmed and does not auto-delete DB rows', () => {
  const settings = readRepoFile('app/camera/local-count-up/settings.tsx');

  assert.match(settings, /<Modal/);
  assert.match(settings, /確定するまでDBのstatusは変更しません/);
  assert.match(
    settings,
    /await services\.activeSession\.abortActiveSession\(activeSessionSummary\.session\)/,
  );
  assert.match(settings, /setActiveSessionSummary\(null\)/);
  assert.doesNotMatch(settings, /DELETE FROM|deleteGame|removeGame/);
  assert.doesNotMatch(settings, /await startGame\(\)/);
});

test('camera COUNT-UP start remains available only after active session is cleared', () => {
  const settings = readRepoFile('app/camera/local-count-up/settings.tsx');

  assert.match(
    settings,
    /disabled=\{!isAvailable \|\| isStarting \|\| activeSessionSummary !== null\}/,
  );
  assert.match(settings, /setActiveSessionSummary\(null\)/);
  assert.match(settings, /COUNT-UP開始/);
});

function createCandidate() {
  return new DetectionEngine().createCandidate({
    sessionId: 'local-count-up',
    cameraNodeId: 'camera-pc',
    throwIndex: 1,
    segment: 20,
    multiplier: 3,
    confidence: 0.94,
    normalizedX: 0.5,
    normalizedY: 0.18,
    now: new Date('2026-07-16T00:00:00.000Z'),
    random: () => 0,
  });
}

function createPort(calls: string[]): CandidateRouterPort {
  return {
    sendToLanHost: () => calls.push('lan'),
    handoffToLocalGame: () => calls.push('local'),
    showPreview: () => calls.push('preview'),
  };
}

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function extractConstBlock(source: string, constName: string) {
  const index = source.indexOf(`const ${constName}`);
  assert.notEqual(index, -1, `missing const ${constName}`);
  const nextConst = source.indexOf('\n  const ', index + 1);
  return source.slice(index, nextConst === -1 ? source.length : nextConst);
}

function extractUseEffectBlock(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing marker ${marker}`);
  const start = source.lastIndexOf('useEffect(() =>', markerIndex);
  assert.notEqual(start, -1, `missing useEffect for ${marker}`);
  const end = source.indexOf('\n\n  const ', markerIndex);
  return source.slice(start, end === -1 ? source.length : end);
}

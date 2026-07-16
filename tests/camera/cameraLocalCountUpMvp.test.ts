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
  assert.match(play, /基準フレーム取得/);
  assert.match(play, /現在画像を解析/);
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

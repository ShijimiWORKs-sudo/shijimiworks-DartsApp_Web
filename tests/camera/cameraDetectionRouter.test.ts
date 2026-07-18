import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { CandidateRouter } from '../../features/camera/detection/application/CandidateRouter';
import { CandidateStore } from '../../features/camera/detection/application/CandidateStore';
import { CameraLocalGameAdapter } from '../../features/camera/detection/application/CameraLocalGameAdapter';
import { DetectionEngine } from '../../features/camera/detection/application/DetectionEngine';
import type { CandidateRouterPort } from '../../features/camera/detection/domain/types';

const root = process.cwd();

function createCandidate() {
  return new DetectionEngine().createCandidate({
    sessionId: 'local-preview-session',
    cameraNodeId: 'camera-node-1',
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

test('Detection Engine creates T20 candidates without LAN pairing state', () => {
  const candidate = createCandidate();

  assert.equal(candidate.type, 'detection_candidate');
  assert.equal(candidate.segment, 20);
  assert.equal(candidate.multiplier, 3);
  assert.equal(candidate.score, 60);
});

test('Candidate Router stores preview candidates while LAN is disconnected', () => {
  const store = new CandidateStore();
  const calls: string[] = [];
  const router = new CandidateRouter(store, createPort(calls));

  const result = router.route(createCandidate(), {
    operationMode: 'local_preview',
    authority: 'none',
    isLanConnected: false,
  });

  assert.equal(result.destination, 'preview');
  assert.equal(result.status, 'stored');
  assert.deepEqual(calls, ['preview']);
  assert.equal(store.list().length, 1);
});

test('Candidate Router does not fail paired_node candidates when LAN is disconnected', () => {
  const store = new CandidateStore();
  const calls: string[] = [];
  const router = new CandidateRouter(store, createPort(calls));

  const result = router.route(createCandidate(), {
    operationMode: 'paired_node',
    authority: 'game_pc',
    isLanConnected: false,
  });

  assert.equal(result.destination, 'lan_host');
  assert.equal(result.status, 'not_sent');
  assert.equal(result.reason, 'LAN_NOT_CONNECTED');
  assert.deepEqual(calls, []);
  assert.equal(store.list()[0].routeStatus, 'not_sent');
});

test('Candidate Router sends only current paired_node candidates when LAN is connected', () => {
  const store = new CandidateStore();
  const calls: string[] = [];
  const router = new CandidateRouter(store, createPort(calls));

  router.route(createCandidate(), {
    operationMode: 'paired_node',
    authority: 'game_pc',
    isLanConnected: false,
  });
  router.route(createCandidate(), {
    operationMode: 'paired_node',
    authority: 'game_pc',
    isLanConnected: true,
  });

  assert.deepEqual(calls, ['lan']);
  assert.equal(store.list().filter((entry) => entry.routeStatus === 'sent').length, 1);
  assert.equal(store.list().filter((entry) => entry.routeStatus === 'not_sent').length, 1);
});

test('Candidate Router blocks local_game confirmation while authority is changing', () => {
  const store = new CandidateStore();
  const calls: string[] = [];
  const router = new CandidateRouter(store, createPort(calls));

  const result = router.route(createCandidate(), {
    operationMode: 'local_game',
    authority: 'camera_pc',
    isLanConnected: false,
    isAuthorityChanging: true,
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'AUTHORITY_CHANGING');
  assert.deepEqual(calls, []);
});

test('CameraLocalGameAdapter reuses existing game services for confirmed camera darts', async () => {
  const calls: string[] = [];
  const adapter = new CameraLocalGameAdapter({
    countUp: {
      recordDart: async () => {
        calls.push('count_up');
        return {} as never;
      },
    },
    zeroOne: {
      recordDart: async () => {
        calls.push('zero_one');
        return {} as never;
      },
    },
    cricket: {
      recordDart: async () => {
        calls.push('cricket');
        return {} as never;
      },
    },
    match: {
      recordDart: async () => {
        calls.push('match');
        return {} as never;
      },
    },
  });
  const dart = new DetectionEngine().toCameraDartInput(createCandidate());

  await adapter.recordCandidate({ mode: 'count_up', gameId: 'game-1', dart });
  await adapter.recordCandidate({ mode: 'zero_one', gameId: 'game-2', dart });
  await adapter.recordCandidate({ mode: 'cricket', gameId: 'game-3', dart });
  await adapter.recordCandidate({ mode: 'match', gameId: 'match-1', dart });

  assert.deepEqual(calls, ['count_up', 'zero_one', 'cricket', 'match']);
});

test('Camera Node test candidates are no longer disabled by paired status', () => {
  const source = readFileSync(path.join(root, 'app/camera/node.tsx'), 'utf8');

  assert.doesNotMatch(source, /disabled=\{lanPeer\.status !== 'paired'\}/);
  assert.match(source, /LAN未接続でも候補生成と履歴確認/);
  assert.match(source, /candidateLog\.length > 0/);
});

function createPort(calls: string[]): CandidateRouterPort {
  return {
    sendToLanHost: () => calls.push('lan'),
    handoffToLocalGame: () => calls.push('local'),
    showPreview: () => calls.push('preview'),
  };
}

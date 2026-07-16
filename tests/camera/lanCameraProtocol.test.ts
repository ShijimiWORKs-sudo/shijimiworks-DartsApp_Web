import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LAN_CAMERA_HEARTBEAT_INTERVAL_MS,
  LAN_CAMERA_OFFLINE_TIMEOUT_MS,
  calculateReconnectDelay,
  createPairingCode,
  createTestDetectionCandidate,
  isHeartbeatTimedOut,
  isSixDigitPairingCode,
  markCandidateStatus,
  parseLanCameraMessage,
  serializeLanCameraMessage,
  upsertCandidateLog,
  type GameSetupRequest,
} from '../../features/camera/lan/domain/protocol';
import {
  canStartGameFromSetupMessage,
  createGameSetupRequest,
} from '../../features/camera/lan/application/gameSetupMessages';

test('LAN camera pairing code is always six digits', () => {
  assert.equal(
    createPairingCode(() => 0),
    '000000',
  );
  assert.equal(
    createPairingCode(() => 0.999999),
    '999999',
  );
  assert.equal(isSixDigitPairingCode('123456'), true);
  assert.equal(isSixDigitPairingCode('12345'), false);
  assert.equal(isSixDigitPairingCode('abcdef'), false);
});

test('heartbeat timeout follows the 5s heartbeat and 15s offline policy', () => {
  assert.equal(LAN_CAMERA_HEARTBEAT_INTERVAL_MS, 5000);
  assert.equal(LAN_CAMERA_OFFLINE_TIMEOUT_MS, 15000);
  assert.equal(
    isHeartbeatTimedOut('2026-07-16T00:00:00.000Z', new Date('2026-07-16T00:00:14.999Z')),
    false,
  );
  assert.equal(
    isHeartbeatTimedOut('2026-07-16T00:00:00.000Z', new Date('2026-07-16T00:00:15.001Z')),
    true,
  );
});

test('reconnect delay uses exponential backoff capped at 30 seconds', () => {
  assert.equal(calculateReconnectDelay(0), 1000);
  assert.equal(calculateReconnectDelay(1), 2000);
  assert.equal(calculateReconnectDelay(5), 30000);
  assert.equal(calculateReconnectDelay(99), 30000);
});

test('test detection candidate contains score, normalized coordinates, confidence, and camera_node source only', () => {
  const candidate = createTestDetectionCandidate({
    sessionId: 'session-1',
    cameraNodeId: 'node-1',
    throwIndex: 1,
    segment: 20,
    multiplier: 3,
    confidence: 0.94,
    normalizedX: 0.5,
    normalizedY: 0.2,
    now: new Date('2026-07-16T00:00:00.000Z'),
    random: () => 0,
  });

  assert.equal(candidate.type, 'test_detection_candidate');
  assert.equal(candidate.score, 60);
  assert.equal(candidate.source, 'camera_node');
  assert.equal(candidate.confidence, 0.94);
  assert.equal(candidate.normalizedX, 0.5);
  assert.equal(candidate.normalizedY, 0.2);
});

test('LAN camera messages serialize and parse with protocol fields', () => {
  const candidate = createTestDetectionCandidate({
    sessionId: 'session-1',
    cameraNodeId: 'node-1',
    throwIndex: 1,
    segment: 25,
    multiplier: 2,
    confidence: 0.96,
    normalizedX: 0.5,
    normalizedY: 0.5,
    now: new Date('2026-07-16T00:00:00.000Z'),
    random: () => 0,
  });

  const parsed = parseLanCameraMessage(serializeLanCameraMessage(candidate));
  assert.equal(parsed?.type, 'test_detection_candidate');
  assert.equal(parsed?.sessionId, 'session-1');
  assert.equal(parseLanCameraMessage('{broken'), null);
});

test('LAN camera protocol supports approved game setup request flow messages', () => {
  const request: GameSetupRequest = createGameSetupRequest({
    sessionId: 'session-1',
    cameraNodeId: 'node-1',
    requestId: 'setup-1',
    mode: 'count_up',
    settings: { bullRule: 'fat_bull' },
    now: new Date('2026-07-16T00:00:00.000Z'),
  });

  const parsed = parseLanCameraMessage(serializeLanCameraMessage(request));

  assert.equal(parsed?.type, 'game_setup_request');
  assert.equal(parsed && 'mode' in parsed ? parsed.mode : null, 'count_up');
  assert.equal(canStartGameFromSetupMessage('game_setup_request'), false);
  assert.equal(canStartGameFromSetupMessage('game_setup_accepted'), true);
  assert.equal(canStartGameFromSetupMessage('game_started'), true);
});

test('duplicate candidate ids are logged but not accepted twice', () => {
  const candidate = createTestDetectionCandidate({
    sessionId: 'session-1',
    cameraNodeId: 'node-1',
    throwIndex: 1,
    segment: 20,
    multiplier: 1,
    confidence: 0.9,
    normalizedX: 0.5,
    normalizedY: 0.2,
    now: new Date('2026-07-16T00:00:00.000Z'),
    random: () => 0,
  });
  const first = upsertCandidateLog([], candidate, '2026-07-16T00:00:01.000Z');
  const second = upsertCandidateLog(first.entries, candidate, '2026-07-16T00:00:02.000Z');

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.entries[0].status, 'duplicate');
});

test('candidate accept and reject update only pending candidate status', () => {
  const candidate = createTestDetectionCandidate({
    sessionId: 'session-1',
    cameraNodeId: 'node-1',
    throwIndex: 1,
    segment: 20,
    multiplier: 1,
    confidence: 0.9,
    normalizedX: 0.5,
    normalizedY: 0.2,
    now: new Date('2026-07-16T00:00:00.000Z'),
    random: () => 0,
  });
  const log = upsertCandidateLog([], candidate, '2026-07-16T00:00:01.000Z').entries;
  const accepted = markCandidateStatus(log, candidate.candidateId, 'accepted');
  const rejectedAfterAccepted = markCandidateStatus(accepted, candidate.candidateId, 'rejected');

  assert.equal(accepted[0].status, 'accepted');
  assert.equal(rejectedAfterAccepted[0].status, 'accepted');
});

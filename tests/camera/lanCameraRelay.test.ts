import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  PROTOCOL_VERSION,
  createRelayState,
  handlePairRequest,
  parseRelayArgs,
  routePeerMessage,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('../../scripts/start-lan-camera-relay.cjs');

class FakeSocket {
  OPEN = 1;
  readyState = 1;
  sent: unknown[] = [];
  closed = false;

  send(value: string) {
    this.sent.push(JSON.parse(value));
  }

  close() {
    this.closed = true;
    this.readyState = 3;
  }
}

test('relay arg parser defaults to 0.0.0.0:8120 and accepts custom port', () => {
  assert.deepEqual(parseRelayArgs([]), { host: '0.0.0.0', port: 8120 });
  assert.deepEqual(parseRelayArgs(['--host', '127.0.0.1', '--port', '8121']), {
    host: '127.0.0.1',
    port: 8121,
  });
});

test('pair request succeeds when code is valid and not expired', () => {
  const state = createRelayState(() => new Date('2026-07-16T00:00:00.000Z'));
  const host = new FakeSocket();
  const node = new FakeSocket();

  handlePairRequest(state, host, createHostPairRequest());
  handlePairRequest(state, node, createNodePairRequest());

  assert.equal((node.sent[0] as { type: string }).type, 'pair_accepted');
  assert.equal((host.sent[0] as { type: string }).type, 'pair_accepted');
  assert.equal((node.sent[0] as { sessionId: string }).sessionId, 'session-1');
});

test('pair request rejects invalid and expired pairing codes', () => {
  const invalidState = createRelayState(() => new Date('2026-07-16T00:00:00.000Z'));
  const invalidNode = new FakeSocket();
  handlePairRequest(invalidState, invalidNode, { ...createNodePairRequest(), pairingCode: 'abc' });
  assert.equal((invalidNode.sent[0] as { reason: string }).reason, 'INVALID_PAIRING_CODE');

  const expiredState = createRelayState(() => new Date('2026-07-16T00:03:00.000Z'));
  const host = new FakeSocket();
  const expiredNode = new FakeSocket();
  handlePairRequest(
    expiredState,
    host,
    createHostPairRequest({ expiresAt: '2026-07-16T00:01:00.000Z' }),
  );
  handlePairRequest(expiredState, expiredNode, createNodePairRequest());
  assert.equal((expiredNode.sent[0] as { reason: string }).reason, 'PAIRING_EXPIRED');
});

test('relay rejects protocolVersion mismatch', () => {
  const state = createRelayState(() => new Date('2026-07-16T00:00:00.000Z'));
  const node = new FakeSocket();
  handlePairRequest(state, node, { ...createNodePairRequest(), protocolVersion: 999 });
  assert.equal((node.sent[0] as { reason: string }).reason, 'PROTOCOL_VERSION_MISMATCH');
});

test('relay routes test detection candidate to host but does not auto-accept it', () => {
  const { state, host, node } = createPairedRelay();
  routePeerMessage(state, node, {
    type: 'test_detection_candidate',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sentAt: '2026-07-16T00:00:01.000Z',
    cameraNodeId: 'node-1',
    frameId: 'frame-1',
    throwIndex: 1,
    candidateId: 'candidate-1',
    segment: 20,
    multiplier: 3,
    score: 60,
    normalizedX: 0.5,
    normalizedY: 0.2,
    confidence: 0.94,
    capturedAt: '2026-07-16T00:00:01.000Z',
    processingMs: 12,
    source: 'camera_node',
  });

  assert.equal((host.sent[1] as { type: string }).type, 'test_detection_candidate');
  assert.notEqual((node.sent[1] as { type?: string } | undefined)?.type, 'detection_accepted');
});

test('relay forwards accept and reject responses back to the camera node', () => {
  const { state, host, node } = createPairedRelay();
  routePeerMessage(state, host, {
    type: 'detection_accepted',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sentAt: '2026-07-16T00:00:02.000Z',
    cameraNodeId: 'node-1',
    candidateId: 'candidate-1',
  });
  routePeerMessage(state, host, {
    type: 'detection_rejected',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sentAt: '2026-07-16T00:00:03.000Z',
    cameraNodeId: 'node-1',
    candidateId: 'candidate-2',
    reason: 'manual_correction',
  });

  assert.equal((node.sent[1] as { type: string }).type, 'detection_accepted');
  assert.equal((node.sent[2] as { type: string }).type, 'detection_rejected');
});

test('second camera node is not auto-selected', () => {
  const { state } = createPairedRelay();
  const secondNode = new FakeSocket();
  handlePairRequest(state, secondNode, { ...createNodePairRequest(), cameraNodeId: 'node-2' });

  assert.equal((secondNode.sent[0] as { reason: string }).reason, 'NODE_ALREADY_CONNECTED');
});

function createPairedRelay() {
  const state = createRelayState(() => new Date('2026-07-16T00:00:00.000Z'));
  const host = new FakeSocket();
  const node = new FakeSocket();
  handlePairRequest(state, host, createHostPairRequest());
  handlePairRequest(state, node, createNodePairRequest());
  return { state, host, node };
}

function createHostPairRequest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'pair_request',
    role: 'game_pc',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sentAt: '2026-07-16T00:00:00.000Z',
    pairingCode: '123456',
    expiresAt: '2026-07-16T00:02:00.000Z',
    ...overrides,
  };
}

function createNodePairRequest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'pair_request',
    role: 'camera_node',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'node-pairing',
    sentAt: '2026-07-16T00:00:00.000Z',
    pairingCode: '123456',
    cameraNodeId: 'node-1',
    cameraNodeName: 'Camera Node',
    ...overrides,
  };
}

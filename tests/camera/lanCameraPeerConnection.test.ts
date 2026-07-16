import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  getLanCameraConnectionFailureMessage,
  planLanCameraConnectionStart,
} from '../../features/camera/lan/ui/useLanCameraPeer';

test('LAN camera peer first click starts connecting even when enabled was initially false', () => {
  const plan = planLanCameraConnectionStart({
    socketReadyState: null,
    reconnectAttempt: 0,
  });

  assert.equal(plan.shouldCreateSocket, true);
  assert.equal(plan.status, 'connecting');
});

test('LAN camera peer creates only one WebSocket while the first connection is opening', () => {
  const firstPlan = planLanCameraConnectionStart({
    socketReadyState: null,
    reconnectAttempt: 0,
  });
  const secondPlan = planLanCameraConnectionStart({
    socketReadyState: 0,
    reconnectAttempt: 0,
  });

  assert.equal(firstPlan.shouldCreateSocket, true);
  assert.equal(secondPlan.shouldCreateSocket, false);
});

test('LAN camera peer repeated clicks do not duplicate an open WebSocket', () => {
  const plan = planLanCameraConnectionStart({
    socketReadyState: 1,
    reconnectAttempt: 0,
  });

  assert.equal(plan.shouldCreateSocket, false);
  assert.equal(plan.status, null);
});

test('LAN camera peer reports a user-facing error when WebSocket creation fails', () => {
  assert.equal(
    getLanCameraConnectionFailureMessage(),
    'LAN relayへ接続できませんでした。接続先を確認してください。',
  );
});

test('LAN camera peer can reconnect after disconnect clears the socket', () => {
  const plan = planLanCameraConnectionStart({
    socketReadyState: null,
    reconnectAttempt: 0,
  });

  assert.equal(plan.shouldCreateSocket, true);
  assert.equal(plan.status, 'connecting');
});

test('Camera Node connect button disables while connecting and keeps six digit pairing guard', () => {
  const source = readFileSync(path.join(process.cwd(), 'app/camera/node.tsx'), 'utf8');

  assert.match(
    source,
    /isConnectionStarting = status === 'connecting' \|\| status === 'reconnecting'/,
  );
  assert.match(source, /isConnectDisabled = pairingCode\.length !== 6 \|\| isConnectionStarting/);
  assert.match(source, /label=\{isConnectionStarting \? '接続中\.\.\.' : '接続'\}/);
});

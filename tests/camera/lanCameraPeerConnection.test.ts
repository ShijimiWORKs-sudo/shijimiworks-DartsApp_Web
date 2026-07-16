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
  assert.match(
    source,
    /isConnectDisabled = pairingCode\.length !== 6 \|\| isConnectionStarting \|\| status === 'paired'/,
  );
  assert.match(source, /label=\{isConnectionStarting \? '接続中\.\.\.' : '接続'\}/);
});

test('Game PC LAN screen starts waiting with one click and disables while connecting', () => {
  const source = readFileSync(path.join(process.cwd(), 'app/camera/lan.tsx'), 'utf8');

  assert.match(source, /const startWaiting = \(\) => \{\s+setEnabled\(true\);\s+connectPeer\(\);/);
  assert.match(
    source,
    /isConnectionActive =\s+isConnectionStarting \|\| peer\.status === 'waiting' \|\| peer\.status === 'paired'/,
  );
  assert.match(source, /label=\{isConnectionStarting \? '接続待受中\.\.\.' : '接続待受開始'\}/);
  assert.match(source, /disabled=\{isConnectionActive\}/);
});

test('Game PC code update closes the old socket and reconnects once when already enabled', () => {
  const source = readFileSync(path.join(process.cwd(), 'app/camera/lan.tsx'), 'utf8');

  assert.match(source, /const shouldReconnect = enabled;/);
  assert.match(source, /peer\.disconnect\(\);/);
  assert.match(source, /setConnectAfterCodeUpdate\(\(current\) => current \+ 1\);/);
  assert.match(source, /useEffect\(\(\) => \{\s+if \(connectAfterCodeUpdate === 0\)/);
  assert.match(source, /connectPeer\(\);/);
  assert.match(source, /setConnectAfterCodeUpdate\(0\);/);
});

test('LAN camera peer clears reconnect timers before manual connect and before scheduling reconnect', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'features/camera/lan/ui/useLanCameraPeer.ts'),
    'utf8',
  );

  assert.match(source, /const clearReconnectTimer = useCallback/);
  assert.match(source, /shouldReconnectRef\.current = true;\s+clearReconnectTimer\(\);/);
  assert.match(source, /clearReconnectTimer\(\);\s+reconnectTimerRef\.current = setTimeout/);
});

test('LAN camera peer ignores stale socket callbacks after code update or reconnect', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'features/camera/lan/ui/useLanCameraPeer.ts'),
    'utf8',
  );

  assert.match(source, /const isCurrentSocket = \(\) => socketRef\.current === socket;/);
  assert.match(source, /socket\.onclose = \(\) => \{\s+if \(!isCurrentSocket\(\)\)/);
  assert.match(source, /socket\.onopen = \(\) => \{\s+if \(!isCurrentSocket\(\)\)/);
});

test('LAN screens always render status and lastError rows', () => {
  const nodeSource = readFileSync(path.join(process.cwd(), 'app/camera/node.tsx'), 'utf8');
  const lanSource = readFileSync(path.join(process.cwd(), 'app/camera/lan.tsx'), 'utf8');

  assert.match(nodeSource, /<InfoRow label="接続状態" value=\{lanPeer\.status\} \/>/);
  assert.match(nodeSource, /<InfoRow label="lastError" value=\{lanPeer\.lastError \?\? '-'\} \/>/);
  assert.match(lanSource, /<InfoRow label="状態" value=\{peer\.status\} \/>/);
  assert.match(lanSource, /<InfoRow label="lastError" value=\{peer\.lastError \?\? '-'\} \/>/);
});

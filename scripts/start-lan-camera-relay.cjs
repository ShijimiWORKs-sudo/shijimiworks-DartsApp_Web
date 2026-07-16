const { WebSocketServer } = require('ws');

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 8120;
const PROTOCOL_VERSION = 1;
const PAIRING_TTL_MS = 2 * 60 * 1000;
const HEARTBEAT_TIMEOUT_MS = 15000;
const ROUTED_MESSAGE_TYPES = new Set([
  'heartbeat',
  'camera_capabilities',
  'camera_ready',
  'start_detection',
  'stop_detection',
  'reset_baseline',
  'test_detection_candidate',
  'detection_candidate',
  'detection_accepted',
  'detection_rejected',
]);

function parseRelayArgs(argv = process.argv.slice(2)) {
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--host') {
      host = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      port = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
      continue;
    }
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid relay port: ${port}`);
  }

  return { host, port };
}

function createRelayState(now = () => new Date()) {
  return {
    hostsByCode: new Map(),
    peers: new WeakMap(),
    now,
  };
}

function parseMessage(raw) {
  try {
    const message = JSON.parse(String(raw));
    return isLanCameraMessage(message) ? message : null;
  } catch {
    return null;
  }
}

function isLanCameraMessage(message) {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    typeof message.protocolVersion === 'number' &&
    typeof message.sessionId === 'string' &&
    typeof message.sentAt === 'string'
  );
}

function sendJson(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function rejectPair(socket, request, reason, message) {
  sendJson(socket, {
    type: 'pair_rejected',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: request?.sessionId ?? 'unknown',
    sentAt: new Date().toISOString(),
    reason,
    message,
  });
}

function createError(sessionId, code, message) {
  return {
    type: 'error',
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sentAt: new Date().toISOString(),
    code,
    message,
  };
}

function handlePairRequest(state, socket, request) {
  if (request.protocolVersion !== PROTOCOL_VERSION) {
    rejectPair(
      socket,
      request,
      'PROTOCOL_VERSION_MISMATCH',
      `Relay protocol is v${PROTOCOL_VERSION}.`,
    );
    return;
  }

  if (!/^\d{6}$/.test(request.pairingCode)) {
    rejectPair(socket, request, 'INVALID_PAIRING_CODE', 'Pairing code must be 6 digits.');
    return;
  }

  if (request.role === 'game_pc') {
    const expiresAt =
      request.expiresAt ?? new Date(state.now().getTime() + PAIRING_TTL_MS).toISOString();
    state.hostsByCode.set(request.pairingCode, {
      socket,
      sessionId: request.sessionId,
      pairingCode: request.pairingCode,
      expiresAt,
      nodeSocket: null,
      nodeId: null,
      nodeName: null,
      lastHeartbeatAt: state.now().toISOString(),
    });
    state.peers.set(socket, {
      role: 'game_pc',
      sessionId: request.sessionId,
      pairingCode: request.pairingCode,
    });
    return;
  }

  if (request.role !== 'camera_node') {
    rejectPair(socket, request, 'INVALID_MESSAGE', 'Unknown pairing role.');
    return;
  }

  const host = state.hostsByCode.get(request.pairingCode);
  if (!host) {
    rejectPair(socket, request, 'SESSION_NOT_FOUND', 'Pairing code was not found.');
    return;
  }

  if (Date.parse(host.expiresAt) <= state.now().getTime()) {
    rejectPair(socket, request, 'PAIRING_EXPIRED', 'Pairing code has expired.');
    return;
  }

  if (host.nodeSocket) {
    rejectPair(socket, request, 'NODE_ALREADY_CONNECTED', 'A camera node is already paired.');
    return;
  }

  const cameraNodeId = request.cameraNodeId ?? `camera-node-${Date.now().toString(36)}`;
  const cameraNodeName = request.cameraNodeName ?? 'Camera Node';
  host.nodeSocket = socket;
  host.nodeId = cameraNodeId;
  host.nodeName = cameraNodeName;
  host.lastHeartbeatAt = state.now().toISOString();
  state.peers.set(socket, {
    role: 'camera_node',
    sessionId: host.sessionId,
    pairingCode: request.pairingCode,
    cameraNodeId,
    cameraNodeName,
  });

  const accepted = {
    type: 'pair_accepted',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: host.sessionId,
    sentAt: state.now().toISOString(),
    cameraNodeId,
    cameraNodeName,
    pairedAt: state.now().toISOString(),
  };
  sendJson(socket, accepted);
  sendJson(host.socket, accepted);
}

function findHostForPeer(state, peer) {
  return peer?.pairingCode ? state.hostsByCode.get(peer.pairingCode) : null;
}

function routePeerMessage(state, socket, message) {
  const peer = state.peers.get(socket);
  const host = findHostForPeer(state, peer);

  if (!peer || !host) {
    sendJson(socket, createError(message.sessionId, 'UNAUTHORIZED_NODE', 'Pairing is required.'));
    return;
  }

  if (message.protocolVersion !== PROTOCOL_VERSION) {
    sendJson(
      socket,
      createError(
        message.sessionId,
        'PROTOCOL_VERSION_MISMATCH',
        `Relay protocol is v${PROTOCOL_VERSION}.`,
      ),
    );
    return;
  }

  if (message.sessionId !== host.sessionId) {
    sendJson(socket, createError(message.sessionId, 'SESSION_MISMATCH', 'Session id mismatch.'));
    return;
  }

  if (!ROUTED_MESSAGE_TYPES.has(message.type)) {
    sendJson(
      socket,
      createError(message.sessionId, 'INVALID_MESSAGE', 'Unsupported message type.'),
    );
    return;
  }

  host.lastHeartbeatAt = state.now().toISOString();

  if (peer.role === 'game_pc' && host.nodeSocket) {
    sendJson(host.nodeSocket, message);
    return;
  }

  if (peer.role === 'camera_node') {
    if (socket !== host.nodeSocket) {
      sendJson(
        socket,
        createError(message.sessionId, 'UNAUTHORIZED_NODE', 'Camera node is not active.'),
      );
      return;
    }
    sendJson(host.socket, message);
  }
}

function removeSocket(state, socket) {
  const peer = state.peers.get(socket);
  const host = findHostForPeer(state, peer);

  if (!peer || !host) {
    return;
  }

  if (peer.role === 'game_pc') {
    if (host.nodeSocket) {
      sendJson(
        host.nodeSocket,
        createError(host.sessionId, 'HOST_DISCONNECTED', 'Game PC disconnected.'),
      );
    }
    state.hostsByCode.delete(host.pairingCode);
    return;
  }

  if (peer.role === 'camera_node' && host.nodeSocket === socket) {
    host.nodeSocket = null;
    host.nodeId = null;
    host.nodeName = null;
    sendJson(
      host.socket,
      createError(host.sessionId, 'NODE_DISCONNECTED', 'Camera Node disconnected.'),
    );
  }
}

function startRelay(argv = process.argv.slice(2)) {
  const { host, port } = parseRelayArgs(argv);
  const state = createRelayState();
  const server = new WebSocketServer({ host, port });

  server.on('connection', (socket) => {
    socket.on('message', (raw) => {
      const message = parseMessage(raw);
      if (!message) {
        sendJson(
          socket,
          createError('unknown', 'INVALID_JSON', 'Message must be valid LAN camera JSON.'),
        );
        return;
      }

      if (message.type === 'pair_request') {
        handlePairRequest(state, socket, message);
        return;
      }

      routePeerMessage(state, socket, message);
    });

    socket.on('close', () => removeSocket(state, socket));
  });

  const timeout = setInterval(() => {
    const now = state.now();
    for (const hostSession of state.hostsByCode.values()) {
      if (now.getTime() - Date.parse(hostSession.lastHeartbeatAt) > HEARTBEAT_TIMEOUT_MS) {
        if (hostSession.nodeSocket) {
          sendJson(
            hostSession.socket,
            createError(
              hostSession.sessionId,
              'HEARTBEAT_TIMEOUT',
              'Camera Node heartbeat timed out.',
            ),
          );
          hostSession.nodeSocket.close();
          hostSession.nodeSocket = null;
          hostSession.nodeId = null;
          hostSession.nodeName = null;
        }
      }
    }
  }, 5000);

  server.on('close', () => clearInterval(timeout));

  console.log(`DartsApp LAN Camera Relay listening on ws://${host}:${port}`);
  console.log(
    'Allow Windows Firewall only on private networks. Do not expose this relay to the internet.',
  );

  return { server, state };
}

if (require.main === module) {
  startRelay();
}

module.exports = {
  PROTOCOL_VERSION,
  createRelayState,
  handlePairRequest,
  parseRelayArgs,
  parseMessage,
  routePeerMessage,
  startRelay,
};

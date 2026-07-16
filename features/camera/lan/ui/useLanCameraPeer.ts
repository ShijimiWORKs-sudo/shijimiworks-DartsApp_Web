import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  LAN_CAMERA_HEARTBEAT_INTERVAL_MS,
  LAN_CAMERA_PROTOCOL_VERSION,
  calculateReconnectDelay,
  createCameraNodeId,
  createTestDetectionCandidate,
  isDetectionCandidateMessage,
  isHeartbeatTimedOut,
  isSupportedProtocolVersion,
  markCandidateStatus,
  parseLanCameraMessage,
  serializeLanCameraMessage,
  upsertCandidateLog,
  validateDetectionCandidate,
  type CameraReady,
  type DetectionAccepted,
  type DetectionRejected,
  type ErrorMessage,
  type Heartbeat,
  type LanCameraCandidateLogEntry,
  type LanCameraDetectionState,
  type LanCameraMessage,
  type LanCameraPeerRole,
  type LanCameraPeerStatus,
  type LanCameraSegment,
  type PairAccepted,
  type PairRejected,
  type PairRequest,
} from '../domain/protocol';

type LanCameraPeerOptions = {
  role: LanCameraPeerRole;
  relayUrl: string;
  sessionId: string;
  pairingCode: string;
  pairingExpiresAt?: string;
  cameraNodeName?: string;
  enabled: boolean;
};

export type LanCameraPeerState = {
  status: LanCameraPeerStatus;
  detectionState: LanCameraDetectionState;
  cameraNodeId: string;
  pairedNodeName: string | null;
  pairedAt: string | null;
  connectedAt: string | null;
  lastHeartbeatAt: string | null;
  latencyMs: number | null;
  lastError: string | null;
  candidateLog: LanCameraCandidateLogEntry[];
  sentCandidateCount: number;
  protocolMismatch: boolean;
  connect: () => void;
  disconnect: () => void;
  sendCameraReady: (isReady: boolean) => void;
  sendTestCandidate: (input: {
    segment: LanCameraSegment;
    multiplier: 0 | 1 | 2 | 3;
    confidence: number;
    normalizedX: number;
    normalizedY: number;
  }) => void;
  acceptCandidate: (candidateId: string) => void;
  rejectCandidate: (candidateId: string, reason?: string) => void;
};

const LAN_CAMERA_SOCKET_CONNECTING = 0;
const LAN_CAMERA_SOCKET_OPEN = 1;

export type LanCameraConnectionStartPlan = {
  shouldCreateSocket: boolean;
  status: Extract<LanCameraPeerStatus, 'connecting' | 'reconnecting'> | null;
};

export function isLanCameraSocketStartingOrOpen(readyState: number | null | undefined): boolean {
  return readyState === LAN_CAMERA_SOCKET_CONNECTING || readyState === LAN_CAMERA_SOCKET_OPEN;
}

export function planLanCameraConnectionStart(input: {
  socketReadyState: number | null | undefined;
  reconnectAttempt: number;
}): LanCameraConnectionStartPlan {
  if (isLanCameraSocketStartingOrOpen(input.socketReadyState)) {
    return {
      shouldCreateSocket: false,
      status: null,
    };
  }

  return {
    shouldCreateSocket: true,
    status: input.reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
  };
}

export function getLanCameraConnectionFailureMessage(): string {
  return 'LAN relayへ接続できませんでした。接続先を確認してください。';
}

export function useLanCameraPeer(options: LanCameraPeerOptions): LanCameraPeerState {
  const [status, setStatus] = useState<LanCameraPeerStatus>('idle');
  const [detectionState, setDetectionState] = useState<LanCameraDetectionState>('stopped');
  const [cameraNodeId] = useState(() => createCameraNodeId());
  const [pairedNodeName, setPairedNodeName] = useState<string | null>(null);
  const [pairedAt, setPairedAt] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [candidateLog, setCandidateLog] = useState<LanCameraCandidateLogEntry[]>([]);
  const [sentCandidateCount, setSentCandidateCount] = useState(0);
  const [protocolMismatch, setProtocolMismatch] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReconnectRef = useRef(false);
  const pairedRef = useRef(false);
  const activeSessionIdRef = useRef(options.sessionId);

  const pairRequest = useMemo<PairRequest>(
    () => ({
      type: 'pair_request',
      protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
      sessionId: activeSessionIdRef.current,
      sentAt: new Date().toISOString(),
      role: options.role,
      pairingCode: options.pairingCode,
      cameraNodeId: options.role === 'camera_node' ? cameraNodeId : undefined,
      cameraNodeName: options.role === 'camera_node' ? options.cameraNodeName : undefined,
      expiresAt: options.role === 'game_pc' ? options.pairingExpiresAt : undefined,
    }),
    [
      cameraNodeId,
      options.cameraNodeName,
      options.pairingCode,
      options.pairingExpiresAt,
      options.role,
    ],
  );

  const sendMessage = useCallback((message: LanCameraMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(serializeLanCameraMessage(message));
    }
  }, []);

  const sendHeartbeat = useCallback(() => {
    const heartbeat: Heartbeat = {
      type: 'heartbeat',
      protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
      sessionId: activeSessionIdRef.current,
      sentAt: new Date().toISOString(),
      role: options.role,
      cameraNodeId: options.role === 'camera_node' ? cameraNodeId : undefined,
      latencyMs: latencyMs ?? undefined,
    };
    sendMessage(heartbeat);
  }, [cameraNodeId, latencyMs, options.role, sendMessage]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearReconnectTimer();
    clearHeartbeatTimer();
  }, [clearHeartbeatTimer, clearReconnectTimer]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    reconnectAttemptRef.current = 0;
    clearTimers();
    socketRef.current?.close();
    socketRef.current = null;
    pairedRef.current = false;
    setStatus('idle');
    setDetectionState('stopped');
  }, [clearTimers]);

  const handleMessage = useCallback((message: LanCameraMessage) => {
    if (!isSupportedProtocolVersion(message.protocolVersion)) {
      setProtocolMismatch(true);
      setLastError('Relayと画面のprotocolVersionが一致しません。');
      return;
    }

    if (message.type !== 'pair_accepted' && message.sessionId !== activeSessionIdRef.current) {
      setLastError('sessionIdが一致しないメッセージを拒否しました。');
      return;
    }

    if (message.type === 'pair_accepted') {
      const accepted = message as PairAccepted;
      activeSessionIdRef.current = accepted.sessionId;
      pairedRef.current = true;
      setStatus('paired');
      setPairedNodeName(accepted.cameraNodeName);
      setPairedAt(accepted.pairedAt);
      setLastError(null);
      return;
    }

    if (message.type === 'pair_rejected') {
      const rejected = message as PairRejected;
      setStatus('rejected');
      setLastError(rejected.message);
      return;
    }

    if (message.type === 'heartbeat') {
      const heartbeat = message as Heartbeat;
      setLastHeartbeatAt(heartbeat.sentAt);
      if (heartbeat.latencyMs != null) {
        setLatencyMs(heartbeat.latencyMs);
      }
      return;
    }

    if (message.type === 'start_detection') {
      setDetectionState('running');
      return;
    }

    if (message.type === 'stop_detection') {
      setDetectionState('stopped');
      return;
    }

    if (isDetectionCandidateMessage(message)) {
      if (!validateDetectionCandidate(message)) {
        setLastError('不正な候補値を拒否しました。');
        return;
      }

      setCandidateLog(
        (current) => upsertCandidateLog(current, message, new Date().toISOString()).entries,
      );
      return;
    }

    if (message.type === 'detection_accepted') {
      const accepted = message as DetectionAccepted;
      setCandidateLog((current) => markCandidateStatus(current, accepted.candidateId, 'accepted'));
      return;
    }

    if (message.type === 'detection_rejected') {
      const rejected = message as DetectionRejected;
      setCandidateLog((current) => markCandidateStatus(current, rejected.candidateId, 'rejected'));
      return;
    }

    if (message.type === 'error') {
      const error = message as ErrorMessage;
      setLastError(error.message);
      if (error.code === 'HEARTBEAT_TIMEOUT' || error.code === 'NODE_DISCONNECTED') {
        setStatus('offline');
      }
    }
  }, []);

  const connect = useCallback(() => {
    const startPlan = planLanCameraConnectionStart({
      socketReadyState: socketRef.current?.readyState,
      reconnectAttempt: reconnectAttemptRef.current,
    });

    if (!startPlan.shouldCreateSocket) {
      return;
    }

    shouldReconnectRef.current = true;
    clearReconnectTimer();
    if (startPlan.status) {
      setStatus(startPlan.status);
    }
    setLastError(null);
    const openedAt = Date.now();
    let socket: WebSocket;
    try {
      socket = new WebSocket(options.relayUrl);
    } catch (error) {
      console.warn('LAN camera WebSocket creation failed.', error);
      shouldReconnectRef.current = false;
      setStatus('error');
      setLastError(getLanCameraConnectionFailureMessage());
      return;
    }
    socketRef.current = socket;
    const isCurrentSocket = () => socketRef.current === socket;

    socket.onopen = () => {
      if (!isCurrentSocket()) {
        return;
      }
      reconnectAttemptRef.current = 0;
      setConnectedAt(new Date().toISOString());
      setStatus(options.role === 'game_pc' ? 'waiting' : 'connecting');
      setLatencyMs(Date.now() - openedAt);
      socket.send(serializeLanCameraMessage({ ...pairRequest, sentAt: new Date().toISOString() }));
      heartbeatTimerRef.current = setInterval(sendHeartbeat, LAN_CAMERA_HEARTBEAT_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      if (!isCurrentSocket()) {
        return;
      }
      const message = parseLanCameraMessage(String(event.data));
      if (!message) {
        setLastError('不正なLAN camera messageを受信しました。');
        return;
      }
      handleMessage(message);
    };

    socket.onerror = () => {
      if (!isCurrentSocket()) {
        return;
      }
      setLastError(getLanCameraConnectionFailureMessage());
      setStatus('error');
    };

    socket.onclose = () => {
      if (!isCurrentSocket()) {
        return;
      }
      socketRef.current = null;
      clearHeartbeatTimer();
      pairedRef.current = false;
      setDetectionState('stopped');
      if (!shouldReconnectRef.current) {
        return;
      }
      const delay = calculateReconnectDelay(reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      setStatus('reconnecting');
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [
    clearHeartbeatTimer,
    clearReconnectTimer,
    handleMessage,
    options.relayUrl,
    options.role,
    pairRequest,
    sendHeartbeat,
  ]);

  const sendCameraReady = useCallback(
    (isReady: boolean) => {
      const message: CameraReady = {
        type: 'camera_ready',
        protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
        sessionId: activeSessionIdRef.current,
        sentAt: new Date().toISOString(),
        cameraNodeId,
        isReady,
      };
      sendMessage(message);
    },
    [cameraNodeId, sendMessage],
  );

  const sendTestCandidate: LanCameraPeerState['sendTestCandidate'] = useCallback(
    (input) => {
      const candidate = createTestDetectionCandidate({
        sessionId: activeSessionIdRef.current,
        cameraNodeId,
        throwIndex: candidateLog.length + 1,
        ...input,
      });
      sendMessage(candidate);
      setCandidateLog(
        (current) => upsertCandidateLog(current, candidate, new Date().toISOString()).entries,
      );
      setSentCandidateCount((current) => current + 1);
    },
    [cameraNodeId, candidateLog.length, sendMessage],
  );

  const acceptCandidate = useCallback(
    (candidateId: string) => {
      const message: DetectionAccepted = {
        type: 'detection_accepted',
        protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
        sessionId: activeSessionIdRef.current,
        sentAt: new Date().toISOString(),
        cameraNodeId,
        candidateId,
      };
      sendMessage(message);
      setCandidateLog((current) => markCandidateStatus(current, candidateId, 'accepted'));
    },
    [cameraNodeId, sendMessage],
  );

  const rejectCandidate = useCallback(
    (candidateId: string, reason?: string) => {
      const message: DetectionRejected = {
        type: 'detection_rejected',
        protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
        sessionId: activeSessionIdRef.current,
        sentAt: new Date().toISOString(),
        cameraNodeId,
        candidateId,
        reason,
      };
      sendMessage(message);
      setCandidateLog((current) => markCandidateStatus(current, candidateId, 'rejected'));
    },
    [cameraNodeId, sendMessage],
  );

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (isHeartbeatTimedOut(lastHeartbeatAt)) {
      setStatus('offline');
    }
  }, [lastHeartbeatAt]);

  return {
    status,
    detectionState,
    cameraNodeId,
    pairedNodeName,
    pairedAt,
    connectedAt,
    lastHeartbeatAt,
    latencyMs,
    lastError,
    candidateLog,
    sentCandidateCount,
    protocolMismatch,
    connect,
    disconnect,
    sendCameraReady,
    sendTestCandidate,
    acceptCandidate,
    rejectCandidate,
  };
}

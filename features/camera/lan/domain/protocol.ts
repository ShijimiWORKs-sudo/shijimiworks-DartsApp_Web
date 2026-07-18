export const LAN_CAMERA_PROTOCOL_VERSION = 1;
export const LAN_CAMERA_RELAY_PORT = 8120;
export const LAN_CAMERA_HEARTBEAT_INTERVAL_MS = 5000;
export const LAN_CAMERA_OFFLINE_TIMEOUT_MS = 15000;
export const LAN_CAMERA_PAIRING_TTL_MS = 2 * 60 * 1000;
export const LAN_CAMERA_RECONNECT_MAX_DELAY_MS = 30000;

export type LanCameraPeerRole = 'game_pc' | 'camera_node';
export type LanCameraPeerStatus =
  'idle' | 'connecting' | 'waiting' | 'paired' | 'offline' | 'reconnecting' | 'rejected' | 'error';
export type LanCameraDetectionState = 'stopped' | 'running';
export type LanCameraSegment =
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 25;
export type LanCameraMultiplier = 0 | 1 | 2 | 3;
export type LanCameraCandidateSource = 'camera_node';
export type LanCameraGameSetupMode = 'count_up' | 'zero_one' | 'cricket' | 'match';
export type LanCameraRejectionReason =
  | 'INVALID_JSON'
  | 'INVALID_MESSAGE'
  | 'INVALID_PAIRING_CODE'
  | 'PAIRING_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_MISMATCH'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'NODE_ALREADY_CONNECTED'
  | 'UNAUTHORIZED_NODE';

export type LanCameraBaseMessage = {
  protocolVersion: number;
  sessionId: string;
  sentAt: string;
};

export type PairRequest = LanCameraBaseMessage & {
  type: 'pair_request';
  role: LanCameraPeerRole;
  pairingCode: string;
  cameraNodeId?: string;
  cameraNodeName?: string;
  expiresAt?: string;
};

export type PairAccepted = LanCameraBaseMessage & {
  type: 'pair_accepted';
  cameraNodeId: string;
  cameraNodeName: string;
  pairedAt: string;
};

export type PairRejected = LanCameraBaseMessage & {
  type: 'pair_rejected';
  reason: LanCameraRejectionReason;
  message: string;
};

export type Heartbeat = LanCameraBaseMessage & {
  type: 'heartbeat';
  role: LanCameraPeerRole;
  cameraNodeId?: string;
  latencyMs?: number;
};

export type CameraCapabilities = LanCameraBaseMessage & {
  type: 'camera_capabilities';
  cameraNodeId: string;
  cameraNodeName: string;
  supportsStillCapture: boolean;
  supportsVideo: false;
  supportsImageRecognition: false;
};

export type CameraReady = LanCameraBaseMessage & {
  type: 'camera_ready';
  cameraNodeId: string;
  isReady: boolean;
};

export type StartDetection = LanCameraBaseMessage & {
  type: 'start_detection';
  throwIndex: number;
};

export type StopDetection = LanCameraBaseMessage & {
  type: 'stop_detection';
  reason?: string;
};

export type ResetBaseline = LanCameraBaseMessage & {
  type: 'reset_baseline';
};

export type TestDetectionCandidate = LanCameraBaseMessage & {
  type: 'test_detection_candidate';
  cameraNodeId: string;
  frameId: string;
  throwIndex: number;
  candidateId: string;
  segment: LanCameraSegment;
  multiplier: LanCameraMultiplier;
  score: number;
  normalizedX: number;
  normalizedY: number;
  confidence: number;
  capturedAt: string;
  processingMs: number;
  source: LanCameraCandidateSource;
};

export type DetectionCandidate = Omit<TestDetectionCandidate, 'type'> & {
  type: 'detection_candidate';
  baselineFrameId?: string;
  changedPixelRatio?: number;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  componentBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  fittedAxis?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null;
  tipCandidates?: {
    x: number;
    y: number;
    score: number;
    reason: string;
  }[];
  tipEvaluationDiagnostics?: {
    x: number;
    y: number;
    score: number;
    insideBoard: boolean;
    insideDoubleOuter: boolean;
    edgeSharpness: number;
    directionScore: number;
    stabilityScore: number;
    shadowDirectionPenalty: number;
    reason: string;
  }[];
  highResolutionRoi?: {
    x: number;
    y: number;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  };
  narrowCoreBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  rejectedShadowComponents?: {
    boundingBox: { x: number; y: number; width: number; height: number };
    shadowLikelihood: number;
    rejectionReason: string;
  }[];
  scoreDiagnostics?: {
    normalizedX: number;
    normalizedY: number;
    boardRadius: number;
    boardAngleDeg: number;
    segmentIndex: number | null;
    segmentNumber: number | null;
    area: string;
    multiplier: number;
    score: number;
    withinDoubleOuter: boolean;
    calibrationProfileId?: string;
    rotationDeg?: number;
    distanceToSegmentBoundaryDeg?: number | null;
  };
  componentDiagnostics?: {
    area: number;
    width: number;
    height: number;
    aspectRatio: number;
    majorAxisLength: number;
    minorAxisLength: number;
    elongation: number;
    centroid: { x: number; y: number };
    maxDelta: number;
    averageDelta: number;
    persistenceCount: number;
    boardOverlapRatio: number;
    averageWidth: number;
    maxWidth?: number;
    widthVariance: number;
    edgeSharpness: number;
    edgeDensity: number;
    averageGradient?: number;
    maxGradient?: number;
    localContrast: number;
    gradientMagnitude: number;
    brightnessVariance?: number;
    solidity: number;
    compactness: number;
    interiorBrightnessVariance: number;
    boundaryBlur: number;
    darkeningPolarity: number;
    skeletonLength: number;
    skeletonBranchCount: number;
    skeletonEndpointCount?: number;
    dartLikelihood: number;
    shadowLikelihood: number;
    rejectionReason: string | null;
    tipSelectionReason: string;
  };
  reason?: string;
  alternateCandidateIds?: string[];
  calibrationProfileId?: string;
  algorithmVersion?: string;
};

export type DetectionAccepted = LanCameraBaseMessage & {
  type: 'detection_accepted';
  cameraNodeId: string;
  candidateId: string;
};

export type DetectionRejected = LanCameraBaseMessage & {
  type: 'detection_rejected';
  cameraNodeId: string;
  candidateId: string;
  reason?: string;
};

export type ErrorMessage = LanCameraBaseMessage & {
  type: 'error';
  code: string;
  message: string;
};

export type GameSetupRequest = LanCameraBaseMessage & {
  type: 'game_setup_request';
  cameraNodeId: string;
  requestId: string;
  mode: LanCameraGameSetupMode;
  settings: Record<string, unknown>;
};

export type GameSetupAccepted = LanCameraBaseMessage & {
  type: 'game_setup_accepted';
  requestId: string;
  acceptedAt: string;
};

export type GameSetupRejected = LanCameraBaseMessage & {
  type: 'game_setup_rejected';
  requestId: string;
  reason: string;
};

export type GameStarted = LanCameraBaseMessage & {
  type: 'game_started';
  requestId: string;
  gameId: string;
  mode: LanCameraGameSetupMode;
  authority: 'game_pc';
};

export type GameStateSnapshot = LanCameraBaseMessage & {
  type: 'game_state_snapshot';
  gameId: string;
  mode: LanCameraGameSetupMode;
  status: string;
  payload: Record<string, unknown>;
};

export type GameEnded = LanCameraBaseMessage & {
  type: 'game_ended';
  gameId: string;
  mode: LanCameraGameSetupMode;
  reason: string;
};

export type LanCameraMessage =
  | PairRequest
  | PairAccepted
  | PairRejected
  | Heartbeat
  | CameraCapabilities
  | CameraReady
  | StartDetection
  | StopDetection
  | ResetBaseline
  | TestDetectionCandidate
  | DetectionCandidate
  | DetectionAccepted
  | DetectionRejected
  | ErrorMessage
  | GameSetupRequest
  | GameSetupAccepted
  | GameSetupRejected
  | GameStarted
  | GameStateSnapshot
  | GameEnded;

export type LanCameraCandidateLogEntry = {
  candidate: TestDetectionCandidate | DetectionCandidate;
  status: 'pending' | 'accepted' | 'rejected' | 'duplicate';
  receivedAt: string;
};

export function createPairingCode(random = Math.random) {
  return String(Math.floor(random() * 1_000_000)).padStart(6, '0');
}

export function createLanCameraSessionId(now = new Date(), random = Math.random) {
  const suffix = Math.floor(random() * 1_000_000_000).toString(36);
  return `lan-camera-${now.getTime().toString(36)}-${suffix}`;
}

export function createCameraNodeId(now = new Date(), random = Math.random) {
  const suffix = Math.floor(random() * 1_000_000_000).toString(36);
  return `camera-node-${now.getTime().toString(36)}-${suffix}`;
}

export function createPairingExpiry(now = new Date()) {
  return new Date(now.getTime() + LAN_CAMERA_PAIRING_TTL_MS).toISOString();
}

export function isPairingExpired(expiresAt: string, now = new Date()) {
  return Date.parse(expiresAt) <= now.getTime();
}

export function isHeartbeatTimedOut(lastHeartbeatAt: string | null, now = new Date()) {
  if (!lastHeartbeatAt) {
    return false;
  }

  return now.getTime() - Date.parse(lastHeartbeatAt) > LAN_CAMERA_OFFLINE_TIMEOUT_MS;
}

export function calculateReconnectDelay(attempt: number) {
  const safeAttempt = Math.max(0, attempt);
  return Math.min(1000 * 2 ** safeAttempt, LAN_CAMERA_RECONNECT_MAX_DELAY_MS);
}

export function isSupportedProtocolVersion(protocolVersion: number) {
  return protocolVersion === LAN_CAMERA_PROTOCOL_VERSION;
}

export function isSixDigitPairingCode(pairingCode: string) {
  return /^\d{6}$/.test(pairingCode);
}

export function serializeLanCameraMessage(message: LanCameraMessage) {
  return JSON.stringify(message);
}

export function parseLanCameraMessage(value: string): LanCameraMessage | null {
  try {
    const parsed = JSON.parse(value) as Partial<LanCameraMessage>;
    return isLanCameraMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isLanCameraMessage(value: unknown): value is LanCameraMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<LanCameraMessage>;
  return (
    typeof message.type === 'string' &&
    typeof message.protocolVersion === 'number' &&
    typeof message.sessionId === 'string' &&
    typeof message.sentAt === 'string'
  );
}

export function isDetectionCandidateMessage(
  message: LanCameraMessage,
): message is TestDetectionCandidate | DetectionCandidate {
  return message.type === 'test_detection_candidate' || message.type === 'detection_candidate';
}

export function validateDetectionCandidate(candidate: TestDetectionCandidate | DetectionCandidate) {
  return (
    candidate.source === 'camera_node' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    candidate.normalizedX >= 0 &&
    candidate.normalizedX <= 1 &&
    candidate.normalizedY >= 0 &&
    candidate.normalizedY <= 1 &&
    candidate.score >= 0 &&
    candidate.processingMs >= 0
  );
}

export function upsertCandidateLog(
  entries: LanCameraCandidateLogEntry[],
  candidate: TestDetectionCandidate | DetectionCandidate,
  receivedAt: string,
) {
  if (entries.some((entry) => entry.candidate.candidateId === candidate.candidateId)) {
    return {
      entries: [
        {
          candidate,
          receivedAt,
          status: 'duplicate' as const,
        },
        ...entries,
      ],
      accepted: false,
    };
  }

  return {
    entries: [
      {
        candidate,
        receivedAt,
        status: 'pending' as const,
      },
      ...entries,
    ],
    accepted: true,
  };
}

export function markCandidateStatus(
  entries: LanCameraCandidateLogEntry[],
  candidateId: string,
  status: 'accepted' | 'rejected',
) {
  return entries.map((entry) =>
    entry.candidate.candidateId === candidateId && entry.status === 'pending'
      ? { ...entry, status }
      : entry,
  );
}

export function createTestDetectionCandidate(input: {
  sessionId: string;
  cameraNodeId: string;
  throwIndex: number;
  segment: LanCameraSegment;
  multiplier: LanCameraMultiplier;
  confidence: number;
  normalizedX: number;
  normalizedY: number;
  now?: Date;
  random?: () => number;
}): TestDetectionCandidate {
  const now = input.now ?? new Date();
  const random = input.random ?? Math.random;
  return {
    type: 'test_detection_candidate',
    protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
    sessionId: input.sessionId,
    sentAt: now.toISOString(),
    cameraNodeId: input.cameraNodeId,
    frameId: `test-frame-${now.getTime().toString(36)}`,
    throwIndex: input.throwIndex,
    candidateId: `test-candidate-${now.getTime().toString(36)}-${Math.floor(random() * 1_000_000).toString(36)}`,
    segment: input.segment,
    multiplier: input.multiplier,
    score: input.segment === 25 && input.multiplier === 2 ? 50 : input.segment * input.multiplier,
    normalizedX: input.normalizedX,
    normalizedY: input.normalizedY,
    confidence: input.confidence,
    capturedAt: now.toISOString(),
    processingMs: 12,
    source: 'camera_node',
  };
}

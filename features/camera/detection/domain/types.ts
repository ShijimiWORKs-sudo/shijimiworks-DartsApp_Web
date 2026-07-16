import type { DartArea, InputSource } from '../../../game/domain/types';
import type {
  DetectionCandidate,
  LanCameraMultiplier,
  LanCameraSegment,
  TestDetectionCandidate,
} from '../../lan/domain/protocol';

export type CameraOperationMode = 'local_preview' | 'local_game' | 'local_count_up' | 'paired_node';

export type GameAuthority = 'camera_pc' | 'game_pc' | 'none';

export type CandidateDestination = 'preview' | 'local_game' | 'lan_host';

export type DartInputSource = 'manual' | 'camera_confirmed' | 'camera_corrected';

export type CameraDetectionCandidate = TestDetectionCandidate | DetectionCandidate;

export type CandidateRouteStatus = 'stored' | 'sent' | 'not_sent' | 'blocked';

export type CandidateRouteResult = {
  destination: CandidateDestination;
  status: CandidateRouteStatus;
  reason: string | null;
  candidateId: string;
};

export type CandidateHistoryEntry = {
  candidate: CameraDetectionCandidate;
  destination: CandidateDestination;
  routeStatus: CandidateRouteStatus;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

export type CandidateRouterContext = {
  operationMode: CameraOperationMode;
  authority: GameAuthority;
  isLanConnected: boolean;
  isAuthorityChanging?: boolean;
};

export type CandidateRouterPort = {
  sendToLanHost: (candidate: CameraDetectionCandidate) => void;
  handoffToLocalGame: (candidate: CameraDetectionCandidate) => void;
  showPreview: (candidate: CameraDetectionCandidate) => void;
};

export type CameraDartInput = {
  area: DartArea;
  segmentNumber: number | null;
  inputSource: InputSource;
  candidateId: string;
  confidence: number;
  normalizedX: number;
  normalizedY: number;
  clientActionId: string;
};

export type DetectionCandidateInput = {
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
};

import type { DetectionCandidate } from '../../lan/domain/protocol';

export type MultiCameraObservation = {
  cameraId: string;
  capturedAt: string;
  candidate: DetectionCandidate | null;
  confidence: number;
};

export type MultiCameraFusionResult = {
  selected: DetectionCandidate | null;
  observations: MultiCameraObservation[];
  method: 'single_camera' | 'weighted_consensus';
};

export interface MultiCameraFusionPort {
  fuse(observations: MultiCameraObservation[]): MultiCameraFusionResult;
}

export class SingleCameraFusionAdapter implements MultiCameraFusionPort {
  fuse(observations: MultiCameraObservation[]): MultiCameraFusionResult {
    const selected =
      observations
        .filter((observation) => observation.candidate)
        .sort((a, b) => b.confidence - a.confidence)[0]?.candidate ?? null;
    return {
      selected,
      observations,
      method: 'single_camera',
    };
  }
}

export const multiCameraFeatureFlags = {
  enabled: false,
} as const;

import {
  LAN_CAMERA_PROTOCOL_VERSION,
  createTestDetectionCandidate,
  type DetectionCandidate,
} from '../../lan/domain/protocol';
import type { CameraDartInput, DetectionCandidateInput } from '../domain/types';

export class DetectionEngine {
  createCandidate(input: DetectionCandidateInput): DetectionCandidate {
    const testCandidate = createTestDetectionCandidate(input);

    return {
      ...testCandidate,
      type: 'detection_candidate',
      protocolVersion: LAN_CAMERA_PROTOCOL_VERSION,
    };
  }

  toCameraDartInput(candidate: DetectionCandidate): CameraDartInput {
    return {
      area: toDartArea(candidate.segment, candidate.multiplier),
      segmentNumber:
        candidate.segment === 25 || candidate.multiplier === 0 ? null : candidate.segment,
      inputSource: 'photo_detected',
      candidateId: candidate.candidateId,
      confidence: candidate.confidence,
      normalizedX: candidate.normalizedX,
      normalizedY: candidate.normalizedY,
      clientActionId: `camera:${candidate.candidateId}`,
    };
  }
}

export function toDartArea(segment: number, multiplier: number): CameraDartInput['area'] {
  if (multiplier === 0) {
    return 'miss';
  }
  if (segment === 25) {
    return multiplier === 2 ? 'inner_bull' : 'outer_bull';
  }
  if (multiplier === 3) {
    return 'triple';
  }
  if (multiplier === 2) {
    return 'double';
  }
  return 'single';
}

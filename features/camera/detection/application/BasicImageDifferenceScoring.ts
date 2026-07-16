import { DetectionEngine } from './DetectionEngine';
import type { SimpleBoardCalibration } from './SimpleBoardCalibration';
import { scoreNormalizedPoint } from './SimpleBoardCalibration';
import type { DetectionCandidate } from '../../lan/domain/protocol';

export type GrayscaleFrame = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray | number[];
};

export type BasicImageDifferenceInput = {
  sessionId: string;
  cameraNodeId: string;
  throwIndex: number;
  baselineFrame: GrayscaleFrame;
  thrownFrame: GrayscaleFrame;
  calibration: SimpleBoardCalibration;
  threshold?: number;
  now?: Date;
};

export type BasicImageDifferenceResult =
  | {
      status: 'candidate';
      candidate: DetectionCandidate;
      processingMs: number;
    }
  | {
      status: 'no_candidate';
      reason: 'FRAME_SIZE_MISMATCH' | 'NO_SIGNIFICANT_CHANGE';
      processingMs: number;
    };

export function analyzeImageDifference(
  input: BasicImageDifferenceInput,
): BasicImageDifferenceResult {
  const startedAt = Date.now();
  if (
    input.baselineFrame.width !== input.thrownFrame.width ||
    input.baselineFrame.height !== input.thrownFrame.height ||
    input.baselineFrame.pixels.length !== input.thrownFrame.pixels.length
  ) {
    return {
      status: 'no_candidate',
      reason: 'FRAME_SIZE_MISMATCH',
      processingMs: Date.now() - startedAt,
    };
  }

  const threshold = input.threshold ?? 38;
  let strongestIndex = -1;
  let strongestDelta = 0;
  const length = input.baselineFrame.pixels.length;

  for (let index = 0; index < length; index += 1) {
    const delta = Math.abs(input.thrownFrame.pixels[index] - input.baselineFrame.pixels[index]);
    if (delta > strongestDelta) {
      strongestDelta = delta;
      strongestIndex = index;
    }
  }

  if (strongestIndex < 0 || strongestDelta < threshold) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const x = (strongestIndex % input.thrownFrame.width) / Math.max(input.thrownFrame.width - 1, 1);
  const y =
    Math.floor(strongestIndex / input.thrownFrame.width) /
    Math.max(input.thrownFrame.height - 1, 1);
  const score = scoreNormalizedPoint({ x, y }, input.calibration);
  const candidate = new DetectionEngine().createCandidate({
    sessionId: input.sessionId,
    cameraNodeId: input.cameraNodeId,
    throwIndex: input.throwIndex,
    segment: score.segment,
    multiplier: score.multiplier,
    confidence: Math.min(0.98, Math.max(score.confidence, strongestDelta / 255)),
    normalizedX: score.normalizedX,
    normalizedY: score.normalizedY,
    now: input.now,
  });

  return {
    status: 'candidate',
    candidate,
    processingMs: Date.now() - startedAt,
  };
}

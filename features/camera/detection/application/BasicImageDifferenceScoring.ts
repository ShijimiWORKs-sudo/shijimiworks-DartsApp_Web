import { DetectionEngine } from './DetectionEngine';
import type { BoardCalibrationProfile } from '../../calibration/domain/types';
import { scoreCanonicalPointInViewport } from '../../calibration/domain/coordinateTransform';
import type { SimpleBoardCalibration } from './SimpleBoardCalibration';
import { scoreNormalizedPoint } from './SimpleBoardCalibration';
import type { DetectionCandidate, LanCameraSegment } from '../../lan/domain/protocol';

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
  calibration: SimpleBoardCalibration | BoardCalibrationProfile;
  threshold?: number;
  now?: Date;
  random?: () => number;
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
  const score = scorePointWithCalibration({ x, y }, input.calibration, {
    containerWidth: input.thrownFrame.width,
    containerHeight: input.thrownFrame.height,
  });
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
    random: input.random,
  });

  return {
    status: 'candidate',
    candidate,
    processingMs: Date.now() - startedAt,
  };
}

export function createReplayDifferenceFrames(input: {
  width?: number;
  height?: number;
  changedX: number;
  changedY: number;
  intensity?: number;
}): { baselineFrame: GrayscaleFrame; thrownFrame: GrayscaleFrame } {
  const width = input.width ?? 64;
  const height = input.height ?? 64;
  const baselineFrame = {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height),
  };
  const thrownFrame = {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height),
  };
  const x = Math.round(Math.min(1, Math.max(0, input.changedX)) * (width - 1));
  const y = Math.round(Math.min(1, Math.max(0, input.changedY)) * (height - 1));
  thrownFrame.pixels[y * width + x] = input.intensity ?? 255;
  return { baselineFrame, thrownFrame };
}

function scorePointWithCalibration(
  point: { x: number; y: number },
  calibration: SimpleBoardCalibration | BoardCalibrationProfile,
  dimensions: { containerWidth: number; containerHeight: number },
) {
  if ('version' in calibration && calibration.version === 2) {
    const score = scoreCanonicalPointInViewport(point, calibration, dimensions);
    return {
      segment: (score.segmentNumber ?? 25) as LanCameraSegment,
      multiplier: score.multiplier,
      normalizedX: score.normalizedX,
      normalizedY: score.normalizedY,
      confidence: 0.82,
    };
  }
  return scoreNormalizedPoint(point, calibration);
}

import { DetectionEngine } from './DetectionEngine';
import type { BoardCalibrationProfile } from '../../calibration/domain/types';
import { scoreCanonicalPointInViewport } from '../../calibration/domain/coordinateTransform';
import type { SimpleBoardCalibration } from './SimpleBoardCalibration';
import { scoreNormalizedPoint } from './SimpleBoardCalibration';
import type { DetectionCandidate, LanCameraSegment } from '../../lan/domain/protocol';

export type GrayscaleFrame = {
  frameId?: string;
  width: number;
  height: number;
  pixels: Uint8Array | Uint8ClampedArray | number[];
  capturedAt?: string;
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
      alternateCandidates: DetectionCandidate[];
      changedPixelRatio: number;
      boundingBox: { x: number; y: number; width: number; height: number } | null;
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
  const strongest = createStrongestAccumulator();
  const length = input.baselineFrame.pixels.length;
  let changedPixelCount = 0;
  let minX = input.thrownFrame.width;
  let minY = input.thrownFrame.height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < length; index += 1) {
    const delta = Math.abs(input.thrownFrame.pixels[index] - input.baselineFrame.pixels[index]);
    if (delta >= threshold) {
      changedPixelCount += 1;
      const x = index % input.thrownFrame.width;
      const y = Math.floor(index / input.thrownFrame.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      addStrongCandidate(strongest, { index, delta, x, y }, input.thrownFrame.width);
    }
  }

  if (strongest.length === 0) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const boundingBox =
    changedPixelCount === 0
      ? null
      : {
          x: minX / input.thrownFrame.width,
          y: minY / input.thrownFrame.height,
          width: (maxX - minX + 1) / input.thrownFrame.width,
          height: (maxY - minY + 1) / input.thrownFrame.height,
        };
  const changedPixelRatio = changedPixelCount / length;
  const candidateInputs = strongest.map((entry, offset) =>
    createCandidateFromStrongestEntry(input, entry, offset),
  );
  const [candidate, ...alternateCandidates] = enrichCandidates(candidateInputs, input, {
    changedPixelRatio,
    boundingBox,
  });

  return {
    status: 'candidate',
    candidate,
    alternateCandidates,
    changedPixelRatio,
    boundingBox,
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

type StrongestEntry = {
  index: number;
  delta: number;
  x: number;
  y: number;
};

function createStrongestAccumulator(): StrongestEntry[] {
  return [];
}

function addStrongCandidate(entries: StrongestEntry[], candidate: StrongestEntry, width: number) {
  if (
    entries.some(
      (entry) => Math.abs(entry.x - candidate.x) + Math.abs(entry.y - candidate.y) < width * 0.08,
    )
  ) {
    return;
  }

  entries.push(candidate);
  entries.sort((a, b) => b.delta - a.delta);
  if (entries.length > 3) {
    entries.length = 3;
  }
}

function createCandidateFromStrongestEntry(
  input: BasicImageDifferenceInput,
  entry: StrongestEntry,
  offset: number,
): DetectionCandidate {
  const x = entry.x / Math.max(input.thrownFrame.width - 1, 1);
  const y = entry.y / Math.max(input.thrownFrame.height - 1, 1);
  const score = scorePointWithCalibration({ x, y }, input.calibration, {
    containerWidth: input.thrownFrame.width,
    containerHeight: input.thrownFrame.height,
  });
  return new DetectionEngine().createCandidate({
    sessionId: input.sessionId,
    cameraNodeId: input.cameraNodeId,
    throwIndex: input.throwIndex,
    segment: score.segment,
    multiplier: score.multiplier,
    confidence: Math.min(0.98, Math.max(score.confidence - offset * 0.08, entry.delta / 255)),
    normalizedX: score.normalizedX,
    normalizedY: score.normalizedY,
    now: input.now,
    random: input.random,
  });
}

function enrichCandidates(
  candidates: DetectionCandidate[],
  input: BasicImageDifferenceInput,
  metadata: {
    changedPixelRatio: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
  },
): DetectionCandidate[] {
  const candidateIds = candidates.map((candidate) => candidate.candidateId);
  const calibrationProfileId =
    'profileId' in input.calibration ? input.calibration.profileId : undefined;

  return candidates.map((candidate) => ({
    ...candidate,
    frameId: input.thrownFrame.frameId ?? candidate.frameId,
    capturedAt: input.thrownFrame.capturedAt ?? candidate.capturedAt,
    baselineFrameId: input.baselineFrame.frameId,
    changedPixelRatio: metadata.changedPixelRatio,
    boundingBox: metadata.boundingBox,
    reason: 'REAL_FRAME_DIFF',
    alternateCandidateIds: candidateIds.filter(
      (candidateId) => candidateId !== candidate.candidateId,
    ),
    calibrationProfileId,
    algorithmVersion: 'basic-image-difference-v1',
  }));
}

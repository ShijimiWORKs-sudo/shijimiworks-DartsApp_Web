import { getCalibrationViewportTransform } from '../../calibration/domain/coordinateTransform';
import type { BoardCalibrationProfile } from '../../calibration/domain/types';

export type CameraAnalysisFrame = {
  frameId: string;
  width: number;
  height: number;
  grayPixels: Uint8Array;
  capturedAt: string;
  sourceKind?: string;
  mimeType?: string;
  capturedWidth?: number;
  capturedHeight?: number;
  analysisWidth?: number;
  analysisHeight?: number;
  uriPrefixKind?: string;
  base64Kind?: string;
  decodeStatus?: 'success';
  sourceFrame?: CameraAnalysisFrame;
};

export type CameraFrameSource = {
  captureFrame(options?: { maxSize?: number }): Promise<CameraAnalysisFrame>;
};

export type DetectionState =
  | 'disabled'
  | 'camera_not_ready'
  | 'baseline_capturing'
  | 'waiting_throw'
  | 'motion_detected'
  | 'waiting_stable'
  | 'analyzing'
  | 'candidate_ready'
  | 'waiting_confirmation'
  | 'baseline_updating'
  | 'paused'
  | 'error';

export type MotionAnalysis = {
  changedPixelRatio: number;
  changedPixelCount: number;
  motionScore: number;
  maxDelta: number;
  largestComponentPixels: number;
  hasPersistentChange: boolean;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  reason: 'idle' | 'motion' | 'stable' | 'obstruction' | 'frame_size_mismatch';
};

export type BaselineNoiseProfile = {
  baselineNoiseRatio: number;
  baselineNoisePixelCount: number;
  pixelDeltaP95: number;
  brightnessVariance: number;
  baselineQuality: 'good' | 'unstable';
  measuredPixelThreshold: number;
};

export const throwDetectionThresholds = {
  temporalMotionStartRatio: 0.01,
  temporalStableRatio: 0.003,
  persistentChangeMinRatio: 0.0003,
  persistentChangeMinPixels: 4,
  persistentComponentMinPixels: 3,
  obstructionRatio: 0.25,
  stableDurationMs: 650,
  frameIntervalMs: 180,
  pixelThreshold: 28,
  baselineSampleCount: 5,
  baselineWarmupCount: 2,
  baselineFrameIntervalMs: 250,
  baselineMaxRetryCount: 3,
  baselineNoiseMaxRatio: 0.025,
  baselineBrightnessVarianceMax: 450,
  baselineNoiseThresholdMargin: 14,
  monitorMaxSize: 160,
  analysisMaxSize: 320,
  persistentRoiRadiusMultiplier: 1.1,
} as const;

export function analyzeFrameMotion(input: {
  baselineFrame: CameraAnalysisFrame;
  currentFrame: CameraAnalysisFrame;
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
}): MotionAnalysis {
  return analyzeTemporalMotion({
    previousFrame: input.baselineFrame,
    currentFrame: input.currentFrame,
    calibration: input.calibration,
    pixelThreshold: input.pixelThreshold,
  });
}

export function analyzeTemporalMotion(input: {
  previousFrame: CameraAnalysisFrame;
  currentFrame: CameraAnalysisFrame;
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
}): MotionAnalysis {
  const analysis = analyzeFrameDifference({
    referenceFrame: input.previousFrame,
    currentFrame: input.currentFrame,
    calibration: input.calibration,
    pixelThreshold: input.pixelThreshold,
    roiRadiusMultiplier: 1,
  });
  if (analysis.reason === 'frame_size_mismatch') {
    return analysis;
  }

  return {
    ...analysis,
    reason:
      analysis.changedPixelRatio >= throwDetectionThresholds.obstructionRatio
        ? 'obstruction'
        : analysis.changedPixelRatio >= throwDetectionThresholds.temporalMotionStartRatio
          ? 'motion'
          : analysis.changedPixelRatio <= throwDetectionThresholds.temporalStableRatio
            ? 'stable'
            : 'idle',
  };
}

export function analyzePersistentBoardDifference(input: {
  baselineFrame: CameraAnalysisFrame;
  currentFrame: CameraAnalysisFrame;
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
  baselineNoise?: BaselineNoiseProfile | null;
  roiRadiusMultiplier?: number;
}): MotionAnalysis {
  const pixelThreshold =
    input.pixelThreshold ??
    (input.baselineNoise
      ? Math.max(
          throwDetectionThresholds.pixelThreshold,
          input.baselineNoise.measuredPixelThreshold,
        )
      : throwDetectionThresholds.pixelThreshold);
  const analysis = analyzeFrameDifference({
    referenceFrame: input.baselineFrame,
    currentFrame: input.currentFrame,
    calibration: input.calibration,
    pixelThreshold,
    roiRadiusMultiplier:
      input.roiRadiusMultiplier ?? throwDetectionThresholds.persistentRoiRadiusMultiplier,
  });
  if (analysis.reason === 'frame_size_mismatch') {
    return analysis;
  }

  const hasPersistentChange =
    analysis.changedPixelCount >= throwDetectionThresholds.persistentChangeMinPixels &&
    (analysis.changedPixelRatio >= throwDetectionThresholds.persistentChangeMinRatio ||
      analysis.largestComponentPixels >= throwDetectionThresholds.persistentComponentMinPixels ||
      analysis.maxDelta >= pixelThreshold);

  return {
    ...analysis,
    hasPersistentChange,
    reason: hasPersistentChange ? 'motion' : 'stable',
  };
}

export function createMedianBaselineFrame(
  frames: CameraAnalysisFrame[],
  input?: { frameId?: string; capturedAt?: string },
): CameraAnalysisFrame {
  if (frames.length === 0) {
    throw new Error('BASELINE_FRAME_SERIES_EMPTY');
  }

  const [first] = frames;
  if (
    frames.some(
      (frame) =>
        frame.width !== first.width ||
        frame.height !== first.height ||
        frame.grayPixels.length !== first.grayPixels.length,
    )
  ) {
    throw new Error('BASELINE_FRAME_SIZE_MISMATCH');
  }

  const grayPixels = new Uint8Array(first.grayPixels.length);
  const samples = new Array<number>(frames.length);
  for (let index = 0; index < grayPixels.length; index += 1) {
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      samples[frameIndex] = frames[frameIndex].grayPixels[index];
    }
    samples.sort((a, b) => a - b);
    grayPixels[index] = samples[Math.floor(samples.length / 2)];
  }

  return {
    ...first,
    frameId: input?.frameId ?? `median-${first.frameId}`,
    capturedAt: input?.capturedAt ?? first.capturedAt,
    grayPixels,
  };
}

export function measureBaselineNoise(input: {
  frames: CameraAnalysisFrame[];
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
}): BaselineNoiseProfile {
  if (input.frames.length < 2) {
    return {
      baselineNoiseRatio: 1,
      baselineNoisePixelCount: 0,
      pixelDeltaP95: 255,
      brightnessVariance: 0,
      baselineQuality: 'unstable',
      measuredPixelThreshold: 255,
    };
  }

  const pixelThreshold = input.pixelThreshold ?? throwDetectionThresholds.pixelThreshold;
  const ratios: number[] = [];
  const changedPixels: number[] = [];
  const deltas: number[] = [];
  const brightnessMeans: number[] = [];

  for (const frame of input.frames) {
    brightnessMeans.push(getMeanBrightness(frame));
  }

  for (let index = 1; index < input.frames.length; index += 1) {
    const previous = input.frames[index - 1];
    const current = input.frames[index];
    const difference = analyzeFrameDifference({
      referenceFrame: previous,
      currentFrame: current,
      calibration: input.calibration,
      pixelThreshold,
      roiRadiusMultiplier: 1,
    });
    ratios.push(difference.changedPixelRatio);
    changedPixels.push(difference.changedPixelCount);
    collectFrameDeltas(previous, current, deltas);
  }

  deltas.sort((a, b) => a - b);
  const baselineNoiseRatio = average(ratios);
  const baselineNoisePixelCount = Math.round(average(changedPixels));
  const pixelDeltaP95 = percentile(deltas, 0.95);
  const brightnessVariance = variance(brightnessMeans);
  const measuredPixelThreshold = Math.max(
    pixelThreshold,
    Math.ceil(pixelDeltaP95 + throwDetectionThresholds.baselineNoiseThresholdMargin),
  );
  const baselineQuality =
    baselineNoiseRatio <= throwDetectionThresholds.baselineNoiseMaxRatio &&
    brightnessVariance <= throwDetectionThresholds.baselineBrightnessVarianceMax
      ? 'good'
      : 'unstable';

  return {
    baselineNoiseRatio,
    baselineNoisePixelCount,
    pixelDeltaP95,
    brightnessVariance,
    baselineQuality,
    measuredPixelThreshold,
  };
}

export function resizeAnalysisFrame(
  frame: CameraAnalysisFrame,
  maxSize: number,
): CameraAnalysisFrame {
  const scale = Math.min(1, maxSize / Math.max(frame.width, frame.height));
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  if (width === frame.width && height === frame.height) {
    return frame;
  }

  const grayPixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(frame.height - 1, Math.floor(y / scale));
      grayPixels[y * width + x] = frame.grayPixels[sourceY * frame.width + sourceX];
    }
  }

  return {
    ...frame,
    width,
    height,
    grayPixels,
    analysisWidth: width,
    analysisHeight: height,
  };
}

function analyzeFrameDifference(input: {
  referenceFrame: CameraAnalysisFrame;
  currentFrame: CameraAnalysisFrame;
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
  roiRadiusMultiplier: number;
}): MotionAnalysis {
  const { referenceFrame, currentFrame, calibration } = input;
  if (
    referenceFrame.width !== currentFrame.width ||
    referenceFrame.height !== currentFrame.height ||
    referenceFrame.grayPixels.length !== currentFrame.grayPixels.length
  ) {
    return {
      changedPixelRatio: 0,
      changedPixelCount: 0,
      motionScore: 0,
      maxDelta: 0,
      largestComponentPixels: 0,
      hasPersistentChange: false,
      boundingBox: null,
      reason: 'frame_size_mismatch',
    };
  }

  const transform = getCalibrationViewportTransform({
    containerWidth: currentFrame.width,
    containerHeight: currentFrame.height,
    profile: calibration,
  });
  const threshold = input.pixelThreshold ?? throwDetectionThresholds.pixelThreshold;
  let changedPixelCount = 0;
  let boardPixelCount = 0;
  let motionScore = 0;
  let maxDelta = 0;
  let minX = currentFrame.width;
  let minY = currentFrame.height;
  let maxX = -1;
  let maxY = -1;
  const changedMask = new Uint8Array(currentFrame.grayPixels.length);

  for (let index = 0; index < currentFrame.grayPixels.length; index += 1) {
    const x = index % currentFrame.width;
    const y = Math.floor(index / currentFrame.width);
    const board = transform.screenToBoard({ x, y });
    if (board.radius > input.roiRadiusMultiplier) {
      continue;
    }

    boardPixelCount += 1;
    const delta = Math.abs(currentFrame.grayPixels[index] - referenceFrame.grayPixels[index]);
    if (delta >= threshold) {
      changedPixelCount += 1;
      motionScore += delta;
      maxDelta = Math.max(maxDelta, delta);
      changedMask[index] = 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const changedPixelRatio = boardPixelCount === 0 ? 0 : changedPixelCount / boardPixelCount;
  const largestComponentPixels = getLargestComponentPixels(changedMask, currentFrame.width);
  const boundingBox =
    changedPixelCount === 0
      ? null
      : {
          x: minX / currentFrame.width,
          y: minY / currentFrame.height,
          width: (maxX - minX + 1) / currentFrame.width,
          height: (maxY - minY + 1) / currentFrame.height,
        };

  return {
    changedPixelRatio,
    changedPixelCount,
    motionScore,
    maxDelta,
    largestComponentPixels,
    hasPersistentChange: false,
    boundingBox,
    reason: 'idle',
  };
}

function getLargestComponentPixels(mask: Uint8Array, width: number) {
  const visited = new Uint8Array(mask.length);
  let largest = 0;

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    let size = 0;
    const queue = [index];
    visited[index] = 1;
    while (queue.length > 0) {
      const current = queue.pop() ?? 0;
      size += 1;
      const x = current % width;
      for (const next of [current - 1, current + 1, current - width, current + width]) {
        if (
          next < 0 ||
          next >= mask.length ||
          visited[next] ||
          !mask[next] ||
          (next === current - 1 && x === 0) ||
          (next === current + 1 && x === width - 1)
        ) {
          continue;
        }
        visited[next] = 1;
        queue.push(next);
      }
    }
    largest = Math.max(largest, size);
  }

  return largest;
}

function collectFrameDeltas(
  referenceFrame: CameraAnalysisFrame,
  currentFrame: CameraAnalysisFrame,
  output: number[],
) {
  const length = Math.min(referenceFrame.grayPixels.length, currentFrame.grayPixels.length);
  for (let index = 0; index < length; index += 1) {
    output.push(Math.abs(currentFrame.grayPixels[index] - referenceFrame.grayPixels[index]));
  }
}

function getMeanBrightness(frame: CameraAnalysisFrame) {
  if (frame.grayPixels.length === 0) {
    return 0;
  }

  let total = 0;
  for (const value of frame.grayPixels) {
    total += value;
  }
  return total / frame.grayPixels.length;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function variance(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)));
  return values[index];
}

export function toGrayscaleFrame(frame: CameraAnalysisFrame) {
  return {
    frameId: frame.frameId,
    width: frame.width,
    height: frame.height,
    pixels: frame.grayPixels,
    capturedAt: frame.capturedAt,
  };
}

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
};

export type CameraFrameSource = {
  captureFrame(): Promise<CameraAnalysisFrame>;
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
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  reason: 'idle' | 'motion' | 'stable' | 'obstruction' | 'frame_size_mismatch';
};

export const throwDetectionThresholds = {
  motionStartRatio: 0.015,
  stableRatio: 0.004,
  obstructionRatio: 0.25,
  stableDurationMs: 650,
  frameIntervalMs: 180,
  pixelThreshold: 28,
} as const;

export function analyzeFrameMotion(input: {
  baselineFrame: CameraAnalysisFrame;
  currentFrame: CameraAnalysisFrame;
  calibration: BoardCalibrationProfile;
  pixelThreshold?: number;
}): MotionAnalysis {
  const { baselineFrame, currentFrame, calibration } = input;
  if (
    baselineFrame.width !== currentFrame.width ||
    baselineFrame.height !== currentFrame.height ||
    baselineFrame.grayPixels.length !== currentFrame.grayPixels.length
  ) {
    return {
      changedPixelRatio: 0,
      changedPixelCount: 0,
      motionScore: 0,
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
  let minX = currentFrame.width;
  let minY = currentFrame.height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < currentFrame.grayPixels.length; index += 1) {
    const x = index % currentFrame.width;
    const y = Math.floor(index / currentFrame.width);
    const board = transform.screenToBoard({ x, y });
    if (board.radius > 1) {
      continue;
    }

    boardPixelCount += 1;
    const delta = Math.abs(currentFrame.grayPixels[index] - baselineFrame.grayPixels[index]);
    if (delta >= threshold) {
      changedPixelCount += 1;
      motionScore += delta;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const changedPixelRatio = boardPixelCount === 0 ? 0 : changedPixelCount / boardPixelCount;
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
    boundingBox,
    reason:
      changedPixelRatio >= throwDetectionThresholds.obstructionRatio
        ? 'obstruction'
        : changedPixelRatio >= throwDetectionThresholds.motionStartRatio
          ? 'motion'
          : changedPixelRatio <= throwDetectionThresholds.stableRatio
            ? 'stable'
            : 'idle',
  };
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

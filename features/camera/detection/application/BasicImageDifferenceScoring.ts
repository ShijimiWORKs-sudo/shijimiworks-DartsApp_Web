import { DetectionEngine } from './DetectionEngine';
import type { BoardCalibrationProfile, BoardScoreResult } from '../../calibration/domain/types';
import { scoreCanonicalPointInViewport } from '../../calibration/domain/coordinateTransform';
import type { SimpleBoardCalibration } from './SimpleBoardCalibration';
import { scoreNormalizedPoint } from './SimpleBoardCalibration';
import type {
  DetectionCandidate,
  LanCameraMultiplier,
  LanCameraSegment,
} from '../../lan/domain/protocol';

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

export type ComponentBoundingBox = { x: number; y: number; width: number; height: number };

export type DartComponentFeature = {
  id: number;
  area: number;
  boundingBox: ComponentBoundingBox;
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
  axis: { start: { x: number; y: number }; end: { x: number; y: number } };
  pixels: { x: number; y: number; delta: number }[];
};

export type TipCandidateFeature = {
  x: number;
  y: number;
  score: number;
  reason: string;
  component: DartComponentFeature;
  boardScore: ReturnType<typeof scorePointWithCalibration>;
};

export type BasicImageDifferenceResult =
  | {
      status: 'candidate';
      candidate: DetectionCandidate;
      alternateCandidates: DetectionCandidate[];
      changedPixelRatio: number;
      boundingBox: ComponentBoundingBox | null;
      components: DartComponentFeature[];
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

  const difference = createDifferenceImage(input.baselineFrame, input.thrownFrame);
  const threshold = input.threshold ?? resolveAdaptiveThreshold(difference.deltas);
  const roiMask = createBoardRoiMask(input);
  const rawMask = createThresholdMask(difference.deltas, threshold, roiMask);
  const openedMask = dilateMask(
    erodeMask(rawMask, input.thrownFrame.width, input.thrownFrame.height),
    input.thrownFrame.width,
    input.thrownFrame.height,
  );
  const closedMask = erodeMask(
    dilateMask(openedMask, input.thrownFrame.width, input.thrownFrame.height),
    input.thrownFrame.width,
    input.thrownFrame.height,
  );
  const components = extractConnectedComponents({
    mask: closedMask,
    deltas: difference.deltas,
    input,
    roiMask,
  });

  const changedPixelCount = countMaskPixels(closedMask);
  if (changedPixelCount === 0 || components.length === 0) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const tips = components.flatMap((component) => createTipCandidates(input, component, threshold));
  const rankedTips = rankTipCandidates(tips).slice(0, 3);
  if (rankedTips.length === 0) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const candidates = createCandidatesFromTips(input, rankedTips, {
    changedPixelRatio: changedPixelCount / input.thrownFrame.pixels.length,
    globalBoundingBox: createGlobalBoundingBox(components, input.thrownFrame),
    processingMs: Date.now() - startedAt,
  }).slice(0, 3);

  if (candidates.length === 0) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const [candidate, ...alternateCandidates] = enrichCandidates(candidates, input, {
    changedPixelRatio: changedPixelCount / input.thrownFrame.pixels.length,
    boundingBox: createGlobalBoundingBox(components, input.thrownFrame),
  });

  return {
    status: 'candidate',
    candidate,
    alternateCandidates,
    changedPixelRatio: changedPixelCount / input.thrownFrame.pixels.length,
    boundingBox: createGlobalBoundingBox(components, input.thrownFrame),
    components,
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
  drawSyntheticDart(thrownFrame.pixels, width, height, x, y, input.intensity ?? 255);
  return { baselineFrame, thrownFrame };
}

function createDifferenceImage(baselineFrame: GrayscaleFrame, thrownFrame: GrayscaleFrame) {
  const length = baselineFrame.pixels.length;
  const deltas = new Uint8Array(length);
  const baselineMean = getMeanBrightness(baselineFrame.pixels);
  const thrownMean = getMeanBrightness(thrownFrame.pixels);
  for (let index = 0; index < length; index += 1) {
    const baselineValue = baselineFrame.pixels[index] - baselineMean;
    const thrownValue = thrownFrame.pixels[index] - thrownMean;
    deltas[index] = Math.min(255, Math.round(Math.abs(thrownValue - baselineValue)));
  }
  return { deltas };
}

function resolveAdaptiveThreshold(deltas: Uint8Array) {
  const sorted = Array.from(deltas).sort((a, b) => a - b);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  return Math.max(28, Math.min(96, Math.round(p95 + (p99 - p95) * 0.45 + 10)));
}

function createBoardRoiMask(input: BasicImageDifferenceInput) {
  const mask = new Uint8Array(input.thrownFrame.pixels.length);
  const dimensions = {
    containerWidth: input.thrownFrame.width,
    containerHeight: input.thrownFrame.height,
  };
  for (let index = 0; index < mask.length; index += 1) {
    const x = index % input.thrownFrame.width;
    const y = Math.floor(index / input.thrownFrame.width);
    const point = {
      x: x / Math.max(1, input.thrownFrame.width - 1),
      y: y / Math.max(1, input.thrownFrame.height - 1),
    };
    const score = scorePointWithCalibration(point, input.calibration, dimensions);
    mask[index] = score.withinBoardRoi ? 1 : 0;
  }
  return mask;
}

function createThresholdMask(deltas: Uint8Array, threshold: number, roiMask: Uint8Array) {
  const mask = new Uint8Array(deltas.length);
  for (let index = 0; index < deltas.length; index += 1) {
    mask[index] = roiMask[index] && deltas[index] >= threshold ? 1 : 0;
  }
  return mask;
}

function erodeMask(mask: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let keep = 1;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!mask[(y + dy) * width + x + dx]) {
            keep = 0;
          }
        }
      }
      output[index] = keep;
    }
  }
  return output;
}

function dilateMask(mask: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let value = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (mask[(y + dy) * width + x + dx]) {
            value = 1;
          }
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function extractConnectedComponents(input: {
  mask: Uint8Array;
  deltas: Uint8Array;
  input: BasicImageDifferenceInput;
  roiMask: Uint8Array;
}) {
  const width = input.input.thrownFrame.width;
  const height = input.input.thrownFrame.height;
  const visited = new Uint8Array(input.mask.length);
  const components: DartComponentFeature[] = [];
  const minArea = Math.max(6, Math.round(input.mask.length * 0.00008));
  const maxArea = Math.max(minArea + 1, Math.round(input.mask.length * 0.12));

  for (let index = 0; index < input.mask.length; index += 1) {
    if (!input.mask[index] || visited[index]) {
      continue;
    }
    const pixels = floodFillComponent(index, input.mask, visited, input.deltas, width, height);
    if (pixels.length < minArea || pixels.length > maxArea) {
      continue;
    }
    const feature = createComponentFeature({
      id: components.length + 1,
      pixels,
      frameWidth: width,
      frameHeight: height,
      input: input.input,
      roiMask: input.roiMask,
    });
    if (feature.boardOverlapRatio < 0.35 || feature.elongation < 1.45) {
      continue;
    }
    components.push(feature);
  }

  return components.sort((a, b) => b.elongation * b.averageDelta - a.elongation * a.averageDelta);
}

function floodFillComponent(
  startIndex: number,
  mask: Uint8Array,
  visited: Uint8Array,
  deltas: Uint8Array,
  width: number,
  height: number,
) {
  const stack = [startIndex];
  const pixels: { x: number; y: number; delta: number }[] = [];
  visited[startIndex] = 1;

  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % width;
    const y = Math.floor(index / width);
    pixels.push({ x, y, delta: deltas[index] });

    for (const [dx, dy] of neighborOffsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const nextIndex = ny * width + nx;
      if (mask[nextIndex] && !visited[nextIndex]) {
        visited[nextIndex] = 1;
        stack.push(nextIndex);
      }
    }
  }
  return pixels;
}

const neighborOffsets = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

function createComponentFeature(input: {
  id: number;
  pixels: { x: number; y: number; delta: number }[];
  frameWidth: number;
  frameHeight: number;
  input: BasicImageDifferenceInput;
  roiMask: Uint8Array;
}): DartComponentFeature {
  const minX = Math.min(...input.pixels.map((pixel) => pixel.x));
  const maxX = Math.max(...input.pixels.map((pixel) => pixel.x));
  const minY = Math.min(...input.pixels.map((pixel) => pixel.y));
  const maxY = Math.max(...input.pixels.map((pixel) => pixel.y));
  const centroid = {
    x: input.pixels.reduce((total, pixel) => total + pixel.x, 0) / input.pixels.length,
    y: input.pixels.reduce((total, pixel) => total + pixel.y, 0) / input.pixels.length,
  };
  const axis = fitMajorAxis(input.pixels, centroid);
  const projections = input.pixels.map((pixel) => ({
    pixel,
    projection: (pixel.x - centroid.x) * axis.vector.x + (pixel.y - centroid.y) * axis.vector.y,
  }));
  const minProjection = projections.reduce((best, item) =>
    item.projection < best.projection ? item : best,
  );
  const maxProjection = projections.reduce((best, item) =>
    item.projection > best.projection ? item : best,
  );
  const majorAxisLength = distance(minProjection.pixel, maxProjection.pixel);
  const area = input.pixels.length;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const boundingBox = {
    x: minX / input.frameWidth,
    y: minY / input.frameHeight,
    width: width / input.frameWidth,
    height: height / input.frameHeight,
  };
  const roiPixels = input.pixels.filter(
    (pixel) => input.roiMask[pixel.y * input.frameWidth + pixel.x],
  ).length;

  return {
    id: input.id,
    area,
    boundingBox,
    width,
    height,
    aspectRatio: width / Math.max(1, height),
    majorAxisLength,
    minorAxisLength: area / Math.max(1, majorAxisLength),
    elongation: majorAxisLength / Math.max(1, area / Math.max(1, majorAxisLength)),
    centroid: {
      x: centroid.x / Math.max(1, input.frameWidth - 1),
      y: centroid.y / Math.max(1, input.frameHeight - 1),
    },
    maxDelta: Math.max(...input.pixels.map((pixel) => pixel.delta)),
    averageDelta: input.pixels.reduce((total, pixel) => total + pixel.delta, 0) / area,
    persistenceCount: 1,
    boardOverlapRatio: roiPixels / area,
    axis: {
      start: {
        x: minProjection.pixel.x / Math.max(1, input.frameWidth - 1),
        y: minProjection.pixel.y / Math.max(1, input.frameHeight - 1),
      },
      end: {
        x: maxProjection.pixel.x / Math.max(1, input.frameWidth - 1),
        y: maxProjection.pixel.y / Math.max(1, input.frameHeight - 1),
      },
    },
    pixels: input.pixels,
  };
}

function fitMajorAxis(
  pixels: { x: number; y: number; delta: number }[],
  centroid: { x: number; y: number },
) {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const pixel of pixels) {
    const dx = pixel.x - centroid.x;
    const dy = pixel.y - centroid.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  return {
    vector: {
      x: Math.cos(theta),
      y: Math.sin(theta),
    },
  };
}

function createTipCandidates(
  input: BasicImageDifferenceInput,
  component: DartComponentFeature,
  threshold: number,
): TipCandidateFeature[] {
  const endpoints = [component.axis.start, component.axis.end];
  const otherEndpoints = [component.axis.end, component.axis.start];
  const dimensions = {
    containerWidth: input.thrownFrame.width,
    containerHeight: input.thrownFrame.height,
  };

  return endpoints
    .map((endpoint, index): TipCandidateFeature => {
      const boardScore = scorePointWithCalibration(endpoint, input.calibration, dimensions);
      const otherScore = scorePointWithCalibration(
        otherEndpoints[index],
        input.calibration,
        dimensions,
      );
      const radialTipBonus =
        boardScore.boardRadius <= otherScore.boardRadius && boardScore.multiplier > 0 ? 0.18 : 0;
      const insideBonus = boardScore.withinDoubleOuter ? 0.22 : -0.35;
      const boundaryBonus =
        boardScore.distanceToSegmentBoundaryDeg == null
          ? 0
          : Math.min(0.12, boardScore.distanceToSegmentBoundaryDeg / 75);
      const deltaScore = clamp01((component.averageDelta - threshold) / 128);
      const elongationScore = clamp01((component.elongation - 1.4) / 5);
      const areaScore = clamp01(component.area / 90);
      const overlapScore = clamp01(component.boardOverlapRatio);
      const score =
        0.18 * deltaScore +
        0.26 * elongationScore +
        0.14 * areaScore +
        0.18 * overlapScore +
        insideBonus +
        radialTipBonus +
        boundaryBonus;
      return {
        x: endpoint.x,
        y: endpoint.y,
        score,
        reason: [
          `axis-end-${index + 1}`,
          boardScore.withinDoubleOuter ? 'inside double outer' : 'outside double outer',
          radialTipBonus > 0 ? 'component extends outward' : 'opposite endpoint retained',
          `elongation ${component.elongation.toFixed(2)}`,
        ].join(' / '),
        component,
        boardScore,
      };
    })
    .filter((tip) => tip.score > 0.12 && tip.boardScore.boardRadius <= 1.08);
}

function rankTipCandidates(tips: TipCandidateFeature[]) {
  return tips.sort((a, b) => {
    const aPlayable = a.boardScore.multiplier > 0 ? 1 : 0;
    const bPlayable = b.boardScore.multiplier > 0 ? 1 : 0;
    if (aPlayable !== bPlayable) {
      return bPlayable - aPlayable;
    }
    return b.score - a.score;
  });
}

function createCandidatesFromTips(
  input: BasicImageDifferenceInput,
  tips: TipCandidateFeature[],
  metadata: {
    changedPixelRatio: number;
    globalBoundingBox: ComponentBoundingBox | null;
    processingMs: number;
  },
) {
  const engine = new DetectionEngine();
  const candidates: DetectionCandidate[] = [];
  for (const tip of tips) {
    candidates.push(
      createCandidateFromTip({
        input,
        tip,
        metadata,
        engine,
        confidenceOffset: candidates.length * 0.08,
      }),
    );
    for (const alternate of tip.boardScore.alternateCandidates) {
      if (candidates.length >= 3) {
        break;
      }
      candidates.push(
        createCandidateFromTip({
          input,
          tip,
          metadata,
          engine,
          confidenceOffset: candidates.length * 0.08 + 0.12,
          overrideScore: alternate,
        }),
      );
    }
  }
  return dedupeCandidates(candidates).slice(0, 3);
}

function createCandidateFromTip(input: {
  input: BasicImageDifferenceInput;
  tip: TipCandidateFeature;
  metadata: {
    changedPixelRatio: number;
    globalBoundingBox: ComponentBoundingBox | null;
    processingMs: number;
  };
  engine: DetectionEngine;
  confidenceOffset: number;
  overrideScore?: BoardScoreResult['alternateCandidates'][number];
}): DetectionCandidate {
  const score = input.overrideScore ?? input.tip.boardScore;
  const confidence = calculateConfidence(input.tip, input.confidenceOffset);
  const calibrationProfileId =
    'profileId' in input.input.calibration ? input.input.calibration.profileId : undefined;
  const rotationDeg =
    'rotationDeg' in input.input.calibration ? input.input.calibration.rotationDeg : undefined;
  const scoreDiagnostics = {
    normalizedX: input.tip.x,
    normalizedY: input.tip.y,
    boardRadius: input.tip.boardScore.boardRadius,
    boardAngleDeg: input.tip.boardScore.boardAngleDeg,
    segmentIndex: input.tip.boardScore.segmentIndex,
    segmentNumber: score.segmentNumber,
    area: score.area,
    multiplier: score.multiplier,
    score: score.score,
    withinDoubleOuter: input.tip.boardScore.withinDoubleOuter,
    calibrationProfileId,
    rotationDeg,
    distanceToSegmentBoundaryDeg: input.tip.boardScore.distanceToSegmentBoundaryDeg,
  };
  return {
    ...input.engine.createCandidate({
      sessionId: input.input.sessionId,
      cameraNodeId: input.input.cameraNodeId,
      throwIndex: input.input.throwIndex,
      segment: ((score.segmentNumber ?? 25) || 25) as LanCameraSegment,
      multiplier: score.multiplier as LanCameraMultiplier,
      confidence,
      normalizedX: input.tip.x,
      normalizedY: input.tip.y,
      now: input.input.now,
      random: input.input.random,
    }),
    type: 'detection_candidate',
    processingMs: input.metadata.processingMs,
    componentBoundingBox: input.tip.component.boundingBox,
    fittedAxis: input.tip.component.axis,
    tipCandidates: [
      {
        x: input.tip.component.axis.start.x,
        y: input.tip.component.axis.start.y,
        score: input.tip.component.axis.start.x === input.tip.x ? input.tip.score : 0,
        reason:
          input.tip.component.axis.start.x === input.tip.x &&
          input.tip.component.axis.start.y === input.tip.y
            ? input.tip.reason
            : 'opposite axis endpoint',
      },
      {
        x: input.tip.component.axis.end.x,
        y: input.tip.component.axis.end.y,
        score: input.tip.component.axis.end.x === input.tip.x ? input.tip.score : 0,
        reason:
          input.tip.component.axis.end.x === input.tip.x &&
          input.tip.component.axis.end.y === input.tip.y
            ? input.tip.reason
            : 'opposite axis endpoint',
      },
    ],
    scoreDiagnostics,
    componentDiagnostics: {
      area: input.tip.component.area,
      width: input.tip.component.width,
      height: input.tip.component.height,
      aspectRatio: input.tip.component.aspectRatio,
      majorAxisLength: input.tip.component.majorAxisLength,
      minorAxisLength: input.tip.component.minorAxisLength,
      elongation: input.tip.component.elongation,
      centroid: input.tip.component.centroid,
      maxDelta: input.tip.component.maxDelta,
      averageDelta: input.tip.component.averageDelta,
      persistenceCount: input.tip.component.persistenceCount,
      boardOverlapRatio: input.tip.component.boardOverlapRatio,
      tipSelectionReason: input.tip.reason,
    },
  };
}

function calculateConfidence(tip: TipCandidateFeature, offset: number) {
  const component = tip.component;
  const elongation = clamp01((component.elongation - 1.4) / 5);
  const area = clamp01(component.area / 100);
  const delta = clamp01(component.averageDelta / 180);
  const overlap = clamp01(component.boardOverlapRatio);
  const boundary =
    tip.boardScore.distanceToSegmentBoundaryDeg == null
      ? 0.65
      : clamp01(tip.boardScore.distanceToSegmentBoundaryDeg / 9);
  const inside = tip.boardScore.withinDoubleOuter ? 1 : 0;
  return clamp01(
    0.16 +
      elongation * 0.22 +
      area * 0.12 +
      delta * 0.18 +
      overlap * 0.18 +
      boundary * 0.08 +
      inside * 0.12 -
      offset,
  );
}

function dedupeCandidates(candidates: DetectionCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.segment}-${candidate.multiplier}-${candidate.normalizedX.toFixed(3)}-${candidate.normalizedY.toFixed(3)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function enrichCandidates(
  candidates: DetectionCandidate[],
  input: BasicImageDifferenceInput,
  metadata: {
    changedPixelRatio: number;
    boundingBox: ComponentBoundingBox | null;
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
    reason: 'REAL_FRAME_COMPONENT_TIP',
    alternateCandidateIds: candidateIds.filter(
      (candidateId) => candidateId !== candidate.candidateId,
    ),
    calibrationProfileId,
    algorithmVersion: 'basic-image-difference-components-v2',
  }));
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
      confidence: score.multiplier === 0 ? 0.08 : 0.5,
      boardRadius: score.boardRadius,
      boardAngleDeg: score.boardAngleDeg,
      segmentIndex: score.segmentIndex,
      segmentNumber: score.segmentNumber,
      area: score.area,
      score: score.score,
      withinDoubleOuter: score.withinDoubleOuter,
      withinBoardRoi: score.boardRadius <= 1.1,
      distanceToSegmentBoundaryDeg: score.distanceToSegmentBoundaryDeg,
      alternateCandidates: score.alternateCandidates,
    };
  }
  const score = scoreNormalizedPoint(point, calibration);
  return {
    segment: score.segment,
    multiplier: score.multiplier,
    normalizedX: score.normalizedX,
    normalizedY: score.normalizedY,
    confidence: score.confidence,
    boardRadius: distance(point, { x: 0.5, y: 0.5 }) / 0.48,
    boardAngleDeg: 0,
    segmentIndex: score.segment === 25 ? null : 0,
    segmentNumber: score.segment === 25 ? null : score.segment,
    area: score.multiplier === 0 ? 'miss' : score.segment === 25 ? 'inner_bull' : 'single',
    score: score.segment * score.multiplier,
    withinDoubleOuter: score.multiplier > 0,
    withinBoardRoi: score.multiplier > 0,
    distanceToSegmentBoundaryDeg: null,
    alternateCandidates: [],
  };
}

function createGlobalBoundingBox(components: DartComponentFeature[], frame: GrayscaleFrame) {
  if (components.length === 0) {
    return null;
  }
  const minX = Math.min(...components.map((component) => component.boundingBox.x * frame.width));
  const minY = Math.min(...components.map((component) => component.boundingBox.y * frame.height));
  const maxX = Math.max(
    ...components.map(
      (component) => (component.boundingBox.x + component.boundingBox.width) * frame.width,
    ),
  );
  const maxY = Math.max(
    ...components.map(
      (component) => (component.boundingBox.y + component.boundingBox.height) * frame.height,
    ),
  );
  return {
    x: minX / frame.width,
    y: minY / frame.height,
    width: (maxX - minX) / frame.width,
    height: (maxY - minY) / frame.height,
  };
}

function drawSyntheticDart(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tipX: number,
  tipY: number,
  intensity: number,
) {
  for (let step = 0; step < 12; step += 1) {
    const x = Math.min(width - 2, Math.max(1, tipX + Math.round(step * 0.45)));
    const y = Math.min(height - 2, Math.max(1, tipY + step));
    pixels[y * width + x] = intensity;
    pixels[y * width + x + 1] = intensity;
    pixels[(y + 1) * width + x] = intensity;
  }
}

function getMeanBrightness(pixels: GrayscaleFrame['pixels']) {
  if (pixels.length === 0) {
    return 0;
  }
  let total = 0;
  for (const value of pixels) {
    total += value;
  }
  return total / pixels.length;
}

function countMaskPixels(mask: Uint8Array) {
  let total = 0;
  for (const value of mask) {
    total += value;
  }
  return total;
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio)),
  );
  return sortedValues[index];
}

function distance(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.sqrt((first.x - second.x) ** 2 + (first.y - second.y) ** 2);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

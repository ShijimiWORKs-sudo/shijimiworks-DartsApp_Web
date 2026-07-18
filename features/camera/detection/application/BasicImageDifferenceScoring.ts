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
  averageWidth: number;
  widthVariance: number;
  edgeSharpness: number;
  edgeDensity: number;
  localContrast: number;
  gradientMagnitude: number;
  solidity: number;
  compactness: number;
  interiorBrightnessVariance: number;
  boundaryBlur: number;
  darkeningPolarity: number;
  skeletonLength: number;
  skeletonBranchCount: number;
  dartLikelihood: number;
  shadowLikelihood: number;
  rejectionReason: string | null;
  narrowCore: {
    pixels: { x: number; y: number; delta: number }[];
    boundingBox: ComponentBoundingBox | null;
    axis: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
    majorAxisLength: number;
    isBrightCore: boolean;
  };
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
    threshold,
  });

  const changedPixelCount = countMaskPixels(closedMask);
  if (changedPixelCount === 0 || components.length === 0) {
    return {
      status: 'no_candidate',
      reason: 'NO_SIGNIFICANT_CHANGE',
      processingMs: Date.now() - startedAt,
    };
  }

  const rejectedShadowComponents = components.filter(
    (component) =>
      component.shadowLikelihood >= 0.58 ||
      (component.narrowCore.isBrightCore &&
        component.averageWidth >= 7 &&
        component.shadowLikelihood >= 0.34),
  );
  const tips = components
    .filter(isDartCandidateComponent)
    .flatMap((component) => createTipCandidates(input, component, threshold));
  const rankedTips = suppressNearbyTips(rankTipCandidates(tips)).slice(0, 3);
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
    rejectedShadowComponents,
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
  threshold: number;
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
      deltas: input.deltas,
      threshold: input.threshold,
    });
    if (feature.boardOverlapRatio < 0.35) {
      continue;
    }
    components.push(feature);
  }

  return components.sort(
    (a, b) =>
      b.dartLikelihood * (1 - b.shadowLikelihood) - a.dartLikelihood * (1 - a.shadowLikelihood),
  );
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
  deltas: Uint8Array;
  threshold: number;
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
  const bboxArea = width * height;
  const boundingBox = {
    x: minX / input.frameWidth,
    y: minY / input.frameHeight,
    width: width / input.frameWidth,
    height: height / input.frameHeight,
  };
  const roiPixels = input.pixels.filter(
    (pixel) => input.roiMask[pixel.y * input.frameWidth + pixel.x],
  ).length;
  const pixelSet = createPixelSet(input.pixels, input.frameWidth);
  const boundaryPixels = input.pixels.filter((pixel) =>
    isBoundaryPixel(pixel, pixelSet, input.frameWidth, input.frameHeight),
  );
  const edgeDensity = boundaryPixels.length / Math.max(1, area);
  const edgeSharpness = getAverageBoundarySharpness(
    boundaryPixels,
    input.deltas,
    input.frameWidth,
    input.frameHeight,
  );
  const gradientMagnitude = getAverageGradientMagnitude(
    input.pixels,
    input.deltas,
    input.frameWidth,
    input.frameHeight,
  );
  const averageDelta = input.pixels.reduce((total, pixel) => total + pixel.delta, 0) / area;
  const deltaVariance = variance(input.pixels.map((pixel) => pixel.delta));
  const averageWidth = area / Math.max(1, majorAxisLength);
  const widthVariance = calculateWidthVariance(input.pixels, centroid, axis.vector);
  const solidity = area / Math.max(1, bboxArea);
  const compactness = (4 * Math.PI * area) / Math.max(1, boundaryPixels.length ** 2);
  const darkeningPolarity = getDarkeningPolarity(input.pixels, input.input, input.frameWidth);
  const narrowCore = extractNarrowCore({
    pixels: input.pixels,
    frameWidth: input.frameWidth,
    frameHeight: input.frameHeight,
    sourceInput: input.input,
    averageDelta,
    maxDelta: Math.max(...input.pixels.map((pixel) => pixel.delta)),
  });
  const skeletonLength = narrowCore.majorAxisLength;
  const skeletonBranchCount = estimateSkeletonBranchCount(narrowCore.pixels, input.frameWidth);
  const likelihood = classifyComponent({
    area,
    majorAxisLength,
    minorAxisLength: area / Math.max(1, majorAxisLength),
    elongation: majorAxisLength / Math.max(1, area / Math.max(1, majorAxisLength)),
    averageWidth,
    widthVariance,
    edgeSharpness,
    edgeDensity,
    localContrast: averageDelta - input.threshold,
    gradientMagnitude,
    solidity,
    compactness,
    interiorBrightnessVariance: deltaVariance,
    boundaryBlur: clamp01(1 - edgeSharpness / 72),
    darkeningPolarity,
    skeletonLength,
    skeletonBranchCount,
    boardOverlapRatio: roiPixels / area,
    bboxAreaRatio: bboxArea / Math.max(1, input.frameWidth * input.frameHeight),
  });
  const brightCoreDartLikelihood = narrowCore.isBrightCore
    ? clamp01(narrowCore.majorAxisLength / 8) * 0.55
    : 0;
  const dartLikelihood = Math.max(likelihood.dartLikelihood, brightCoreDartLikelihood);
  const shadowLikelihood = narrowCore.isBrightCore
    ? clamp01(likelihood.shadowLikelihood - brightCoreDartLikelihood * 0.45)
    : likelihood.shadowLikelihood;
  const rejectionReason =
    narrowCore.isBrightCore && narrowCore.majorAxisLength >= 5.5
      ? null
      : likelihood.rejectionReason;

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
    averageDelta,
    persistenceCount: 1,
    boardOverlapRatio: roiPixels / area,
    averageWidth,
    widthVariance,
    edgeSharpness,
    edgeDensity,
    localContrast: averageDelta - input.threshold,
    gradientMagnitude,
    solidity,
    compactness,
    interiorBrightnessVariance: deltaVariance,
    boundaryBlur: clamp01(1 - edgeSharpness / 72),
    darkeningPolarity,
    skeletonLength,
    skeletonBranchCount,
    dartLikelihood,
    shadowLikelihood,
    rejectionReason,
    narrowCore,
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

function createPixelSet(pixels: { x: number; y: number }[], frameWidth: number) {
  return new Set(pixels.map((pixel) => pixel.y * frameWidth + pixel.x));
}

function isBoundaryPixel(
  pixel: { x: number; y: number },
  pixelSet: Set<number>,
  frameWidth: number,
  frameHeight: number,
) {
  for (const [dx, dy] of neighborOffsets) {
    const x = pixel.x + dx;
    const y = pixel.y + dy;
    if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) {
      return true;
    }
    if (!pixelSet.has(y * frameWidth + x)) {
      return true;
    }
  }
  return false;
}

function getAverageBoundarySharpness(
  boundaryPixels: { x: number; y: number; delta: number }[],
  deltas: Uint8Array,
  frameWidth: number,
  frameHeight: number,
) {
  if (boundaryPixels.length === 0) {
    return 0;
  }
  let total = 0;
  for (const pixel of boundaryPixels) {
    let outsideTotal = 0;
    let outsideCount = 0;
    for (const [dx, dy] of neighborOffsets) {
      const x = pixel.x + dx;
      const y = pixel.y + dy;
      if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) {
        continue;
      }
      outsideTotal += deltas[y * frameWidth + x];
      outsideCount += 1;
    }
    const outsideAverage = outsideCount === 0 ? 0 : outsideTotal / outsideCount;
    total += Math.max(0, pixel.delta - outsideAverage);
  }
  return total / boundaryPixels.length;
}

function getAverageGradientMagnitude(
  pixels: { x: number; y: number }[],
  deltas: Uint8Array,
  frameWidth: number,
  frameHeight: number,
) {
  if (pixels.length === 0) {
    return 0;
  }
  let total = 0;
  for (const pixel of pixels) {
    const left = deltas[pixel.y * frameWidth + Math.max(0, pixel.x - 1)];
    const right = deltas[pixel.y * frameWidth + Math.min(frameWidth - 1, pixel.x + 1)];
    const top = deltas[Math.max(0, pixel.y - 1) * frameWidth + pixel.x];
    const bottom = deltas[Math.min(frameHeight - 1, pixel.y + 1) * frameWidth + pixel.x];
    total += Math.sqrt((right - left) ** 2 + (bottom - top) ** 2);
  }
  return total / pixels.length;
}

function variance(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
}

function calculateWidthVariance(
  pixels: { x: number; y: number }[],
  centroid: { x: number; y: number },
  axisVector: { x: number; y: number },
) {
  const buckets = new Map<number, number[]>();
  const normal = { x: -axisVector.y, y: axisVector.x };
  for (const pixel of pixels) {
    const projection = Math.round(
      (pixel.x - centroid.x) * axisVector.x + (pixel.y - centroid.y) * axisVector.y,
    );
    const lateral = Math.abs((pixel.x - centroid.x) * normal.x + (pixel.y - centroid.y) * normal.y);
    const values = buckets.get(projection) ?? [];
    values.push(lateral);
    buckets.set(projection, values);
  }
  const widths = Array.from(buckets.values()).map((values) => Math.max(...values) * 2 + 1);
  return variance(widths);
}

function getDarkeningPolarity(
  pixels: { x: number; y: number }[],
  input: BasicImageDifferenceInput,
  frameWidth: number,
) {
  if (pixels.length === 0) {
    return 0;
  }
  let total = 0;
  for (const pixel of pixels) {
    const index = pixel.y * frameWidth + pixel.x;
    total += input.thrownFrame.pixels[index] - input.baselineFrame.pixels[index];
  }
  return total / pixels.length / 255;
}

function extractNarrowCore(input: {
  pixels: { x: number; y: number; delta: number }[];
  frameWidth: number;
  frameHeight: number;
  sourceInput: BasicImageDifferenceInput;
  averageDelta: number;
  maxDelta: number;
}): DartComponentFeature['narrowCore'] {
  const coreThreshold = Math.max(
    input.averageDelta + Math.sqrt(variance(input.pixels.map((pixel) => pixel.delta))) * 0.45,
    input.maxDelta * 0.62,
  );
  const brightCorePixels = input.pixels.filter((pixel) => {
    const index = pixel.y * input.frameWidth + pixel.x;
    return (
      pixel.delta >= coreThreshold * 0.72 &&
      input.sourceInput.thrownFrame.pixels[index] - input.sourceInput.baselineFrame.pixels[index] >
        18
    );
  });
  const corePixels =
    brightCorePixels.length >= 6
      ? brightCorePixels
      : input.pixels.filter((pixel) => pixel.delta >= coreThreshold);
  if (corePixels.length < 6) {
    return {
      pixels: corePixels,
      boundingBox: null,
      axis: null,
      majorAxisLength: 0,
      isBrightCore: brightCorePixels.length >= 6,
    };
  }
  const centroid = {
    x: corePixels.reduce((total, pixel) => total + pixel.x, 0) / corePixels.length,
    y: corePixels.reduce((total, pixel) => total + pixel.y, 0) / corePixels.length,
  };
  const axis = fitMajorAxis(corePixels, centroid);
  const projections = corePixels.map((pixel) => ({
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
  const minX = Math.min(...corePixels.map((pixel) => pixel.x));
  const maxX = Math.max(...corePixels.map((pixel) => pixel.x));
  const minY = Math.min(...corePixels.map((pixel) => pixel.y));
  const maxY = Math.max(...corePixels.map((pixel) => pixel.y));
  return {
    pixels: corePixels,
    boundingBox: {
      x: minX / input.frameWidth,
      y: minY / input.frameHeight,
      width: (maxX - minX + 1) / input.frameWidth,
      height: (maxY - minY + 1) / input.frameHeight,
    },
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
    majorAxisLength,
    isBrightCore: brightCorePixels.length >= 6,
  };
}

function estimateSkeletonBranchCount(pixels: { x: number; y: number }[], frameWidth: number) {
  if (pixels.length === 0) {
    return 0;
  }
  const pixelSet = createPixelSet(pixels, frameWidth);
  let branches = 0;
  for (const pixel of pixels) {
    let neighbors = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        if (pixelSet.has((pixel.y + dy) * frameWidth + pixel.x + dx)) {
          neighbors += 1;
        }
      }
    }
    if (neighbors >= 4) {
      branches += 1;
    }
  }
  return branches;
}

function classifyComponent(input: {
  area: number;
  majorAxisLength: number;
  minorAxisLength: number;
  elongation: number;
  averageWidth: number;
  widthVariance: number;
  edgeSharpness: number;
  edgeDensity: number;
  localContrast: number;
  gradientMagnitude: number;
  solidity: number;
  compactness: number;
  interiorBrightnessVariance: number;
  boundaryBlur: number;
  darkeningPolarity: number;
  skeletonLength: number;
  skeletonBranchCount: number;
  boardOverlapRatio: number;
  bboxAreaRatio: number;
}) {
  const elongationScore = clamp01((input.elongation - 2.2) / 2.4);
  const highElongationBonus = clamp01((input.elongation - 4) / 2);
  const coreLengthScore = clamp01((input.skeletonLength - 10) / 28);
  const widthScore = clamp01(1 - (input.averageWidth - 2.5) / 8);
  const widthVarianceScore = clamp01(1 - input.widthVariance / 8);
  const sharpnessScore = clamp01(input.edgeSharpness / 90);
  const contrastScore = clamp01(input.localContrast / 120);
  const overlapScore = clamp01(input.boardOverlapRatio);
  const branchPenalty = clamp01(input.skeletonBranchCount / 8);
  const dartLikelihood = clamp01(
    elongationScore * 0.24 +
      highElongationBonus * 0.1 +
      coreLengthScore * 0.22 +
      widthScore * 0.12 +
      widthVarianceScore * 0.08 +
      sharpnessScore * 0.1 +
      contrastScore * 0.08 +
      overlapScore * 0.06 -
      branchPenalty * 0.12,
  );

  const lowElongationShadow = clamp01((2.2 - input.elongation) / 1.2);
  const broadScore = clamp01((input.averageWidth - 5.8) / 8);
  const blurScore = clamp01(input.boundaryBlur);
  const solidBlobScore = clamp01((input.solidity - 0.52) / 0.35);
  const compactScore = clamp01((input.compactness - 0.18) / 0.4);
  const darkShadowScore = clamp01((-input.darkeningPolarity - 0.02) / 0.18);
  const lowContrastScore = clamp01(1 - input.gradientMagnitude / 72);
  const areaScore = clamp01((input.bboxAreaRatio - 0.002) / 0.05);
  const shadowLikelihood = clamp01(
    lowElongationShadow * 0.24 +
      broadScore * 0.16 +
      blurScore * 0.12 +
      solidBlobScore * 0.14 +
      compactScore * 0.08 +
      darkShadowScore * 0.12 +
      lowContrastScore * 0.08 +
      areaScore * 0.06 +
      branchPenalty * 0.08 -
      coreLengthScore * 0.14 -
      sharpnessScore * 0.08,
  );

  let rejectionReason: string | null = null;
  if (input.elongation < 2.2 && coreLengthScore < 0.25) {
    rejectionReason = 'LOW_ELONGATION_SHADOW';
  } else if (shadowLikelihood >= 0.62 && dartLikelihood < 0.5) {
    rejectionReason = 'SHADOW_LIKELY';
  } else if (input.averageWidth > 12 && coreLengthScore < 0.35) {
    rejectionReason = 'BROAD_BLURRED_COMPONENT';
  }

  return {
    dartLikelihood,
    shadowLikelihood,
    rejectionReason,
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
  const candidateAxis = component.narrowCore.axis ?? component.axis;
  const endpoints = [candidateAxis.start, candidateAxis.end];
  const otherEndpoints = [candidateAxis.end, candidateAxis.start];
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
      const elongationScore = clamp01((component.elongation - 2.2) / 4);
      const coreScore = clamp01(component.skeletonLength / 32);
      const areaScore = clamp01(component.area / 90);
      const overlapScore = clamp01(component.boardOverlapRatio);
      const shadowPenalty = component.narrowCore.isBrightCore
        ? component.shadowLikelihood * 0.16
        : component.shadowLikelihood * 0.34;
      const score =
        0.18 * deltaScore +
        0.18 * elongationScore +
        0.16 * coreScore +
        0.08 * areaScore +
        0.16 * overlapScore +
        component.dartLikelihood * 0.26 -
        shadowPenalty +
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
          `dart ${component.dartLikelihood.toFixed(2)}`,
          `shadow ${component.shadowLikelihood.toFixed(2)}`,
          component.narrowCore.axis ? 'narrow core axis' : 'component axis',
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

function isDartCandidateComponent(component: DartComponentFeature) {
  const hasUsableCore =
    component.narrowCore.axis != null &&
    component.narrowCore.majorAxisLength >= 8 &&
    component.skeletonLength >= 8;
  const hasBrightCore =
    component.narrowCore.isBrightCore &&
    component.narrowCore.axis != null &&
    component.narrowCore.majorAxisLength >= 5.5;
  const isSharpNarrowFragment =
    component.skeletonLength >= 4 &&
    component.averageWidth <= 4.4 &&
    component.edgeSharpness >= 28 &&
    component.shadowLikelihood < 0.5;
  if (
    component.averageWidth >= 7 &&
    component.shadowLikelihood >= 0.55 &&
    component.dartLikelihood < 0.18 &&
    component.edgeSharpness < 42
  ) {
    return false;
  }
  if (component.rejectionReason && !hasUsableCore && !hasBrightCore && !isSharpNarrowFragment) {
    return false;
  }
  if (component.shadowLikelihood >= 0.66 && component.dartLikelihood < 0.58) {
    return false;
  }
  if (component.elongation < 2.2 && !hasUsableCore && !hasBrightCore && !isSharpNarrowFragment) {
    return false;
  }
  if (
    component.elongation < 3 &&
    component.dartLikelihood < 0.24 &&
    !hasUsableCore &&
    !hasBrightCore &&
    !isSharpNarrowFragment
  ) {
    return false;
  }
  return (
    component.boardOverlapRatio >= 0.35 &&
    (component.dartLikelihood >= 0.24 || hasUsableCore || hasBrightCore || isSharpNarrowFragment)
  );
}

function suppressNearbyTips(tips: TipCandidateFeature[]) {
  const selected: TipCandidateFeature[] = [];
  for (const tip of tips) {
    const duplicate = selected.some((selectedTip) => {
      const normalizedDistance = distance(tip, selectedTip);
      const sameComponent = tip.component.id === selectedTip.component.id;
      const sameScoringCell =
        tip.boardScore.segmentNumber === selectedTip.boardScore.segmentNumber &&
        tip.boardScore.multiplier === selectedTip.boardScore.multiplier;
      return (
        normalizedDistance < 0.045 ||
        (sameComponent && normalizedDistance < 0.12) ||
        sameScoringCell
      );
    });
    if (!duplicate) {
      selected.push(tip);
    }
  }
  return selected;
}

function createCandidatesFromTips(
  input: BasicImageDifferenceInput,
  tips: TipCandidateFeature[],
  metadata: {
    changedPixelRatio: number;
    globalBoundingBox: ComponentBoundingBox | null;
    rejectedShadowComponents: DartComponentFeature[];
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
    rejectedShadowComponents: DartComponentFeature[];
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
    narrowCoreBoundingBox: input.tip.component.narrowCore.boundingBox,
    rejectedShadowComponents: input.metadata.rejectedShadowComponents.map((component) => ({
      boundingBox: component.boundingBox,
      shadowLikelihood: component.shadowLikelihood,
      rejectionReason: component.rejectionReason ?? 'SHADOW_LIKELY',
    })),
    fittedAxis: input.tip.component.narrowCore.axis ?? input.tip.component.axis,
    tipCandidates: [
      {
        x: (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.x,
        y: (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.y,
        score:
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.x ===
            input.tip.x &&
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.y === input.tip.y
            ? input.tip.score
            : 0,
        reason:
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.x ===
            input.tip.x &&
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).start.y === input.tip.y
            ? input.tip.reason
            : 'opposite axis endpoint',
      },
      {
        x: (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.x,
        y: (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.y,
        score:
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.x === input.tip.x &&
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.y === input.tip.y
            ? input.tip.score
            : 0,
        reason:
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.x === input.tip.x &&
          (input.tip.component.narrowCore.axis ?? input.tip.component.axis).end.y === input.tip.y
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
      averageWidth: input.tip.component.averageWidth,
      widthVariance: input.tip.component.widthVariance,
      edgeSharpness: input.tip.component.edgeSharpness,
      edgeDensity: input.tip.component.edgeDensity,
      localContrast: input.tip.component.localContrast,
      gradientMagnitude: input.tip.component.gradientMagnitude,
      solidity: input.tip.component.solidity,
      compactness: input.tip.component.compactness,
      interiorBrightnessVariance: input.tip.component.interiorBrightnessVariance,
      boundaryBlur: input.tip.component.boundaryBlur,
      darkeningPolarity: input.tip.component.darkeningPolarity,
      skeletonLength: input.tip.component.skeletonLength,
      skeletonBranchCount: input.tip.component.skeletonBranchCount,
      dartLikelihood: input.tip.component.dartLikelihood,
      shadowLikelihood: input.tip.component.shadowLikelihood,
      rejectionReason: input.tip.component.rejectionReason,
      tipSelectionReason: input.tip.reason,
    },
  };
}

function calculateConfidence(tip: TipCandidateFeature, offset: number) {
  const component = tip.component;
  const elongation = clamp01((component.elongation - 2.2) / 3.8);
  const core = clamp01(component.skeletonLength / 34);
  const widthConsistency = clamp01(1 - component.widthVariance / 9);
  const sharpness = clamp01(component.edgeSharpness / 90);
  const width = clamp01(1 - (component.averageWidth - 2.2) / 8);
  const delta = clamp01(component.averageDelta / 180);
  const overlap = clamp01(component.boardOverlapRatio);
  const boundary =
    tip.boardScore.distanceToSegmentBoundaryDeg == null
      ? 0.65
      : clamp01(tip.boardScore.distanceToSegmentBoundaryDeg / 9);
  const inside = tip.boardScore.withinDoubleOuter ? 1 : 0;
  return clamp01(
    0.08 +
      component.dartLikelihood * 0.34 +
      elongation * 0.12 +
      core * 0.14 +
      widthConsistency * 0.08 +
      sharpness * 0.08 +
      width * 0.06 +
      delta * 0.12 +
      overlap * 0.1 +
      boundary * 0.08 +
      inside * 0.1 -
      component.shadowLikelihood * 0.32 -
      offset,
  );
}

function dedupeCandidates(candidates: DetectionCandidate[]) {
  const selected: DetectionCandidate[] = [];
  return candidates.filter((candidate) => {
    const duplicate = selected.some((existing) => {
      const normalizedDistance = distance(
        { x: candidate.normalizedX, y: candidate.normalizedY },
        { x: existing.normalizedX, y: existing.normalizedY },
      );
      const sameScore =
        candidate.segment === existing.segment && candidate.multiplier === existing.multiplier;
      return normalizedDistance < 0.045 || sameScore;
    });
    if (duplicate) {
      return false;
    }
    selected.push(candidate);
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

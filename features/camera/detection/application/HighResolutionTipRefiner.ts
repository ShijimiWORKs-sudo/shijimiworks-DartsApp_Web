import type { GrayscaleFrame, ComponentBoundingBox } from './BasicImageDifferenceScoring';

export type TipEvaluation = {
  x: number;
  y: number;
  score: number;
  insideBoard: boolean;
  insideDoubleOuter: boolean;
  edgeSharpness: number;
  directionScore: number;
  stabilityScore: number;
  shadowDirectionPenalty: number;
  reason: string;
};

export type HighResolutionTipRefinement = {
  refinedX: number;
  refinedY: number;
  roi: ComponentBoundingBox;
  sourceWidth: number;
  sourceHeight: number;
  evaluation: TipEvaluation;
};

export function refineTipAtSourceResolution(input: {
  baselineFrame: GrayscaleFrame;
  thrownFrame: GrayscaleFrame;
  lowResolutionTip: { x: number; y: number };
  componentCentroid: { x: number; y: number };
  componentBoundingBox: ComponentBoundingBox;
  threshold?: number;
  boardRadius?: number;
  withinDoubleOuter?: boolean;
  shadowDirectionDeg?: number | null;
}): HighResolutionTipRefinement | null {
  if (
    input.baselineFrame.width !== input.thrownFrame.width ||
    input.baselineFrame.height !== input.thrownFrame.height ||
    input.baselineFrame.pixels.length !== input.thrownFrame.pixels.length
  ) {
    return null;
  }

  const width = input.thrownFrame.width;
  const height = input.thrownFrame.height;
  const padding = Math.max(8, Math.round(Math.min(width, height) * 0.025));
  const x1 = Math.max(0, Math.floor(input.componentBoundingBox.x * width) - padding);
  const y1 = Math.max(0, Math.floor(input.componentBoundingBox.y * height) - padding);
  const x2 = Math.min(
    width - 1,
    Math.ceil((input.componentBoundingBox.x + input.componentBoundingBox.width) * width) + padding,
  );
  const y2 = Math.min(
    height - 1,
    Math.ceil((input.componentBoundingBox.y + input.componentBoundingBox.height) * height) +
      padding,
  );

  const threshold = input.threshold ?? 24;
  const lowTipPx = {
    x: input.lowResolutionTip.x * (width - 1),
    y: input.lowResolutionTip.y * (height - 1),
  };
  const centroidPx = {
    x: input.componentCentroid.x * (width - 1),
    y: input.componentCentroid.y * (height - 1),
  };
  const axis = normalizeVector({
    x: lowTipPx.x - centroidPx.x,
    y: lowTipPx.y - centroidPx.y,
  });
  let best: TipEvaluation | null = null;

  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      const index = y * width + x;
      const delta = Math.abs(input.thrownFrame.pixels[index] - input.baselineFrame.pixels[index]);
      if (delta < threshold) {
        continue;
      }
      const projection = (x - centroidPx.x) * axis.x + (y - centroidPx.y) * axis.y;
      const directionScore = clamp01(projection / Math.max(1, distance(lowTipPx, centroidPx)));
      const edgeSharpness = calculateLocalEdge(input.baselineFrame, input.thrownFrame, x, y);
      const stabilityScore = clamp01(delta / 180);
      const shadowDirectionPenalty = calculateShadowDirectionPenalty({
        axisDeg: Math.atan2(axis.y, axis.x) * (180 / Math.PI),
        shadowDirectionDeg: input.shadowDirectionDeg,
      });
      const score =
        delta / 255 +
        edgeSharpness / 120 +
        directionScore * 0.55 +
        stabilityScore * 0.25 -
        shadowDirectionPenalty * 0.45;
      const evaluation: TipEvaluation = {
        x: x / Math.max(1, width - 1),
        y: y / Math.max(1, height - 1),
        score,
        insideBoard: (input.boardRadius ?? 0.9) <= 1.08,
        insideDoubleOuter: input.withinDoubleOuter ?? true,
        edgeSharpness,
        directionScore,
        stabilityScore,
        shadowDirectionPenalty,
        reason: 'source-resolution-roi-tip',
      };
      if (!best || evaluation.score > best.score) {
        best = evaluation;
      }
    }
  }

  if (!best) {
    return null;
  }

  return {
    refinedX: best.x,
    refinedY: best.y,
    roi: {
      x: x1 / width,
      y: y1 / height,
      width: (x2 - x1 + 1) / width,
      height: (y2 - y1 + 1) / height,
    },
    sourceWidth: width,
    sourceHeight: height,
    evaluation: best,
  };
}

function calculateLocalEdge(
  baselineFrame: GrayscaleFrame,
  thrownFrame: GrayscaleFrame,
  x: number,
  y: number,
) {
  const { width, height } = thrownFrame;
  const center = Math.abs(thrownFrame.pixels[y * width + x] - baselineFrame.pixels[y * width + x]);
  let total = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }
      const neighbor = Math.abs(
        thrownFrame.pixels[py * width + px] - baselineFrame.pixels[py * width + px],
      );
      total += Math.max(0, center - neighbor);
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

function calculateShadowDirectionPenalty(input: {
  axisDeg: number;
  shadowDirectionDeg?: number | null;
}) {
  if (input.shadowDirectionDeg == null) {
    return 0;
  }
  const diff = Math.abs(shortestAngleDiff(input.axisDeg, input.shadowDirectionDeg));
  return clamp01((35 - diff) / 35);
}

function shortestAngleDiff(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function normalizeVector(vector: { x: number; y: number }) {
  const length = Math.sqrt(vector.x ** 2 + vector.y ** 2);
  if (length < 0.0001) {
    return { x: 0, y: -1 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

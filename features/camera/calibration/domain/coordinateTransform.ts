import type {
  BoardCalibrationProfile,
  BoardPoint,
  BoardScoreResult,
  CalibrationViewportDimensions,
  CalibrationViewportTransform,
  NormalizedPoint,
  ScoreArea,
} from './types';

export const dartboardSegmentOrderClockwise = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const dartboardSegmentWidthDeg = 18;

export function applyPreviewMirror(
  point: NormalizedPoint,
  previewMirrored: boolean,
): NormalizedPoint {
  return previewMirrored ? { x: 1 - point.x, y: point.y } : point;
}

export function removePreviewMirror(
  point: NormalizedPoint,
  previewMirrored: boolean,
): NormalizedPoint {
  return applyPreviewMirror(point, previewMirrored);
}

export function screenPointToCanonicalPoint(
  point: NormalizedPoint,
  profile: Pick<BoardCalibrationProfile, 'previewMirrored'>,
): NormalizedPoint {
  return removePreviewMirror(point, profile.previewMirrored);
}

export function canonicalPointToBoardPoint(
  point: NormalizedPoint,
  profile: BoardCalibrationProfile,
): BoardPoint {
  return canonicalPointToBoardPointInViewport(point, profile, {
    containerWidth: 1,
    containerHeight: 1,
  });
}

export function canonicalPointToBoardPointInViewport(
  point: NormalizedPoint,
  profile: BoardCalibrationProfile,
  dimensions: CalibrationViewportDimensions,
): BoardPoint {
  const transform = getCalibrationViewportTransform({ ...dimensions, profile });
  const pointXPx = point.x * transform.containerWidth;
  const pointYPx = point.y * transform.containerHeight;
  const dx = (pointXPx - transform.canonicalCenterXPx) / transform.outerRadiusPx;
  const dy = (pointYPx - transform.canonicalCenterYPx) / transform.outerRadiusPx;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = normalizeDeg((Math.atan2(dx, -dy) * 180) / Math.PI - profile.rotationDeg);
  return {
    x: dx,
    y: dy,
    radius,
    angleDeg,
  };
}

export function boardPointToScore(
  point: BoardPoint,
  profile: BoardCalibrationProfile,
  sourcePoint: NormalizedPoint = {
    x: profile.centerX + point.x * profile.outerRadius,
    y: profile.centerY + point.y * profile.outerRadius,
  },
): BoardScoreResult {
  if (point.radius > profile.doubleOuterRatio) {
    return createScoreResult('miss', null, 0, 0, point, sourcePoint, []);
  }
  if (point.radius <= profile.innerBullRatio) {
    return createScoreResult('inner_bull', null, 2, 50, point, sourcePoint, []);
  }
  if (point.radius <= profile.outerBullRatio) {
    return createScoreResult('outer_bull', null, 1, 25, point, sourcePoint, [
      { area: 'inner_bull', segmentNumber: null, multiplier: 2, score: 50 },
    ]);
  }

  const segmentIndex = resolveSegmentIndex(point.angleDeg);
  const segmentNumber = dartboardSegmentOrderClockwise[segmentIndex];
  const alternateCandidates = resolveAdjacentSegments(point.angleDeg).map((segment) => ({
    area: 'single' as const,
    segmentNumber: segment,
    multiplier: 1 as const,
    score: segment,
  }));

  if (point.radius >= profile.doubleInnerRatio && point.radius <= profile.doubleOuterRatio) {
    return createScoreResult(
      'double',
      segmentNumber,
      2,
      segmentNumber * 2,
      point,
      sourcePoint,
      alternateCandidates,
    );
  }
  if (point.radius >= profile.tripleInnerRatio && point.radius <= profile.tripleOuterRatio) {
    return createScoreResult(
      'triple',
      segmentNumber,
      3,
      segmentNumber * 3,
      point,
      sourcePoint,
      alternateCandidates,
    );
  }
  return createScoreResult(
    'single',
    segmentNumber,
    1,
    segmentNumber,
    point,
    sourcePoint,
    alternateCandidates,
  );
}

export function scoreCanonicalPoint(
  point: NormalizedPoint,
  profile: BoardCalibrationProfile,
): BoardScoreResult {
  return boardPointToScore(canonicalPointToBoardPoint(point, profile), profile, point);
}

export function scoreCanonicalPointInViewport(
  point: NormalizedPoint,
  profile: BoardCalibrationProfile,
  dimensions: CalibrationViewportDimensions,
): BoardScoreResult {
  return boardPointToScore(
    canonicalPointToBoardPointInViewport(point, profile, dimensions),
    profile,
    point,
  );
}

export function scoreToApproximateBoardPoint(input: {
  area: ScoreArea;
  segmentNumber: number | null;
  profile: BoardCalibrationProfile;
}): NormalizedPoint {
  return scoreToApproximateBoardPointInViewport({
    ...input,
    containerWidth: 1,
    containerHeight: 1,
  });
}

export function scoreToApproximateBoardPointInViewport(
  input: {
    area: ScoreArea;
    segmentNumber: number | null;
    profile: BoardCalibrationProfile;
  } & CalibrationViewportDimensions,
): NormalizedPoint {
  const radius = resolveApproximateRadius(input.area, input.profile);
  const segmentIndex =
    input.segmentNumber == null
      ? 0
      : Math.max(0, dartboardSegmentOrderClockwise.indexOf(input.segmentNumber as never));
  const angle =
    (((segmentIndex * dartboardSegmentWidthDeg + input.profile.rotationDeg) % 360) * Math.PI) / 180;
  const transform = getCalibrationViewportTransform(input);
  const pointXPx =
    transform.canonicalCenterXPx + Math.sin(angle) * radius * transform.outerRadiusPx;
  const pointYPx =
    transform.canonicalCenterYPx - Math.cos(angle) * radius * transform.outerRadiusPx;
  return {
    x: pointXPx / transform.containerWidth,
    y: pointYPx / transform.containerHeight,
  };
}

export function getCalibrationViewportTransform(input: {
  containerWidth: number;
  containerHeight: number;
  profile: BoardCalibrationProfile;
}): CalibrationViewportTransform {
  const containerWidth = Math.max(1, input.containerWidth);
  const containerHeight = Math.max(1, input.containerHeight);
  const baseSize = Math.min(containerWidth, containerHeight);
  const canonicalCenterXPx = input.profile.centerX * containerWidth;
  const canonicalCenterYPx = input.profile.centerY * containerHeight;
  const screenCenter = applyPreviewMirror(
    { x: input.profile.centerX, y: input.profile.centerY },
    input.profile.previewMirrored,
  );
  const outerRadiusPx = input.profile.outerRadius * baseSize;
  const dimensions = { containerWidth, containerHeight };

  const screenToCanonical = (point: NormalizedPoint) =>
    removePreviewMirror(
      {
        x: point.x / containerWidth,
        y: point.y / containerHeight,
      },
      input.profile.previewMirrored,
    );

  const canonicalToScreen = (point: NormalizedPoint) => {
    const mirrored = applyPreviewMirror(point, input.profile.previewMirrored);
    return {
      x: mirrored.x * containerWidth,
      y: mirrored.y * containerHeight,
    };
  };

  return {
    ...dimensions,
    projectionMode: input.profile.projectionMode,
    baseSize,
    centerXPx: screenCenter.x * containerWidth,
    centerYPx: screenCenter.y * containerHeight,
    outerRadiusPx,
    canonicalCenterXPx,
    canonicalCenterYPx,
    screenToCanonical,
    canonicalToScreen,
    screenToBoard: (point) =>
      canonicalPointToBoardPointInViewport(screenToCanonical(point), input.profile, dimensions),
    boardToScreen: (point) =>
      canonicalToScreen(boardPointToCanonicalPointInViewport(point, input.profile, dimensions)),
  };
}

function boardPointToCanonicalPointInViewport(
  point: BoardPoint,
  profile: BoardCalibrationProfile,
  dimensions: CalibrationViewportDimensions,
): NormalizedPoint {
  const transform = getCalibrationViewportTransform({ ...dimensions, profile });
  return {
    x:
      (transform.canonicalCenterXPx + point.x * transform.outerRadiusPx) / transform.containerWidth,
    y:
      (transform.canonicalCenterYPx + point.y * transform.outerRadiusPx) /
      transform.containerHeight,
  };
}

function resolveApproximateRadius(area: ScoreArea, profile: BoardCalibrationProfile) {
  switch (area) {
    case 'inner_bull':
      return profile.innerBullRatio * 0.5;
    case 'outer_bull':
      return (profile.innerBullRatio + profile.outerBullRatio) / 2;
    case 'triple':
      return (profile.tripleInnerRatio + profile.tripleOuterRatio) / 2;
    case 'double':
      return (profile.doubleInnerRatio + profile.doubleOuterRatio) / 2;
    case 'miss':
      return profile.doubleOuterRatio + 0.08;
    case 'single':
    default:
      return (profile.outerBullRatio + profile.tripleInnerRatio) / 2;
  }
}

function createScoreResult(
  area: ScoreArea,
  segmentNumber: number | null,
  multiplier: 0 | 1 | 2 | 3,
  score: number,
  boardPoint: BoardPoint,
  point: NormalizedPoint,
  alternateCandidates: BoardScoreResult['alternateCandidates'],
): BoardScoreResult {
  const segmentIndex = segmentNumber == null ? null : resolveSegmentIndex(boardPoint.angleDeg);
  return {
    area,
    segmentNumber,
    multiplier,
    score,
    normalizedX: point.x,
    normalizedY: point.y,
    boardRadius: boardPoint.radius,
    boardAngleDeg: boardPoint.angleDeg,
    segmentIndex,
    distanceToSegmentBoundaryDeg:
      segmentNumber == null ? null : getDistanceToNearestSegmentBoundaryDeg(boardPoint.angleDeg),
    withinDoubleOuter: boardPoint.radius <= 1,
    alternateCandidates,
  };
}

export function resolveSegmentIndex(angleDeg: number) {
  return (
    Math.round(normalizeDeg(angleDeg) / dartboardSegmentWidthDeg) %
    dartboardSegmentOrderClockwise.length
  );
}

export function getDistanceToNearestSegmentBoundaryDeg(angleDeg: number) {
  const exact = normalizeDeg(angleDeg) / dartboardSegmentWidthDeg;
  const fraction = exact - Math.floor(exact);
  return Math.abs(fraction - 0.5) * dartboardSegmentWidthDeg;
}

function resolveAdjacentSegments(angleDeg: number) {
  const exact = normalizeDeg(angleDeg) / dartboardSegmentWidthDeg;
  const lowerCenter = Math.floor(exact);
  const distanceToBoundary = Math.abs(exact - (lowerCenter + 0.5));
  if (distanceToBoundary > 0.08) {
    return [];
  }
  const leftCenter = lowerCenter % dartboardSegmentOrderClockwise.length;
  const rightCenter = (lowerCenter + 1) % dartboardSegmentOrderClockwise.length;
  return [dartboardSegmentOrderClockwise[leftCenter], dartboardSegmentOrderClockwise[rightCenter]];
}

function normalizeDeg(value: number) {
  return ((value % 360) + 360) % 360;
}

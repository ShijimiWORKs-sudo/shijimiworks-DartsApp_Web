import type {
  BoardCalibrationProfile,
  BoardPoint,
  BoardScoreResult,
  NormalizedPoint,
  ScoreArea,
} from './types';

const wedgeOrderClockwise = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

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
  const dx = (point.x - profile.centerX) / profile.outerRadius;
  const dy = (point.y - profile.centerY) / profile.outerRadius;
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
    return createScoreResult('miss', null, 0, 0, sourcePoint, []);
  }
  if (point.radius <= profile.innerBullRatio) {
    return createScoreResult('inner_bull', null, 2, 50, sourcePoint, []);
  }
  if (point.radius <= profile.outerBullRatio) {
    return createScoreResult('outer_bull', null, 1, 25, sourcePoint, [
      { area: 'inner_bull', segmentNumber: null, multiplier: 2, score: 50 },
    ]);
  }

  const segmentNumber =
    wedgeOrderClockwise[Math.round(point.angleDeg / 18) % wedgeOrderClockwise.length];
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
      sourcePoint,
      alternateCandidates,
    );
  }
  return createScoreResult(
    'single',
    segmentNumber,
    1,
    segmentNumber,
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

export function scoreToApproximateBoardPoint(input: {
  area: ScoreArea;
  segmentNumber: number | null;
  profile: BoardCalibrationProfile;
}): NormalizedPoint {
  const radius = resolveApproximateRadius(input.area, input.profile);
  const segmentIndex =
    input.segmentNumber == null
      ? 0
      : Math.max(0, wedgeOrderClockwise.indexOf(input.segmentNumber as never));
  const angle = (((segmentIndex * 18 + input.profile.rotationDeg) % 360) * Math.PI) / 180;
  return {
    x: input.profile.centerX + Math.sin(angle) * radius * input.profile.outerRadius,
    y: input.profile.centerY - Math.cos(angle) * radius * input.profile.outerRadius,
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
  point: NormalizedPoint,
  alternateCandidates: BoardScoreResult['alternateCandidates'],
): BoardScoreResult {
  return {
    area,
    segmentNumber,
    multiplier,
    score,
    normalizedX: point.x,
    normalizedY: point.y,
    alternateCandidates,
  };
}

function resolveAdjacentSegments(angleDeg: number) {
  const exact = angleDeg / 18;
  if (Math.abs(exact - Math.round(exact)) > 0.08) {
    return [];
  }
  const center = Math.round(exact);
  return [
    wedgeOrderClockwise[(center + 19) % wedgeOrderClockwise.length],
    wedgeOrderClockwise[(center + 1) % wedgeOrderClockwise.length],
  ];
}

function normalizeDeg(value: number) {
  return ((value % 360) + 360) % 360;
}

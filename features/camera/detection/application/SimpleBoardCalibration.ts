import type { LanCameraMultiplier, LanCameraSegment } from '../../lan/domain/protocol';

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type SimpleCalibrationPoints = {
  bullCenter: NormalizedPoint;
  direction20: NormalizedPoint;
  boardTop: NormalizedPoint;
  boardRight: NormalizedPoint;
  boardBottom: NormalizedPoint;
  boardLeft: NormalizedPoint;
};

export type SimpleBoardCalibration = {
  center: NormalizedPoint;
  outerRadius: number;
  wedgeZeroAngleRad: number;
  points: SimpleCalibrationPoints;
  version: 1;
};

export type BoardScoreCandidate = {
  segment: LanCameraSegment;
  multiplier: LanCameraMultiplier;
  normalizedX: number;
  normalizedY: number;
  confidence: number;
};

const wedgeOrderClockwise: LanCameraSegment[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export function createSimpleBoardCalibration(
  points: SimpleCalibrationPoints,
): SimpleBoardCalibration {
  const center = points.bullCenter;
  const radii = [
    distance(center, points.boardTop),
    distance(center, points.boardRight),
    distance(center, points.boardBottom),
    distance(center, points.boardLeft),
  ];
  const outerRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  const wedgeZeroAngleRad = Math.atan2(
    points.direction20.y - center.y,
    points.direction20.x - center.x,
  );

  return {
    version: 1,
    center,
    outerRadius,
    wedgeZeroAngleRad,
    points,
  };
}

export function scoreNormalizedPoint(
  point: NormalizedPoint,
  calibration: SimpleBoardCalibration,
): BoardScoreCandidate {
  const dx = point.x - calibration.center.x;
  const dy = point.y - calibration.center.y;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const normalizedRadius = radius / calibration.outerRadius;

  if (normalizedRadius > 1) {
    return {
      segment: 20,
      multiplier: 0,
      normalizedX: point.x,
      normalizedY: point.y,
      confidence: 0.48,
    };
  }

  if (normalizedRadius <= 0.035) {
    return createCandidate(25, 2, point, 0.92);
  }
  if (normalizedRadius <= 0.085) {
    return createCandidate(25, 1, point, 0.88);
  }

  const angle = Math.atan2(dy, dx);
  const normalizedAngle = normalizeAngle(angle - calibration.wedgeZeroAngleRad);
  const wedgeIndex = Math.round(normalizedAngle / ((Math.PI * 2) / 20)) % 20;
  const segment = wedgeOrderClockwise[wedgeIndex] ?? 20;

  if (normalizedRadius >= 0.58 && normalizedRadius <= 0.66) {
    return createCandidate(segment, 3, point, 0.78);
  }
  if (normalizedRadius >= 0.9 && normalizedRadius <= 1) {
    return createCandidate(segment, 2, point, 0.76);
  }
  return createCandidate(segment, 1, point, 0.72);
}

function createCandidate(
  segment: LanCameraSegment,
  multiplier: LanCameraMultiplier,
  point: NormalizedPoint,
  confidence: number,
): BoardScoreCandidate {
  return {
    segment,
    multiplier,
    normalizedX: point.x,
    normalizedY: point.y,
    confidence,
  };
}

function distance(a: NormalizedPoint, b: NormalizedPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeAngle(angle: number) {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

import type { BoardCalibration, NormalizedPoint } from '../types';

export type BoardPoint = {
  x: number;
  y: number;
};

export type NormalizedBoardCalibration = {
  center: NormalizedPoint;
  outerRadius: number;
  topAngleRadians: number;
};

export function normalizeCalibration(calibration: BoardCalibration): NormalizedBoardCalibration {
  return {
    center: calibration.center,
    outerRadius: Math.max(calibration.outerRadius, 0.0001),
    topAngleRadians: getAngle(calibration.center, calibration.topNumberPoint),
  };
}

export function imagePointToBoardPoint(
  point: NormalizedPoint,
  calibration: BoardCalibration,
): BoardPoint {
  const normalized = normalizeCalibration(calibration);
  const x = (point.x - normalized.center.x) / normalized.outerRadius;
  const y = (point.y - normalized.center.y) / normalized.outerRadius;
  const rotation = -Math.PI / 2 - normalized.topAngleRadians;

  return rotateBoardPoint({ x, y }, rotation);
}

export function boardPointToImagePoint(
  point: BoardPoint,
  calibration: BoardCalibration,
): NormalizedPoint {
  const normalized = normalizeCalibration(calibration);
  const rotation = normalized.topAngleRadians + Math.PI / 2;
  const imageVector = rotateBoardPoint(point, rotation);

  return {
    x: normalized.center.x + imageVector.x * normalized.outerRadius,
    y: normalized.center.y + imageVector.y * normalized.outerRadius,
  };
}

export function rotateBoardPoint(point: BoardPoint, radians: number): BoardPoint {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function getCalibrationTopAngleDegrees(calibration: BoardCalibration) {
  return radiansToDegrees(getAngle(calibration.center, calibration.topNumberPoint));
}

export function getAngle(from: NormalizedPoint, to: NormalizedPoint) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export function getSmallestAngleDifferenceDegrees(fromDegrees: number, toDegrees: number) {
  const difference = Math.abs(((toDegrees - fromDegrees + 540) % 360) - 180);
  return Number.isFinite(difference) ? difference : 0;
}

import type { BoardCalibration, DartHitResult, NormalizedPoint } from '../types';

export const boardNumbersClockwiseFrom20 = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const defaultRingRatios = {
  innerBull: 0.037,
  outerBull: 0.094,
  tripleInner: 0.582,
  tripleOuter: 0.629,
  doubleInner: 0.953,
  doubleOuter: 1,
};

export function calculateDartHit(
  calibration: BoardCalibration,
  point: NormalizedPoint,
  id = 'dart-1',
): DartHitResult {
  const ratio =
    calibration.outerRadius > 0
      ? getDistance(calibration.center, point) / calibration.outerRadius
      : 2;

  if (ratio > defaultRingRatios.doubleOuter) {
    return buildResult(id, point, null, 0, 'out', 0);
  }

  if (ratio <= defaultRingRatios.innerBull) {
    return buildResult(id, point, null, 2, 'doubleBull', 50);
  }

  if (ratio <= defaultRingRatios.outerBull) {
    return buildResult(id, point, null, 1, 'singleBull', 25);
  }

  const number = getBoardNumber(calibration, point);

  if (ratio >= defaultRingRatios.tripleInner && ratio <= defaultRingRatios.tripleOuter) {
    return buildResult(id, point, number, 3, 'triple', number * 3);
  }

  if (ratio >= defaultRingRatios.doubleInner && ratio <= defaultRingRatios.doubleOuter) {
    return buildResult(id, point, number, 2, 'double', number * 2);
  }

  return buildResult(id, point, number, 1, 'single', number);
}

export function calculatePhotoScoreSummary(hits: DartHitResult[]) {
  return {
    totalScore: hits.reduce((total, hit) => total + hit.score, 0),
    bullCount: hits.filter((hit) => hit.area === 'singleBull' || hit.area === 'doubleBull').length,
    tripleCount: hits.filter((hit) => hit.area === 'triple').length,
    doubleCount: hits.filter((hit) => hit.area === 'double' || hit.area === 'doubleBull').length,
  };
}

export function getDistance(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getBoardNumber(calibration: BoardCalibration, point: NormalizedPoint) {
  const topAngle = getAngle(calibration.center, calibration.topNumberPoint);
  const hitAngle = getAngle(calibration.center, point);
  const sectorAngle = (Math.PI * 2) / boardNumbersClockwiseFrom20.length;
  const sectorIndex = normalizeIndex(Math.round(normalizeAngle(hitAngle - topAngle) / sectorAngle));

  return boardNumbersClockwiseFrom20[sectorIndex];
}

function getAngle(center: NormalizedPoint, point: NormalizedPoint) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function normalizeAngle(angle: number) {
  const fullCircle = Math.PI * 2;
  return ((angle % fullCircle) + fullCircle) % fullCircle;
}

function normalizeIndex(index: number) {
  return (
    ((index % boardNumbersClockwiseFrom20.length) + boardNumbersClockwiseFrom20.length) %
    boardNumbersClockwiseFrom20.length
  );
}

function buildResult(
  id: string,
  point: NormalizedPoint,
  number: number | null,
  multiplier: DartHitResult['multiplier'],
  area: DartHitResult['area'],
  score: number,
): DartHitResult {
  return {
    id,
    point,
    number,
    multiplier,
    area,
    score,
  };
}

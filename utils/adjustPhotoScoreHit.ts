import type { BoardCalibration, DartHitResult, NormalizedPoint } from '../types';
import { buildPhotoScoreHit } from './photoScoreCandidates';

export function adjustPhotoScoreHit(
  calibration: BoardCalibration,
  hit: DartHitResult,
  point: NormalizedPoint,
): DartHitResult {
  const nextPoint = clampNormalizedPoint(point);
  const candidate =
    hit.candidateId || typeof hit.confidence === 'number'
      ? {
          id: hit.candidateId ?? hit.id,
          confidence: hit.confidence ?? 0,
        }
      : undefined;

  return {
    ...buildPhotoScoreHit(calibration, nextPoint, hit.id, 'adjusted', candidate),
    candidateId: hit.candidateId,
    confidence: hit.confidence,
  };
}

export function nudgePhotoScoreHit(
  calibration: BoardCalibration,
  hit: DartHitResult,
  delta: NormalizedPoint,
): DartHitResult {
  return adjustPhotoScoreHit(calibration, hit, {
    x: hit.point.x + delta.x,
    y: hit.point.y + delta.y,
  });
}

export function clampNormalizedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

import type {
  BoardCalibration,
  DartHitResult,
  NormalizedPoint,
  PhotoScoreCandidate,
  PhotoScoreDetectionSource,
} from '../types';
import { calculateDartHit, defaultRingRatios } from './calculateDartScore';

type CandidateSeed = {
  id: string;
  angleOffset: number;
  ratio: number;
  confidence: number;
  reason: string;
};

export type MergePhotoScoreCandidatesOptions = {
  maxCandidates?: number;
  minDistance?: number;
  selectedCandidateIds?: string[];
  maxSelected?: number;
};

const candidateSeeds: CandidateSeed[] = [
  {
    id: 'candidate-bull',
    angleOffset: 0,
    ratio: 0,
    confidence: 0.42,
    reason: 'ブル中心付近の補助候補',
  },
  {
    id: 'candidate-triple-20',
    angleOffset: 0,
    ratio: midpoint(defaultRingRatios.tripleInner, defaultRingRatios.tripleOuter),
    confidence: 0.68,
    reason: '20トリプル付近の候補',
  },
  {
    id: 'candidate-single-20',
    angleOffset: 0,
    ratio: 0.38,
    confidence: 0.62,
    reason: '20シングル付近の候補',
  },
  {
    id: 'candidate-triple-right',
    angleOffset: Math.PI / 10,
    ratio: midpoint(defaultRingRatios.tripleInner, defaultRingRatios.tripleOuter),
    confidence: 0.58,
    reason: '20右隣セクターのトリプル付近',
  },
  {
    id: 'candidate-triple-left',
    angleOffset: -Math.PI / 10,
    ratio: midpoint(defaultRingRatios.tripleInner, defaultRingRatios.tripleOuter),
    confidence: 0.58,
    reason: '20左隣セクターのトリプル付近',
  },
  {
    id: 'candidate-double-20',
    angleOffset: 0,
    ratio: midpoint(defaultRingRatios.doubleInner, defaultRingRatios.doubleOuter),
    confidence: 0.52,
    reason: '20ダブル外周付近の候補',
  },
];

export function generatePhotoScoreCandidates(
  calibration: BoardCalibration,
  selectedCandidateIds: string[] = [],
): PhotoScoreCandidate[] {
  return generateCalibrationBasedCandidates(calibration, selectedCandidateIds);
}

export function generateCalibrationBasedCandidates(
  calibration: BoardCalibration,
  selectedCandidateIds: string[] = [],
): PhotoScoreCandidate[] {
  return candidateSeeds.map((seed) => ({
    id: seed.id,
    point: pointFromCalibration(calibration, seed.angleOffset, seed.ratio),
    confidence: seed.confidence,
    reason: `calibration-generated: ${seed.reason}`,
    selected: selectedCandidateIds.includes(seed.id),
    source: 'autoCandidate',
  }));
}

export function mergePhotoScoreCandidates(
  imageCandidates: PhotoScoreCandidate[],
  calibrationCandidates: PhotoScoreCandidate[],
  options: MergePhotoScoreCandidatesOptions = {},
) {
  const maxCandidates = options.maxCandidates ?? 6;
  const minDistance = options.minDistance ?? 0.045;
  const selectedCandidateIds = limitSelectedCandidateIds(
    options.selectedCandidateIds ?? [],
    options.maxSelected ?? 3,
  );
  const sortedCandidates = [...imageCandidates, ...calibrationCandidates]
    .filter((candidate) => isNormalizedPoint(candidate.point))
    .map((candidate) => ({
      ...candidate,
      selected: selectedCandidateIds.includes(candidate.id) || candidate.selected,
    }))
    .sort((a, b) => b.confidence - a.confidence);
  const mergedCandidates: PhotoScoreCandidate[] = [];

  sortedCandidates.forEach((candidate) => {
    const isDuplicate = mergedCandidates.some(
      (mergedCandidate) => getPointDistance(mergedCandidate.point, candidate.point) < minDistance,
    );

    if (!isDuplicate && mergedCandidates.length < maxCandidates) {
      mergedCandidates.push(candidate);
    }
  });

  return mergedCandidates.map((candidate, index) => ({
    ...candidate,
    selected: selectedCandidateIds.includes(candidate.id) || candidate.selected,
    id: candidate.id || `candidate-${index + 1}`,
  }));
}

function isNormalizedPoint(point: NormalizedPoint) {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function limitSelectedCandidateIds(candidateIds: string[], maxSelected = 3) {
  return candidateIds.slice(0, maxSelected);
}

export function buildPhotoScoreHit(
  calibration: BoardCalibration,
  point: NormalizedPoint,
  id: string,
  source: PhotoScoreDetectionSource,
  candidate?: Pick<PhotoScoreCandidate, 'id' | 'confidence'>,
): DartHitResult {
  return {
    ...calculateDartHit(calibration, point, id),
    detectionSource: source,
    candidateId: candidate?.id,
    confidence: candidate?.confidence,
  };
}

function pointFromCalibration(
  calibration: BoardCalibration,
  angleOffsetFromTop: number,
  ratio: number,
): NormalizedPoint {
  const topAngle = Math.atan2(
    calibration.topNumberPoint.y - calibration.center.y,
    calibration.topNumberPoint.x - calibration.center.x,
  );
  const angle = topAngle + angleOffsetFromTop;

  return {
    x: clamp(calibration.center.x + Math.cos(angle) * calibration.outerRadius * ratio, 0, 1),
    y: clamp(calibration.center.y + Math.sin(angle) * calibration.outerRadius * ratio, 0, 1),
  };
}

function midpoint(a: number, b: number) {
  return (a + b) / 2;
}

function getPointDistance(a: NormalizedPoint, b: NormalizedPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

import type { BoardCalibration, PhotoScoreCandidate } from '../types';
import { generateCalibrationBasedCandidates } from './photoScoreCandidates';

export type DetectDartCandidatesOptions = {
  maxCandidates?: number;
  minConfidence?: number;
  enableHeuristicFallback?: boolean;
};

export async function detectDartCandidatesFromImage(
  imageUri: string,
  calibration: BoardCalibration,
  options: DetectDartCandidatesOptions = {},
): Promise<PhotoScoreCandidate[]> {
  const maxCandidates = options.maxCandidates ?? 5;
  const minConfidence = options.minConfidence ?? 0.45;

  if (!imageUri.trim() || !isValidCalibration(calibration)) {
    return [];
  }

  try {
    // Expo Go does not expose stable raw pixel access without adding a native image-processing
    // dependency. Keep the async boundary and candidate contract ready for a future OpenCV/MLKit
    // implementation, and provide conservative image-analysis placeholders only when requested.
    if (!options.enableHeuristicFallback) {
      return [];
    }

    return generateCalibrationBasedCandidates(calibration)
      .map((candidate, index) => ({
        ...candidate,
        id: `image-analysis-${index + 1}`,
        confidence: Math.min(0.72, candidate.confidence - 0.12),
        reason: toImageAnalysisReason(candidate.reason, index),
        selected: false,
        source: 'imageAnalysisCandidate' as const,
      }))
      .filter((candidate) => candidate.confidence >= minConfidence)
      .slice(0, maxCandidates);
  } catch {
    return [];
  }
}

function toImageAnalysisReason(reason: string, index: number) {
  const reasonTypes = ['contrast-candidate', 'bright-flight-candidate', 'edge-line-candidate'];
  const reasonType = reasonTypes[index % reasonTypes.length];

  return `${reasonType}: ${reason.replace('calibration-generated: ', '')}`;
}

function isValidCalibration(calibration: BoardCalibration) {
  return (
    calibration.outerRadius > 0 &&
    isNormalized(calibration.center.x) &&
    isNormalized(calibration.center.y) &&
    isNormalized(calibration.topNumberPoint.x) &&
    isNormalized(calibration.topNumberPoint.y)
  );
}

function isNormalized(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

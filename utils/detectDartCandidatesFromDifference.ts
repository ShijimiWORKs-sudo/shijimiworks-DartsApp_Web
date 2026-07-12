import type {
  BoardCalibration,
  BoardReferenceImage,
  DifferenceDetectionResult,
  PhotoDetectionQuality,
  PhotoScoreCandidate,
} from '../types';
import { detectDartCandidatesFromImage } from './detectDartCandidatesFromImage';
import { evaluatePhotoDetectionQuality } from './evaluatePhotoDetectionQuality';
import { generateCalibrationBasedCandidates } from './photoScoreCandidates';

type DetectDartCandidatesFromDifferenceParams = {
  referenceImage: BoardReferenceImage | null;
  currentImageUri: string;
  currentCalibration: BoardCalibration;
  maxCandidates?: number;
};

export async function detectDartCandidatesFromDifference({
  referenceImage,
  currentImageUri,
  currentCalibration,
  maxCandidates = 5,
}: DetectDartCandidatesFromDifferenceParams): Promise<DifferenceDetectionResult> {
  if (!referenceImage || !validateReferenceCompatibility(referenceImage, currentCalibration)) {
    const quality = createFallbackQuality(
      '登録済みの基準画像がない、またはボード種別が一致しません。',
    );

    return {
      candidates: fallbackToCalibrationCandidates(currentCalibration, maxCandidates),
      quality,
      detectionMethod: 'calibrationFallback',
      warnings: quality.warnings,
    };
  }

  const quality = estimateAlignmentQuality(referenceImage, currentCalibration);
  const differenceCandidates = await detectDifferenceCandidates({
    referenceImage,
    currentImageUri,
    currentCalibration,
    maxCandidates,
  });

  if (differenceCandidates.length > 0) {
    return {
      candidates: differenceCandidates,
      quality,
      detectionMethod: 'referenceDifference',
      warnings: quality.warnings,
    };
  }

  const singleImageCandidates = await fallbackToSingleImageCandidates(
    currentImageUri,
    currentCalibration,
    maxCandidates,
  );

  if (singleImageCandidates.length > 0) {
    return {
      candidates: singleImageCandidates,
      quality,
      detectionMethod: 'singleImageHeuristic',
      warnings: [
        ...quality.warnings,
        'MVPでは実ピクセル差分は未実装のため、単一画像の自動候補βへフォールバックしています。',
      ],
    };
  }

  return {
    candidates: fallbackToCalibrationCandidates(currentCalibration, maxCandidates),
    quality,
    detectionMethod: 'calibrationFallback',
    warnings: [
      ...quality.warnings,
      '画像候補を作れなかったため、キャリブレーション位置から補助候補を表示しています。',
    ],
  };
}

export function validateReferenceCompatibility(
  referenceImage: BoardReferenceImage,
  currentCalibration: BoardCalibration,
) {
  return referenceImage.boardType === currentCalibration.boardType;
}

export function estimateAlignmentQuality(
  referenceImage: BoardReferenceImage,
  currentCalibration: BoardCalibration,
): PhotoDetectionQuality {
  return evaluatePhotoDetectionQuality(referenceImage, currentCalibration);
}

export async function detectDifferenceCandidates(_params: {
  referenceImage: BoardReferenceImage;
  currentImageUri: string;
  currentCalibration: BoardCalibration;
  maxCandidates: number;
}): Promise<PhotoScoreCandidate[]> {
  // Expo Go MVP: keep the interface ready for future pixel-difference detection.
  // Real image differencing will be implemented behind this function when a
  // supported pixel pipeline or development build is introduced.
  return [];
}

export async function fallbackToSingleImageCandidates(
  currentImageUri: string,
  currentCalibration: BoardCalibration,
  maxCandidates: number,
) {
  return detectDartCandidatesFromImage(currentImageUri, currentCalibration, {
    maxCandidates,
    minConfidence: 0.45,
    enableHeuristicFallback: true,
  });
}

function fallbackToCalibrationCandidates(
  currentCalibration: BoardCalibration,
  maxCandidates: number,
) {
  return generateCalibrationBasedCandidates(currentCalibration).slice(0, maxCandidates);
}

function createFallbackQuality(warning: string): PhotoDetectionQuality {
  return {
    isUsable: false,
    centerDistance: 0,
    radiusDifference: 0,
    rotationDifferenceDegrees: 0,
    aspectRatioDifference: 0,
    scaleDifference: 0,
    warnings: [warning],
  };
}

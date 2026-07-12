import type { BoardCalibration, BoardReferenceImage, PhotoDetectionQuality } from '../types';
import {
  getCalibrationTopAngleDegrees,
  getSmallestAngleDifferenceDegrees,
} from './boardCoordinateTransform';

export const photoDetectionQualityThresholds = {
  centerWarning: 0.04,
  centerUsable: 0.08,
  radiusWarning: 0.1,
  radiusUsable: 0.18,
  rotationWarningDegrees: 8,
  rotationUsableDegrees: 18,
  aspectRatioWarning: 0.08,
} as const;

export type ImageSize = {
  width: number;
  height: number;
};

export function evaluatePhotoDetectionQuality(
  referenceImage: BoardReferenceImage,
  currentCalibration: BoardCalibration,
  currentImageSize?: ImageSize,
): PhotoDetectionQuality {
  const centerDistance = calculateCenterDistance(referenceImage.calibration, currentCalibration);
  const radiusDifference = calculateRadiusDifference(
    referenceImage.calibration,
    currentCalibration,
  );
  const rotationDifferenceDegrees = calculateRotationDifferenceDegrees(
    referenceImage.calibration,
    currentCalibration,
  );
  const aspectRatioDifference = calculateAspectRatioDifference(referenceImage, currentImageSize);
  const scaleDifference = radiusDifference;
  const warnings = buildQualityWarnings({
    centerDistance,
    radiusDifference,
    rotationDifferenceDegrees,
    aspectRatioDifference,
  });

  return {
    isUsable:
      centerDistance <= photoDetectionQualityThresholds.centerUsable &&
      radiusDifference <= photoDetectionQualityThresholds.radiusUsable &&
      rotationDifferenceDegrees <= photoDetectionQualityThresholds.rotationUsableDegrees,
    centerDistance,
    radiusDifference,
    rotationDifferenceDegrees,
    aspectRatioDifference,
    scaleDifference,
    warnings,
  };
}

export function calculateCenterDistance(
  referenceCalibration: BoardCalibration,
  currentCalibration: BoardCalibration,
) {
  return Math.hypot(
    currentCalibration.center.x - referenceCalibration.center.x,
    currentCalibration.center.y - referenceCalibration.center.y,
  );
}

export function calculateRadiusDifference(
  referenceCalibration: BoardCalibration,
  currentCalibration: BoardCalibration,
) {
  const referenceRadius = Math.max(referenceCalibration.outerRadius, 0.0001);

  return Math.abs(currentCalibration.outerRadius - referenceRadius) / referenceRadius;
}

export function calculateRotationDifferenceDegrees(
  referenceCalibration: BoardCalibration,
  currentCalibration: BoardCalibration,
) {
  return getSmallestAngleDifferenceDegrees(
    getCalibrationTopAngleDegrees(referenceCalibration),
    getCalibrationTopAngleDegrees(currentCalibration),
  );
}

function calculateAspectRatioDifference(
  referenceImage: BoardReferenceImage,
  currentImageSize?: ImageSize,
) {
  if (
    !referenceImage.imageWidth ||
    !referenceImage.imageHeight ||
    !currentImageSize?.width ||
    !currentImageSize.height
  ) {
    return 0;
  }

  const referenceRatio = referenceImage.imageWidth / referenceImage.imageHeight;
  const currentRatio = currentImageSize.width / currentImageSize.height;

  return Math.abs(currentRatio - referenceRatio) / referenceRatio;
}

function buildQualityWarnings(metrics: {
  centerDistance: number;
  radiusDifference: number;
  rotationDifferenceDegrees: number;
  aspectRatioDifference: number;
}) {
  const warnings: string[] = [];

  if (metrics.centerDistance > photoDetectionQualityThresholds.centerUsable) {
    warnings.push(
      '基準画像と現在画像の中心位置が大きくズレています。撮影位置を合わせ直してください。',
    );
  } else if (metrics.centerDistance > photoDetectionQualityThresholds.centerWarning) {
    warnings.push('中心位置に少しズレがあります。候補は目安として確認してください。');
  }

  if (metrics.radiusDifference > photoDetectionQualityThresholds.radiusUsable) {
    warnings.push('ボードの大きさが基準画像と大きく違います。距離やズームを合わせ直してください。');
  } else if (metrics.radiusDifference > photoDetectionQualityThresholds.radiusWarning) {
    warnings.push('ボードの大きさに差があります。候補がズレる可能性があります。');
  }

  if (metrics.rotationDifferenceDegrees > photoDetectionQualityThresholds.rotationUsableDegrees) {
    warnings.push('20方向の角度が基準画像と大きく違います。ボードの回転を確認してください。');
  } else if (
    metrics.rotationDifferenceDegrees > photoDetectionQualityThresholds.rotationWarningDegrees
  ) {
    warnings.push('20方向の角度に少し差があります。候補は手動で確認してください。');
  }

  if (metrics.aspectRatioDifference > photoDetectionQualityThresholds.aspectRatioWarning) {
    warnings.push('画像の縦横比が基準画像と違います。写真の向きや切り抜きを確認してください。');
  }

  return warnings;
}

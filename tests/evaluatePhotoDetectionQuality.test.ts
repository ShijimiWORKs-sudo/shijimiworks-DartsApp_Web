import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration, BoardReferenceImage } from '../types';
import { evaluatePhotoDetectionQuality } from '../utils/evaluatePhotoDetectionQuality';

const referenceCalibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

const referenceImage: BoardReferenceImage = {
  id: 'reference',
  boardType: 'DARTSLIVE_ZERO',
  imageUri: 'file://reference.jpg',
  createdAt: '2026-07-10T00:00:00.000Z',
  calibration: referenceCalibration,
  imageWidth: 1200,
  imageHeight: 1600,
};

test('evaluatePhotoDetectionQuality accepts aligned calibration', () => {
  const quality = evaluatePhotoDetectionQuality(referenceImage, referenceCalibration, {
    width: 1200,
    height: 1600,
  });

  assert.equal(quality.isUsable, true);
  assert.equal(quality.warnings.length, 0);
  assert.equal(quality.centerDistance, 0);
  assert.equal(quality.radiusDifference, 0);
});

test('evaluatePhotoDetectionQuality warns about center shift', () => {
  const quality = evaluatePhotoDetectionQuality(referenceImage, {
    ...referenceCalibration,
    center: { x: 0.62, y: 0.5 },
  });

  assert.equal(quality.isUsable, false);
  assert.ok(quality.centerDistance > 0.08);
  assert.ok(quality.warnings.some((warning) => warning.includes('中心位置')));
});

test('evaluatePhotoDetectionQuality warns about radius and rotation differences', () => {
  const quality = evaluatePhotoDetectionQuality(referenceImage, {
    ...referenceCalibration,
    topNumberPoint: { x: 0.65, y: 0.2 },
    outerRadius: 0.28,
  });

  assert.equal(quality.isUsable, false);
  assert.ok(quality.radiusDifference > 0.18);
  assert.ok(quality.rotationDifferenceDegrees > 18);
  assert.ok(quality.warnings.some((warning) => warning.includes('大きさ')));
  assert.ok(quality.warnings.some((warning) => warning.includes('20方向')));
});

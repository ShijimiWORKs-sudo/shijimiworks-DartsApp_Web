import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration, BoardReferenceImage } from '../types';
import {
  detectDartCandidatesFromDifference,
  validateReferenceCompatibility,
} from '../utils/detectDartCandidatesFromDifference';

const calibration: BoardCalibration = {
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
  calibration,
};

test('validateReferenceCompatibility checks board type', () => {
  assert.equal(validateReferenceCompatibility(referenceImage, calibration), true);
  assert.equal(
    validateReferenceCompatibility(referenceImage, {
      ...calibration,
      boardType: 'CORK',
    }),
    false,
  );
});

test('detectDartCandidatesFromDifference falls back to single image heuristic', async () => {
  const result = await detectDartCandidatesFromDifference({
    referenceImage,
    currentImageUri: 'file://current.jpg',
    currentCalibration: calibration,
    maxCandidates: 4,
  });

  assert.equal(result.detectionMethod, 'singleImageHeuristic');
  assert.equal(result.quality.isUsable, true);
  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.length <= 4);
  assert.ok(result.candidates.every((candidate) => candidate.selected === false));
});

test('detectDartCandidatesFromDifference falls back to calibration candidates without reference', async () => {
  const result = await detectDartCandidatesFromDifference({
    referenceImage: null,
    currentImageUri: 'file://current.jpg',
    currentCalibration: calibration,
    maxCandidates: 3,
  });

  assert.equal(result.detectionMethod, 'calibrationFallback');
  assert.equal(result.quality.isUsable, false);
  assert.equal(result.candidates.length, 3);
  assert.ok(result.warnings.some((warning) => warning.includes('基準画像')));
});

test('detectDartCandidatesFromDifference still returns fallback when image uri is unavailable', async () => {
  const result = await detectDartCandidatesFromDifference({
    referenceImage,
    currentImageUri: '',
    currentCalibration: calibration,
    maxCandidates: 2,
  });

  assert.equal(result.detectionMethod, 'calibrationFallback');
  assert.equal(result.candidates.length, 2);
});

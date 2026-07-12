import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration, DartHitResult } from '../types';
import {
  adjustPhotoScoreHit,
  clampNormalizedPoint,
  nudgePhotoScoreHit,
} from '../utils/adjustPhotoScoreHit';
import { buildPhotoScoreHit } from '../utils/photoScoreCandidates';

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

const baseHit: DartHitResult = buildPhotoScoreHit(
  calibration,
  { x: 0.5, y: 0.32 },
  'dart-1',
  'manualTap',
);

test('nudgePhotoScoreHit moves point and marks source as adjusted', () => {
  const adjustedHit = nudgePhotoScoreHit(calibration, baseHit, { x: 0.003, y: -0.003 });

  assert.equal(adjustedHit.detectionSource, 'adjusted');
  assert.equal(adjustedHit.point.x, 0.503);
  assert.equal(adjustedHit.point.y, 0.317);
});

test('adjustPhotoScoreHit clamps normalized point to image bounds', () => {
  const adjustedHit = adjustPhotoScoreHit(calibration, baseHit, { x: 1.5, y: -0.4 });

  assert.equal(adjustedHit.point.x, 1);
  assert.equal(adjustedHit.point.y, 0);
  assert.equal(adjustedHit.detectionSource, 'adjusted');
});

test('clampNormalizedPoint keeps valid points unchanged', () => {
  assert.deepEqual(clampNormalizedPoint({ x: 0.25, y: 0.75 }), { x: 0.25, y: 0.75 });
});

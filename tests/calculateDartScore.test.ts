import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDartHit,
  calculatePhotoScoreSummary,
  defaultRingRatios,
} from '../utils/calculateDartScore';
import type { BoardCalibration, NormalizedPoint } from '../types';

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

test('calculateDartHit detects double bull', () => {
  const hit = calculateDartHit(calibration, { x: 0.5, y: 0.5 }, 'dart-1');

  assert.equal(hit.area, 'doubleBull');
  assert.equal(hit.score, 50);
});

test('calculateDartHit detects triple 20', () => {
  const hit = calculateDartHit(
    calibration,
    pointAtRatio(0, midpoint(defaultRingRatios.tripleInner, defaultRingRatios.tripleOuter)),
    'dart-1',
  );

  assert.equal(hit.number, 20);
  assert.equal(hit.area, 'triple');
  assert.equal(hit.score, 60);
});

test('calculateDartHit detects double sector', () => {
  const hit = calculateDartHit(
    calibration,
    pointAtRatio(
      Math.PI / 2,
      midpoint(defaultRingRatios.doubleInner, defaultRingRatios.doubleOuter),
    ),
    'dart-1',
  );

  assert.equal(hit.number, 6);
  assert.equal(hit.area, 'double');
  assert.equal(hit.score, 12);
});

test('calculateDartHit detects out area', () => {
  const hit = calculateDartHit(calibration, pointAtRatio(0, 1.1), 'dart-1');

  assert.equal(hit.area, 'out');
  assert.equal(hit.score, 0);
});

test('calculateDartHit respects calibrated 20 direction', () => {
  const rotatedCalibration: BoardCalibration = {
    ...calibration,
    topNumberPoint: { x: 0.9, y: 0.5 },
  };
  const hit = calculateDartHit(rotatedCalibration, { x: 0.5, y: 0.9 }, 'dart-1');

  assert.equal(hit.number, 6);
});

test('calculatePhotoScoreSummary aggregates hit counts', () => {
  const hits = [
    calculateDartHit(calibration, { x: 0.5, y: 0.5 }, 'dart-1'),
    calculateDartHit(
      calibration,
      pointAtRatio(0, midpoint(defaultRingRatios.tripleInner, defaultRingRatios.tripleOuter)),
      'dart-2',
    ),
    calculateDartHit(
      calibration,
      pointAtRatio(
        Math.PI / 2,
        midpoint(defaultRingRatios.doubleInner, defaultRingRatios.doubleOuter),
      ),
      'dart-3',
    ),
  ];
  const summary = calculatePhotoScoreSummary(hits);

  assert.equal(summary.totalScore, 122);
  assert.equal(summary.bullCount, 1);
  assert.equal(summary.tripleCount, 1);
  assert.equal(summary.doubleCount, 2);
});

function pointAtRatio(angleFromTopClockwise: number, ratio: number): NormalizedPoint {
  const topAngle = -Math.PI / 2;
  const angle = topAngle + angleFromTopClockwise;

  return {
    x: calibration.center.x + Math.cos(angle) * calibration.outerRadius * ratio,
    y: calibration.center.y + Math.sin(angle) * calibration.outerRadius * ratio,
  };
}

function midpoint(a: number, b: number) {
  return (a + b) / 2;
}

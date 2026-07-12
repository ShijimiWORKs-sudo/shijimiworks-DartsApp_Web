import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration, DartHitResult, NormalizedPoint } from '../types';
import { analyzePhotoScoreGrouping } from '../utils/analyzePhotoScoreGrouping';
import { calculateDartHit } from '../utils/calculateDartScore';

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

test('analyzePhotoScoreGrouping detects tight grouping', () => {
  const analysis = analyzePhotoScoreGrouping(
    buildHits([
      { x: 0.5, y: 0.5 },
      { x: 0.52, y: 0.5 },
      { x: 0.51, y: 0.52 },
    ]),
    calibration,
  );

  assert.equal(analysis.groupingQuality, 'good');
  assert.equal(analysis.spreadPattern, 'tight');
  assert.ok(analysis.adviceTexts.length > 0);
});

test('analyzePhotoScoreGrouping detects vertical spread', () => {
  const analysis = analyzePhotoScoreGrouping(
    buildHits([
      { x: 0.5, y: 0.34 },
      { x: 0.51, y: 0.5 },
      { x: 0.5, y: 0.66 },
    ]),
    calibration,
  );

  assert.equal(analysis.spreadPattern, 'vertical');
  assert.ok(analysis.adviceCategories.includes('release'));
});

test('analyzePhotoScoreGrouping detects horizontal spread', () => {
  const analysis = analyzePhotoScoreGrouping(
    buildHits([
      { x: 0.34, y: 0.5 },
      { x: 0.5, y: 0.51 },
      { x: 0.66, y: 0.5 },
    ]),
    calibration,
  );

  assert.equal(analysis.spreadPattern, 'horizontal');
  assert.ok(analysis.adviceCategories.includes('stance'));
});

test('analyzePhotoScoreGrouping detects high and right bias', () => {
  const analysis = analyzePhotoScoreGrouping(
    buildHits([
      { x: 0.62, y: 0.35 },
      { x: 0.63, y: 0.36 },
      { x: 0.61, y: 0.37 },
    ]),
    calibration,
  );

  assert.equal(analysis.verticalBias, 'high');
  assert.equal(analysis.horizontalBias, 'right');
});

test('analyzePhotoScoreGrouping safely handles empty hits', () => {
  const analysis = analyzePhotoScoreGrouping([], calibration);

  assert.equal(analysis.groupingQuality, 'unknown');
  assert.equal(analysis.spreadPattern, 'unknown');
  assert.ok(analysis.recommendedPracticeMenuIds.length > 0);
});

function buildHits(points: NormalizedPoint[]): DartHitResult[] {
  return points.map((point, index) => calculateDartHit(calibration, point, `dart-${index + 1}`));
}

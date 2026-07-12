import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateContainedImageRect,
  denormalizePoint,
  normalizeTapPoint,
} from '../utils/imageCoordinateMapping';

test('calculateContainedImageRect preserves a wide image aspect ratio with vertical padding', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 400, height: 200 },
  );

  assert.equal(rect.x, 0);
  assert.equal(rect.y, 75);
  assert.equal(rect.width, 300);
  assert.equal(rect.height, 150);
});

test('normalizeTapPoint maps taps correctly when vertical padding exists', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 400, height: 200 },
  );
  const point = normalizeTapPoint({ x: 150, y: 150 }, rect);

  assert.deepEqual(point, { x: 0.5, y: 0.5 });
});

test('calculateContainedImageRect preserves a tall image aspect ratio with horizontal padding', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 200, height: 400 },
  );

  assert.equal(rect.x, 75);
  assert.equal(rect.y, 0);
  assert.equal(rect.width, 150);
  assert.equal(rect.height, 300);
});

test('normalizeTapPoint maps taps correctly when horizontal padding exists', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 200, height: 400 },
  );
  const point = normalizeTapPoint({ x: 150, y: 150 }, rect);

  assert.deepEqual(point, { x: 0.5, y: 0.5 });
});

test('normalizeTapPoint returns null for taps outside displayed image rect', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 200, height: 400 },
  );

  assert.equal(normalizeTapPoint({ x: 20, y: 150 }, rect), null);
});

test('denormalizePoint maps normalized points back to displayed coordinates', () => {
  const rect = calculateContainedImageRect(
    { width: 300, height: 300 },
    { width: 400, height: 200 },
  );

  assert.deepEqual(denormalizePoint({ x: 0.25, y: 0.5 }, rect), { x: 75, y: 150 });
});

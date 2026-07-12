import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration } from '../types';
import {
  boardPointToImagePoint,
  imagePointToBoardPoint,
  rotateBoardPoint,
} from '../utils/boardCoordinateTransform';

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

test('imagePointToBoardPoint maps top direction to board up', () => {
  const point = imagePointToBoardPoint(calibration.topNumberPoint, calibration);

  assert.ok(Math.abs(point.x) < 0.000001);
  assert.ok(Math.abs(point.y + 1) < 0.000001);
});

test('boardPointToImagePoint reverses imagePointToBoardPoint', () => {
  const imagePoint = { x: 0.62, y: 0.42 };
  const boardPoint = imagePointToBoardPoint(imagePoint, calibration);
  const restoredPoint = boardPointToImagePoint(boardPoint, calibration);

  assert.ok(Math.abs(restoredPoint.x - imagePoint.x) < 0.000001);
  assert.ok(Math.abs(restoredPoint.y - imagePoint.y) < 0.000001);
});

test('rotateBoardPoint rotates by radians', () => {
  const point = rotateBoardPoint({ x: 1, y: 0 }, Math.PI / 2);

  assert.ok(Math.abs(point.x) < 0.000001);
  assert.ok(Math.abs(point.y - 1) < 0.000001);
});

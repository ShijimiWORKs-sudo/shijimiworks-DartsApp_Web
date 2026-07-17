import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeFrameMotion,
  throwDetectionThresholds,
  type CameraAnalysisFrame,
} from '../../features/camera/detection/application/CameraFrameSource';
import { createDefaultCalibrationProfile } from '../../features/camera/calibration/domain/profile';

test('real camera frame source contract keeps baseline frames in memory only', () => {
  const frame = createFrame('baseline', 20, 20);

  assert.equal(frame.frameId, 'baseline');
  assert.equal(frame.grayPixels.length, 400);
  assert.equal(frame.capturedAt, '2026-07-17T00:00:00.000Z');
});

test('motion analysis detects throw movement and obstruction inside calibration circle', () => {
  const profile = createDefaultCalibrationProfile();
  const baseline = createFrame('baseline', 40, 40);
  const motion = createFrame('motion', 40, 40);
  for (let y = 18; y <= 22; y += 1) {
    for (let x = 18; x <= 22; x += 1) {
      motion.grayPixels[y * 40 + x] = 255;
    }
  }

  const result = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: motion,
    calibration: profile,
  });

  assert.equal(result.reason, 'motion');
  assert.ok(result.changedPixelRatio >= throwDetectionThresholds.motionStartRatio);
  assert.ok(result.boundingBox);

  const obstruction = createFrame('obstruction', 40, 40, 255);
  const obstructionResult = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: obstruction,
    calibration: profile,
  });
  assert.equal(obstructionResult.reason, 'obstruction');
});

test('motion analysis returns stable when frame difference is below stable threshold', () => {
  const profile = createDefaultCalibrationProfile();
  const baseline = createFrame('baseline', 40, 40);
  const stable = createFrame('stable', 40, 40);

  const result = analyzeFrameMotion({
    baselineFrame: baseline,
    currentFrame: stable,
    calibration: profile,
  });

  assert.equal(result.reason, 'stable');
  assert.ok(result.changedPixelRatio <= throwDetectionThresholds.stableRatio);
});

function createFrame(
  frameId: string,
  width: number,
  height: number,
  fill = 0,
): CameraAnalysisFrame {
  return {
    frameId,
    width,
    height,
    grayPixels: new Uint8Array(width * height).fill(fill),
    capturedAt: '2026-07-17T00:00:00.000Z',
  };
}

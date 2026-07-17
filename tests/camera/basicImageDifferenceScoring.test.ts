import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeImageDifference,
  createReplayDifferenceFrames,
} from '../../features/camera/detection/application/BasicImageDifferenceScoring';
import {
  createSimpleBoardCalibration,
  scoreNormalizedPoint,
} from '../../features/camera/detection/application/SimpleBoardCalibration';
import { createDefaultCalibrationProfile } from '../../features/camera/calibration/domain/profile';

const calibration = createSimpleBoardCalibration({
  bullCenter: { x: 0.5, y: 0.5 },
  direction20: { x: 0.5, y: 0.1 },
  boardTop: { x: 0.5, y: 0.02 },
  boardRight: { x: 0.98, y: 0.5 },
  boardBottom: { x: 0.5, y: 0.98 },
  boardLeft: { x: 0.02, y: 0.5 },
});

test('simple calibration maps bull center to inner bull', () => {
  const result = scoreNormalizedPoint({ x: 0.5, y: 0.5 }, calibration);

  assert.equal(result.segment, 25);
  assert.equal(result.multiplier, 2);
});

test('simple calibration maps 20 direction triple ring to T20', () => {
  const result = scoreNormalizedPoint({ x: 0.5, y: 0.2 }, calibration);

  assert.equal(result.segment, 20);
  assert.equal(result.multiplier, 3);
});

test('basic image difference generates a camera candidate from strongest changed pixel', () => {
  const baselineFrame = createFrame(5, 5);
  const thrownFrame = createFrame(5, 5);
  thrownFrame.pixels[2] = 255;

  const result = analyzeImageDifference({
    sessionId: 'local-count-up',
    cameraNodeId: 'camera-pc',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration,
    threshold: 20,
    now: new Date('2026-07-16T00:00:00.000Z'),
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    assert.equal(result.candidate.type, 'detection_candidate');
    assert.equal(result.candidate.segment, 20);
    assert.ok(result.changedPixelRatio > 0);
    assert.ok(result.boundingBox);
  }
});

test('basic image difference returns no_candidate when no significant change exists', () => {
  const result = analyzeImageDifference({
    sessionId: 'local-count-up',
    cameraNodeId: 'camera-pc',
    throwIndex: 1,
    baselineFrame: createFrame(3, 3),
    thrownFrame: createFrame(3, 3),
    calibration,
    threshold: 20,
  });

  assert.equal(result.status, 'no_candidate');
  if (result.status === 'no_candidate') {
    assert.equal(result.reason, 'NO_SIGNIFICANT_CHANGE');
  }
});

test('basic image difference replay fixture generates deterministic calibrated candidates', () => {
  const profile = createDefaultCalibrationProfile(new Date('2026-07-17T00:00:00.000Z'));
  const frames = createReplayDifferenceFrames({
    width: 32,
    height: 32,
    changedX: profile.centerX,
    changedY: profile.centerY - profile.outerRadius * 0.58,
  });

  const first = analyzeImageDifference({
    sessionId: 'local-count-up',
    cameraNodeId: 'camera-pc',
    throwIndex: 1,
    baselineFrame: frames.baselineFrame,
    thrownFrame: frames.thrownFrame,
    calibration: profile,
    threshold: 20,
    now: new Date('2026-07-17T00:00:00.000Z'),
    random: () => 0.42,
  });
  const second = analyzeImageDifference({
    sessionId: 'local-count-up',
    cameraNodeId: 'camera-pc',
    throwIndex: 1,
    baselineFrame: frames.baselineFrame,
    thrownFrame: frames.thrownFrame,
    calibration: profile,
    threshold: 20,
    now: new Date('2026-07-17T00:00:00.000Z'),
    random: () => 0.42,
  });

  assert.equal(first.status, 'candidate');
  assert.equal(second.status, 'candidate');
  if (first.status === 'candidate' && second.status === 'candidate') {
    assert.deepEqual(first.candidate, second.candidate);
  }
});

test('basic image difference can return alternate candidates from the same real frame pair', () => {
  const baselineFrame = createFrame(10, 10);
  const thrownFrame = createFrame(10, 10);
  thrownFrame.pixels[1 * 10 + 5] = 255;
  thrownFrame.pixels[5 * 10 + 5] = 230;
  thrownFrame.pixels[8 * 10 + 8] = 220;

  const result = analyzeImageDifference({
    sessionId: 'session-real-frame',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    assert.equal(result.alternateCandidates.length, 2);
    assert.equal(result.candidate.type, 'detection_candidate');
  }
});

function createFrame(width: number, height: number) {
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height),
  };
}

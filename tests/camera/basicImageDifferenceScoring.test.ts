import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyzeImageDifference } from '../../features/camera/detection/application/BasicImageDifferenceScoring';
import {
  createSimpleBoardCalibration,
  scoreNormalizedPoint,
} from '../../features/camera/detection/application/SimpleBoardCalibration';
import { createDefaultCalibrationProfile } from '../../features/camera/calibration/domain/profile';
import { scoreToApproximateBoardPoint } from '../../features/camera/calibration/domain/coordinateTransform';

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

test('basic image difference generates a camera candidate from connected component tip', () => {
  const baselineFrame = createFrame(80, 80);
  const thrownFrame = createFrame(80, 80);
  drawSyntheticDart(thrownFrame, { x: 0.5, y: 0.2 }, { x: 0.58, y: 0.05 });

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
    assert.ok(result.candidate.componentDiagnostics);
    assert.ok(result.candidate.fittedAxis);
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
  const frames = {
    baselineFrame: createFrame(160, 120),
    thrownFrame: createFrame(160, 120),
  };
  const s19 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 19, profile });
  drawSyntheticDart(frames.thrownFrame, s19, extendOutward(profile, s19, 0.24));

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
    assert.equal(first.candidate.candidateId, second.candidate.candidateId);
    assert.equal(first.candidate.segment, second.candidate.segment);
    assert.equal(first.candidate.multiplier, second.candidate.multiplier);
    assert.equal(first.candidate.normalizedX, second.candidate.normalizedX);
    assert.equal(first.candidate.normalizedY, second.candidate.normalizedY);
    assert.deepEqual(first.candidate.scoreDiagnostics, second.candidate.scoreDiagnostics);
  }
});

test('basic image difference can return alternate candidates from the same real frame pair', () => {
  const profile = createDefaultCalibrationProfile(new Date('2026-07-17T00:00:00.000Z'));
  const baselineFrame = createFrame(160, 120);
  const thrownFrame = createFrame(160, 120);
  const s19 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 19, profile });
  const s20 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 20, profile });
  const s1 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 1, profile });
  drawSyntheticDart(thrownFrame, s19, extendOutward(profile, s19, 0.18), 250);
  drawSyntheticDart(thrownFrame, s20, extendOutward(profile, s20, 0.18), 235);
  drawSyntheticDart(thrownFrame, s1, extendOutward(profile, s1, 0.18), 225);

  const result = analyzeImageDifference({
    sessionId: 'session-real-frame',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    assert.ok(result.alternateCandidates.length >= 1);
    assert.equal(result.candidate.type, 'detection_candidate');
  }
});

test('real camera S19 regression fixture keeps S19 in top candidates and avoids MISS first', () => {
  const profile = createDefaultCalibrationProfile(new Date('2026-07-17T00:00:00.000Z'));
  const baselineFrame = createFrame(160, 120);
  const thrownFrame = createFrame(160, 120);
  const s19 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 19, profile });
  drawSyntheticDart(thrownFrame, s19, extendOutward(profile, s19, 0.24), 255);
  drawPatch(thrownFrame, { x: 0.88, y: 0.88 }, 2, 240);

  const result = analyzeImageDifference({
    sessionId: 's19-regression',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    now: new Date('2026-07-17T00:00:00.000Z'),
    random: () => 0.1,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    const candidates = [result.candidate, ...result.alternateCandidates];
    assert.notEqual(result.candidate.multiplier, 0);
    assert.ok(
      candidates.some((candidate) => candidate.segment === 19 && candidate.multiplier === 1),
    );
    assert.notEqual(result.candidate.confidence, 0.82);
    assert.ok(result.candidate.confidence > 0);
    assert.ok(result.candidate.confidence < 1);
    assert.equal(result.candidate.algorithmVersion, 'basic-image-difference-components-v2');
    assert.ok(result.candidate.componentDiagnostics?.elongation);
    assert.ok(result.candidate.scoreDiagnostics?.withinDoubleOuter);
  }
});

test('basic image difference rejects area noise and does not promote single pixel candidates', () => {
  const profile = createDefaultCalibrationProfile();
  const singlePixel = {
    baselineFrame: createFrame(80, 80),
    thrownFrame: createFrame(80, 80),
  };
  singlePixel.thrownFrame.pixels[40 * 80 + 40] = 255;
  const singlePixelResult = analyzeImageDifference({
    sessionId: 'single-pixel',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame: singlePixel.baselineFrame,
    thrownFrame: singlePixel.thrownFrame,
    calibration: profile,
    threshold: 250,
  });
  assert.equal(singlePixelResult.status, 'no_candidate');

  const baselineFrame = createFrame(120, 120);
  const thrownFrame = createFrame(120, 120);
  drawPatch(thrownFrame, { x: 0.5, y: 0.5 }, 18, 255);
  const areaNoiseResult = analyzeImageDifference({
    sessionId: 'area-noise',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    threshold: 20,
  });
  assert.equal(areaNoiseResult.status, 'no_candidate');
});

function createFrame(width: number, height: number) {
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height),
  };
}

function drawSyntheticDart(
  frame: ReturnType<typeof createFrame>,
  tip: { x: number; y: number },
  shaftEnd: { x: number; y: number },
  intensity = 255,
) {
  const steps = 28;
  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = Math.round((tip.x + (shaftEnd.x - tip.x) * ratio) * (frame.width - 1));
    const y = Math.round((tip.y + (shaftEnd.y - tip.y) * ratio) * (frame.height - 1));
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && py >= 0 && px < frame.width && py < frame.height) {
          frame.pixels[py * frame.width + px] = intensity;
        }
      }
    }
  }
}

function drawPatch(
  frame: ReturnType<typeof createFrame>,
  center: { x: number; y: number },
  radius: number,
  intensity: number,
) {
  const cx = Math.round(center.x * (frame.width - 1));
  const cy = Math.round(center.y * (frame.height - 1));
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x >= 0 && y >= 0 && x < frame.width && y < frame.height) {
        frame.pixels[y * frame.width + x] = intensity;
      }
    }
  }
}

function extendOutward(
  profile: ReturnType<typeof createDefaultCalibrationProfile>,
  tip: { x: number; y: number },
  amount: number,
) {
  return {
    x: tip.x + (tip.x - profile.centerX) * amount,
    y: tip.y + (tip.y - profile.centerY) * amount,
  };
}

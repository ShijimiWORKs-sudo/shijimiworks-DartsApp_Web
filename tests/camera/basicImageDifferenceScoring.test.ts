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

test('basic image difference rejects broad low-elongation shadow components', () => {
  const profile = createDefaultCalibrationProfile();
  const baselineFrame = createLitFrame(180, 120, 180);
  const thrownFrame = createLitFrame(180, 120, 180);
  const s16 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 16, profile });
  drawBlurredShadow(thrownFrame, s16, { rx: 0.075, ry: 0.048 }, 74);

  const result = analyzeImageDifference({
    sessionId: 'shadow-only',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    threshold: 18,
  });

  assert.equal(result.status, 'no_candidate');
});

test('basic image difference ranks a clear S11 dart above an S16 shadow', () => {
  const profile = createDefaultCalibrationProfile();
  const baselineFrame = createLitFrame(180, 120, 180);
  const thrownFrame = createLitFrame(180, 120, 180);
  const s11 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 11, profile });
  const s16 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 16, profile });
  drawBlurredShadow(thrownFrame, s16, { rx: 0.07, ry: 0.05 }, 70);
  drawSyntheticDart(thrownFrame, s11, extendOutward(profile, s11, 0.22), 255);

  const result = analyzeImageDifference({
    sessionId: 's11-shadow-regression',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    threshold: 18,
    now: new Date('2026-07-18T00:00:00.000Z'),
    random: () => 0.2,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    assert.equal(result.candidate.segment, 11);
    assert.notEqual(result.candidate.segment, 16);
    assert.ok(result.candidate.componentDiagnostics);
    assert.ok(result.candidate.componentDiagnostics.dartLikelihood > 0.35);
    assert.ok(result.candidate.componentDiagnostics.shadowLikelihood < 0.66);
    assert.ok(result.candidate.componentDiagnostics.skeletonLength > 0);
    assert.ok(result.candidate.narrowCoreBoundingBox);
    assert.ok(result.candidate.rejectedShadowComponents?.length);
  }
});

test('basic image difference separates a narrow dart core from a joined soft shadow', () => {
  const profile = createDefaultCalibrationProfile();
  const baselineFrame = createLitFrame(180, 120, 180);
  const thrownFrame = createLitFrame(180, 120, 180);
  const s11 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 11, profile });
  drawBlurredShadow(thrownFrame, s11, { rx: 0.075, ry: 0.052 }, 88);
  drawSyntheticDart(thrownFrame, s11, extendOutward(profile, s11, 0.22), 255);

  const result = analyzeImageDifference({
    sessionId: 'joined-shadow-core',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    threshold: 18,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    const diagnostics = result.candidate.componentDiagnostics;
    assert.ok(diagnostics);
    assert.equal(result.candidate.segment, 11);
    assert.ok(result.candidate.narrowCoreBoundingBox);
    assert.ok(diagnostics.skeletonLength > 5);
    assert.ok(diagnostics.dartLikelihood > diagnostics.shadowLikelihood);
    assert.match(diagnostics.tipSelectionReason, /narrow core axis/);
  }
});

test('basic image difference does not pad candidate list with same-position alternates', () => {
  const profile = createDefaultCalibrationProfile();
  const baselineFrame = createFrame(160, 120);
  const thrownFrame = createFrame(160, 120);
  const s20 = scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 20, profile });
  drawSyntheticDart(thrownFrame, s20, extendOutward(profile, s20, 0.24), 255);

  const result = analyzeImageDifference({
    sessionId: 'single-real-candidate',
    cameraNodeId: 'camera-node',
    throwIndex: 1,
    baselineFrame,
    thrownFrame,
    calibration: profile,
    threshold: 20,
  });

  assert.equal(result.status, 'candidate');
  if (result.status === 'candidate') {
    const candidates = [result.candidate, ...result.alternateCandidates];
    assert.ok(candidates.length < 3);
    for (let index = 1; index < candidates.length; index += 1) {
      assert.ok(
        normalizedDistance(candidates[0], candidates[index]) >= 0.045,
        'near duplicate candidate should be suppressed',
      );
    }
  }
});

function createFrame(width: number, height: number) {
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height),
  };
}

function createLitFrame(width: number, height: number, intensity: number) {
  const frame = createFrame(width, height);
  frame.pixels.fill(intensity);
  return frame;
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

function drawBlurredShadow(
  frame: ReturnType<typeof createFrame>,
  center: { x: number; y: number },
  size: { rx: number; ry: number },
  intensity: number,
) {
  const cx = center.x * (frame.width - 1);
  const cy = center.y * (frame.height - 1);
  const rx = size.rx * frame.width;
  const ry = size.ry * frame.height;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) {
        continue;
      }
      const distanceRatio = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (distanceRatio <= 1) {
        const falloff = 1 - Math.min(1, distanceRatio);
        const existing = frame.pixels[y * frame.width + x];
        frame.pixels[y * frame.width + x] = Math.round(
          existing * (1 - falloff * 0.55) + intensity * falloff * 0.55,
        );
      }
    }
  }
}

function normalizedDistance(
  first: { normalizedX: number; normalizedY: number },
  second: { normalizedX: number; normalizedY: number },
) {
  return Math.sqrt(
    (first.normalizedX - second.normalizedX) ** 2 + (first.normalizedY - second.normalizedY) ** 2,
  );
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

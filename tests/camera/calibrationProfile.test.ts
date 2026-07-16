import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  applyPreviewMirror,
  removePreviewMirror,
  scoreCanonicalPoint,
  scoreToApproximateBoardPoint,
} from '../../features/camera/calibration/domain/coordinateTransform';
import {
  clampCalibrationProfile,
  createDefaultCalibrationProfile,
  updateCalibrationRingRatio,
  validateCalibrationProfile,
} from '../../features/camera/calibration/domain/profile';

const root = process.cwd();

test('Calibration Profile default is valid and uses mirror OFF', () => {
  const profile = createDefaultCalibrationProfile(new Date('2026-07-17T00:00:00.000Z'));

  assert.equal(profile.version, 2);
  assert.equal(profile.previewMirrored, false);
  assert.equal(validateCalibrationProfile(profile).valid, true);
});

test('Calibration Profile invalid ring order falls back to constrained order', () => {
  const profile = clampCalibrationProfile({
    ...createDefaultCalibrationProfile(),
    innerBullRatio: 0.9,
    outerBullRatio: 0.2,
    tripleInnerRatio: 0.1,
  });

  assert.equal(validateCalibrationProfile(profile).valid, true);
  assert.ok(profile.innerBullRatio < profile.outerBullRatio);
  assert.ok(profile.outerBullRatio < profile.tripleInnerRatio);
});

test('mirror transforms screen and canonical coordinates without changing detection score', () => {
  const profile = { ...createDefaultCalibrationProfile(), previewMirrored: true };
  const canonical = { x: 0.2, y: 0.4 };
  const screen = applyPreviewMirror(canonical, true);
  const restored = removePreviewMirror(screen, true);

  assert.ok(Math.abs(screen.x - 0.8) < 0.000001);
  assert.ok(Math.abs(restored.x - 0.2) < 0.000001);
  const directScore = scoreCanonicalPoint(canonical, profile);
  const restoredScore = scoreCanonicalPoint(restored, profile);
  assert.equal(restoredScore.area, directScore.area);
  assert.equal(restoredScore.segmentNumber, directScore.segmentNumber);
  assert.equal(restoredScore.multiplier, directScore.multiplier);
  assert.equal(restoredScore.score, directScore.score);
});

test('score mapping handles center, T20, D16, S1 and rotation', () => {
  const profile = createDefaultCalibrationProfile();
  const center = scoreCanonicalPoint({ x: profile.centerX, y: profile.centerY }, profile);
  const t20 = scoreCanonicalPoint(
    scoreToApproximateBoardPoint({ area: 'triple', segmentNumber: 20, profile }),
    profile,
  );
  const d16 = scoreCanonicalPoint(
    scoreToApproximateBoardPoint({ area: 'double', segmentNumber: 16, profile }),
    profile,
  );
  const s1 = scoreCanonicalPoint(
    scoreToApproximateBoardPoint({ area: 'single', segmentNumber: 1, profile }),
    profile,
  );

  assert.equal(center.area, 'inner_bull');
  assert.equal(t20.area, 'triple');
  assert.equal(t20.segmentNumber, 20);
  assert.equal(t20.score, 60);
  assert.equal(d16.area, 'double');
  assert.equal(d16.segmentNumber, 16);
  assert.equal(d16.score, 32);
  assert.equal(s1.area, 'single');
  assert.equal(s1.segmentNumber, 1);

  const rotated = { ...profile, rotationDeg: 18 };
  const rotatedT20 = scoreCanonicalPoint(
    scoreToApproximateBoardPoint({ area: 'triple', segmentNumber: 20, profile: rotated }),
    rotated,
  );
  assert.equal(rotatedT20.segmentNumber, 20);
});

test('ring adjustment constrains order and keeps center stable', () => {
  const profile = createDefaultCalibrationProfile();
  const next = updateCalibrationRingRatio(profile, 'triple_outer', 0.5);

  assert.equal(next.centerX, profile.centerX);
  assert.equal(next.centerY, profile.centerY);
  assert.equal(validateCalibrationProfile(next).valid, true);
  assert.ok(next.tripleOuterRatio < next.doubleInnerRatio);
});

test('Calibration UI exposes save reload mirror drag scale rotation and ring controls', () => {
  const route = readRepoFile('app/camera/calibration.tsx');
  const control = readRepoFile('components/camera/CalibrationControlPanel.tsx');
  const overlay = readRepoFile('components/camera/BoardCalibrationOverlay.tsx');
  const store = readRepoFile('features/camera/calibration/application/calibrationProfileStore.ts');

  assert.match(route, /Camera Calibration/);
  assert.match(control, /映像を左右反転/);
  assert.match(control, /center X/);
  assert.match(control, /outerRadius/);
  assert.match(control, /rotation/);
  assert.match(control, /Double外側/);
  assert.match(control, /Triple内側/);
  assert.match(control, /Outer Bull外側/);
  assert.match(control, /Inner Bull外側/);
  assert.match(overlay, /Bull中心/);
  assert.match(overlay, /20方向回転/);
  assert.match(store, /AsyncStorage/);
  assert.match(store, /LOCAL_COUNT_UP_CALIBRATION_PROFILE_KEY/);
});

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

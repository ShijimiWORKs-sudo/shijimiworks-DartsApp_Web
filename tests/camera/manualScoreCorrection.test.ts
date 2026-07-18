import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { calculateManualCorrectionScore } from '../../features/camera/detection/application/manualScoreCorrection';

const root = process.cwd();

test('manual correction panel renders all 1-20 targets without cricket filtering', () => {
  const source = readRepoFile('components/camera/ManualScoreCorrectionPanel.tsx');
  const segments = Array.from({ length: 20 }, (_, index) => index + 1);

  assert.match(source, /Array\.from\(\{ length: 20 \}/);
  assert.match(source, /Outer Bull/);
  assert.match(source, /Inner Bull/);
  assert.match(source, /MISS/);
  assert.match(source, /Single/);
  assert.match(source, /Double/);
  assert.match(source, /Triple/);
  assert.equal(new Set(segments).size, 20);
});

test('manual correction scoring covers D16, T20, bull and MISS', () => {
  assert.equal(
    calculateManualCorrectionScore({ area: 'double', segmentNumber: 16, bullRule: 'fat_bull' }),
    32,
  );
  assert.equal(
    calculateManualCorrectionScore({ area: 'triple', segmentNumber: 20, bullRule: 'fat_bull' }),
    60,
  );
  assert.equal(
    calculateManualCorrectionScore({
      area: 'inner_bull',
      segmentNumber: null,
      bullRule: 'separate_bull',
    }),
    50,
  );
  assert.equal(
    calculateManualCorrectionScore({
      area: 'outer_bull',
      segmentNumber: null,
      bullRule: 'fat_bull',
    }),
    50,
  );
  assert.equal(
    calculateManualCorrectionScore({
      area: 'outer_bull',
      segmentNumber: null,
      bullRule: 'separate_bull',
    }),
    25,
  );
  assert.equal(
    calculateManualCorrectionScore({ area: 'miss', segmentNumber: null, bullRule: 'fat_bull' }),
    0,
  );
});

test('local COUNT-UP screen uses all-number manual correction and corrected camera source', () => {
  const play = readRepoFile('app/camera/local-count-up/[gameId]/index.tsx');
  const adapter = readRepoFile(
    'features/camera/detection/application/CameraLocalCountUpAdapter.ts',
  );

  assert.match(play, /ManualScoreCorrectionPanel/);
  assert.match(play, /camera_corrected/);
  assert.match(adapter, /camera_confirmed/);
  assert.match(adapter, /photo_detected/);
  assert.match(adapter, /camera_corrected/);
  assert.match(adapter, /photo_adjusted/);
  assert.match(adapter, /manual_segment/);
});

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

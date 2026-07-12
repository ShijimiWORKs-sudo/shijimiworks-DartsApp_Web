import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration } from '../types';
import { detectDartCandidatesFromImage } from '../utils/detectDartCandidatesFromImage';
import {
  buildPhotoScoreHit,
  generatePhotoScoreCandidates,
  limitSelectedCandidateIds,
  mergePhotoScoreCandidates,
} from '../utils/photoScoreCandidates';

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

test('generatePhotoScoreCandidates returns selectable candidates in normalized bounds', () => {
  const candidates = generatePhotoScoreCandidates(calibration);

  assert.ok(candidates.length >= 6);
  candidates.forEach((candidate) => {
    assert.ok(candidate.point.x >= 0 && candidate.point.x <= 1);
    assert.ok(candidate.point.y >= 0 && candidate.point.y <= 1);
    assert.ok(candidate.confidence > 0 && candidate.confidence <= 1);
    assert.equal(candidate.selected, false);
  });
});

test('generatePhotoScoreCandidates marks selected candidate ids', () => {
  const candidates = generatePhotoScoreCandidates(calibration, ['candidate-bull']);
  const bullCandidate = candidates.find((candidate) => candidate.id === 'candidate-bull');

  assert.equal(bullCandidate?.selected, true);
});

test('buildPhotoScoreHit preserves auto candidate metadata', () => {
  const [candidate] = generatePhotoScoreCandidates(calibration);
  const hit = buildPhotoScoreHit(
    calibration,
    candidate.point,
    'dart-1',
    'autoCandidate',
    candidate,
  );

  assert.equal(hit.detectionSource, 'autoCandidate');
  assert.equal(hit.candidateId, candidate.id);
  assert.equal(hit.confidence, candidate.confidence);
});

test('buildPhotoScoreHit supports adjusted source', () => {
  const hit = buildPhotoScoreHit(calibration, { x: 0.52, y: 0.5 }, 'dart-1', 'adjusted');

  assert.equal(hit.detectionSource, 'adjusted');
  assert.equal(hit.id, 'dart-1');
});

test('mergePhotoScoreCandidates deduplicates nearby candidates', () => {
  const calibrationCandidates = generatePhotoScoreCandidates(calibration);
  const imageCandidates = [
    {
      ...calibrationCandidates[0],
      id: 'image-duplicate',
      confidence: 0.95,
      reason: 'contrast-candidate',
      source: 'imageAnalysisCandidate' as const,
    },
  ];
  const merged = mergePhotoScoreCandidates(imageCandidates, calibrationCandidates, {
    minDistance: 0.05,
  });

  assert.equal(merged[0].id, 'image-duplicate');
  assert.equal(
    merged.filter(
      (candidate) =>
        Math.hypot(
          candidate.point.x - calibrationCandidates[0].point.x,
          candidate.point.y - calibrationCandidates[0].point.y,
        ) < 0.05,
    ).length,
    1,
  );
});

test('mergePhotoScoreCandidates respects maxCandidates and confidence order', () => {
  const merged = mergePhotoScoreCandidates([], generatePhotoScoreCandidates(calibration), {
    maxCandidates: 3,
  });

  assert.equal(merged.length, 3);
  assert.ok(merged[0].confidence >= merged[1].confidence);
  assert.ok(merged[1].confidence >= merged[2].confidence);
});

test('limitSelectedCandidateIds caps selected ids at three', () => {
  assert.deepEqual(limitSelectedCandidateIds(['a', 'b', 'c', 'd']), ['a', 'b', 'c']);
});

test('detectDartCandidatesFromImage returns empty array when image analysis cannot run', async () => {
  const candidates = await detectDartCandidatesFromImage('', calibration);

  assert.deepEqual(candidates, []);
});

test('detectDartCandidatesFromImage can return image analysis fallback candidates', async () => {
  const candidates = await detectDartCandidatesFromImage('file:///board.jpg', calibration, {
    enableHeuristicFallback: true,
    maxCandidates: 3,
  });

  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].source, 'imageAnalysisCandidate');
  assert.equal(candidates[0].selected, false);
  assert.match(candidates[0].reason, /candidate/);
});

test('buildPhotoScoreHit supports image analysis candidate metadata', () => {
  const [candidate] = generatePhotoScoreCandidates(calibration);
  const hit = buildPhotoScoreHit(calibration, candidate.point, 'dart-1', 'imageAnalysisCandidate', {
    ...candidate,
    id: 'image-candidate-1',
    confidence: 0.62,
  });

  assert.equal(hit.detectionSource, 'imageAnalysisCandidate');
  assert.equal(hit.candidateId, 'image-candidate-1');
  assert.equal(hit.confidence, 0.62);
});

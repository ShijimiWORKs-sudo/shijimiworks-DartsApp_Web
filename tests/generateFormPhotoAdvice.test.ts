import assert from 'node:assert/strict';
import test from 'node:test';

import type { BoardCalibration, FormSelfCheck, PracticeRecord } from '../types';
import { buildPhotoScoreHit } from '../utils/photoScoreCandidates';
import {
  generateFormPhotoAdvice,
  getLatestPhotoScoreRecord,
} from '../utils/generateFormPhotoAdvice';
import { analyzePhotoScoreGrouping } from '../utils/analyzePhotoScoreGrouping';
import { getPracticeMenuById } from '../constants/practiceMenus';
import { buildRecord } from './testHelpers';

const selfCheck: FormSelfCheck = {
  stanceFeelsStable: 'no',
  shoulderLineFeelsAligned: 'unknown',
  elbowHeightFeelsStable: 'unknown',
  releaseFeelsClean: 'no',
  followThroughGoesToTarget: 'no',
  bodyOpensEarly: 'yes',
  gripFeelsTooStrong: 'yes',
  feelsRushed: 'yes',
};

const calibration: BoardCalibration = {
  boardType: 'DARTSLIVE_ZERO',
  center: { x: 0.5, y: 0.5 },
  topNumberPoint: { x: 0.5, y: 0.1 },
  outerRadius: 0.4,
  ringPreset: 'soft',
};

test('generateFormPhotoAdvice returns advice from photos and self check', () => {
  const result = generateFormPhotoAdvice({
    throwingHand: 'right',
    photos: [
      { type: 'front', imageUri: 'file:///front.jpg' },
      { type: 'side', imageUri: 'file:///side.jpg' },
      { type: 'releaseAfter', imageUri: 'file:///release.jpg' },
    ],
    selfCheck,
  });

  assert.equal(result.throwingHand, 'right');
  assert.ok(result.adviceCategories.includes('stance'));
  assert.ok(result.adviceCategories.includes('release'));
  assert.ok(result.adviceTexts.length > 0);
  assert.ok(result.checkPoints.length > 0);
  assert.ok(result.recommendedPracticeMenuIds.includes('beginner-stance-three-sets'));
  assert.equal(result.photos[0]?.imageUri, 'file:///front.jpg');
  result.recommendedPracticeMenuIds.forEach((menuId) => {
    assert.notEqual(getPracticeMenuById(menuId), null);
  });
});

test('generateFormPhotoAdvice reflects latest photo score grouping analysis', () => {
  const hits = [
    buildPhotoScoreHit(calibration, { x: 0.48, y: 0.22 }, 'dart-1', 'manualTap'),
    buildPhotoScoreHit(calibration, { x: 0.5, y: 0.5 }, 'dart-2', 'manualTap'),
    buildPhotoScoreHit(calibration, { x: 0.51, y: 0.76 }, 'dart-3', 'manualTap'),
  ];
  const groupingAnalysis = analyzePhotoScoreGrouping(hits, calibration);
  const record: PracticeRecord = {
    ...buildRecord({ id: 'photo-score-record', date: '2026-07-10T00:00:00.000Z' }),
    photoScore: {
      boardType: 'DARTSLIVE_ZERO',
      calibration,
      hits,
      totalScore: 80,
      bullCount: 1,
      tripleCount: 0,
      doubleCount: 0,
      groupingAnalysis,
    },
  };
  const result = generateFormPhotoAdvice({
    throwingHand: 'left',
    photos: [{ type: 'front', imageUri: 'file:///front.jpg' }],
    selfCheck,
    linkedPracticeRecord: record,
  });

  assert.equal(result.linkedPracticeRecordId, 'photo-score-record');
  assert.match(result.linkedPhotoScoreSummary ?? '', /写真スコア 80点/);
  assert.ok(result.adviceCategories.includes('practicePlan'));
});

test('getLatestPhotoScoreRecord returns newest photo score record only', () => {
  const oldRecord = buildRecord({ id: 'old', date: '2026-07-01T00:00:00.000Z' });
  const newestRecord: PracticeRecord = {
    ...buildRecord({ id: 'newest', date: '2026-07-10T00:00:00.000Z' }),
    photoScore: {
      boardType: 'DARTSLIVE_ZERO',
      calibration,
      hits: [],
      totalScore: 0,
      bullCount: 0,
      tripleCount: 0,
      doubleCount: 0,
    },
  };

  assert.equal(getLatestPhotoScoreRecord([oldRecord, newestRecord])?.id, 'newest');
});

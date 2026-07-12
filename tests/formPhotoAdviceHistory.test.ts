import assert from 'node:assert/strict';
import test from 'node:test';

import type { FormPhotoAdviceResult } from '../types';
import {
  addFormPhotoAdviceHistory,
  deleteFormPhotoAdviceHistory,
} from '../utils/formPhotoAdviceHistory';

const baseHistory: FormPhotoAdviceResult = {
  id: 'history-1',
  date: '2026-07-10T00:00:00.000Z',
  throwingHand: 'right',
  photos: [],
  selfCheck: {
    stanceFeelsStable: 'unknown',
    shoulderLineFeelsAligned: 'unknown',
    elbowHeightFeelsStable: 'unknown',
    releaseFeelsClean: 'unknown',
    followThroughGoesToTarget: 'unknown',
    bodyOpensEarly: 'unknown',
    gripFeelsTooStrong: 'unknown',
    feelsRushed: 'unknown',
  },
  adviceCategories: ['practicePlan'],
  summaryText: '確認します。',
  adviceTexts: ['1項目だけ確認します。'],
  checkPoints: ['同じ角度で写真を撮る'],
  recommendedPracticeMenuIds: ['beginner-routine-one-breath'],
};

test('addFormPhotoAdviceHistory adds history and sorts newest first', () => {
  const newerHistory = {
    ...baseHistory,
    id: 'history-2',
    date: '2026-07-11T00:00:00.000Z',
  };
  const histories = addFormPhotoAdviceHistory([baseHistory], newerHistory);

  assert.equal(histories.length, 2);
  assert.equal(histories[0]?.id, 'history-2');
});

test('addFormPhotoAdviceHistory replaces same id without duplicating', () => {
  const updatedHistory = {
    ...baseHistory,
    summaryText: '更新しました。',
  };
  const histories = addFormPhotoAdviceHistory([baseHistory], updatedHistory);

  assert.equal(histories.length, 1);
  assert.equal(histories[0]?.summaryText, '更新しました。');
});

test('deleteFormPhotoAdviceHistory deletes only target id', () => {
  const secondHistory = { ...baseHistory, id: 'history-2' };
  const histories = deleteFormPhotoAdviceHistory([baseHistory, secondHistory], 'history-1');

  assert.deepEqual(
    histories.map((history) => history.id),
    ['history-2'],
  );
});

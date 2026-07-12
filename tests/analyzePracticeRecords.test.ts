import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateAnalysisSummary,
  calculateGameTypeSummary,
  filterRecordsByPeriod,
  generateImprovementComments,
  getTrendDirection,
} from '../utils/analyzePracticeRecords';
import { buildProfile, buildRecord, daysAgo, recordSet } from './testHelpers';

test('calculateAnalysisSummary handles empty records', () => {
  const summary = calculateAnalysisSummary([], 'all', null);

  assert.equal(summary.totalPracticeCount, 0);
  assert.equal(summary.countUpAverage, null);
  assert.equal(summary.bullAverage, null);
  assert.equal(summary.trendDirection, 'unknown');
  assert.ok(summary.improvementComments.length > 0);
});

test('calculateAnalysisSummary aggregates a single record', () => {
  const summary = calculateAnalysisSummary([buildRecord({ score: 620, bullCount: 14 })], 'all');

  assert.equal(summary.totalPracticeCount, 1);
  assert.equal(summary.countUpAverage, 620);
  assert.equal(summary.bullAverage, 14);
  assert.equal(summary.bestScore, 620);
});

test('calculateAnalysisSummary aggregates averages for multiple records', () => {
  const records = recordSet([
    { score: 400, bullCount: 8, cricketMarks: 10 },
    { score: 600, bullCount: 12, cricketMarks: 30 },
  ]);
  const summary = calculateAnalysisSummary(records, 'all');

  assert.equal(summary.countUpAverage, 500);
  assert.equal(summary.bullAverage, 10);
  assert.equal(summary.cricketMarksAverage, 20);
});

test('filterRecordsByPeriod supports 7, 30, 90 days and all', () => {
  const records = [
    buildRecord({ id: 'today', date: daysAgo(0) }),
    buildRecord({ id: 'day-20', date: daysAgo(20) }),
    buildRecord({ id: 'day-60', date: daysAgo(60) }),
    buildRecord({ id: 'day-120', date: daysAgo(120) }),
  ];

  assert.equal(filterRecordsByPeriod(records, 'last7Days').length, 1);
  assert.equal(filterRecordsByPeriod(records, 'last30Days').length, 2);
  assert.equal(filterRecordsByPeriod(records, 'last90Days').length, 3);
  assert.equal(filterRecordsByPeriod(records, 'all').length, 4);
});

test('calculateGameTypeSummary groups COUNT-UP and CRICKET records', () => {
  const records = [
    buildRecord({ gameType: 'COUNT-UP', score: 500 }),
    buildRecord({ gameType: 'CRICKET', score: 300, cricketMarks: 42 }),
  ];
  const summaries = calculateGameTypeSummary(records);
  const countUp = summaries.find((summary) => summary.gameType === 'COUNT-UP');
  const cricket = summaries.find((summary) => summary.gameType === 'CRICKET');

  assert.equal(countUp?.count, 1);
  assert.equal(countUp?.averageScore, 500);
  assert.equal(cricket?.count, 1);
  assert.equal(cricket?.averageCricketMarks, 42);
});

test('getTrendDirection returns up, down, flat and unknown', () => {
  assert.equal(
    getTrendDirection(
      recordSet([
        { score: 300, daysAgo: 3 },
        { score: 320, daysAgo: 2 },
        { score: 500, daysAgo: 1 },
        { score: 560, daysAgo: 0 },
      ]),
    ),
    'up',
  );
  assert.equal(
    getTrendDirection(
      recordSet([
        { score: 600, daysAgo: 3 },
        { score: 580, daysAgo: 2 },
        { score: 420, daysAgo: 1 },
        { score: 390, daysAgo: 0 },
      ]),
    ),
    'down',
  );
  assert.equal(
    getTrendDirection(
      recordSet([
        { score: 500, daysAgo: 3 },
        { score: 505, daysAgo: 2 },
        { score: 508, daysAgo: 1 },
        { score: 510, daysAgo: 0 },
      ]),
    ),
    'flat',
  );
  assert.equal(getTrendDirection(recordSet([{ score: 500 }])), 'unknown');
});

test('generateImprovementComments returns contextual comments', () => {
  const profile = buildProfile({ mainProblems: ['イップス気味'] });
  const summary = calculateAnalysisSummary(
    recordSet([
      { score: 300, bullCount: 3, gameType: 'COUNT-UP', condition: 'bad' },
      { score: 320, bullCount: 4, gameType: 'COUNT-UP', condition: 'bad' },
      { score: 310, bullCount: 5, gameType: '01', condition: 'bad' },
    ]),
    'last7Days',
    profile,
  );
  const comments = generateImprovementComments(summary, profile);

  assert.ok(comments.length > 0);
  assert.ok(comments.some((comment) => comment.includes('ブル') || comment.includes('イップス')));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateRatingUpdate,
  mprMilliToRatingIndex,
  ppdMilliToRatingIndex,
  type RatingObservation,
  type RatingUpdateInput,
} from '../../features/game/domain/rating/index';

const NOW = '2026-07-15T00:00:00.000Z';

test('rating engine maps PPD and MPR anchors with clamp and interpolation', () => {
  assert.equal(ppdMilliToRatingIndex(10_000), 1);
  assert.equal(ppdMilliToRatingIndex(42_000), 18);
  assert.equal(ppdMilliToRatingIndex(60_000), 18);
  assert.equal(ppdMilliToRatingIndex(15_000), 3);
  assert.equal(mprMilliToRatingIndex(800), 1);
  assert.equal(mprMilliToRatingIndex(4_200), 18);
  assert.ok(Math.abs(mprMilliToRatingIndex(1_100) - 2.5) < 0.000001);
});

test('rating engine establishes initial rating only on third eligible MATCH', () => {
  const input = baseInput({
    targetEvaluationId: 'match-3',
    observations: [
      matchObservation('match-1', '2026-07-10T00:00:00.000Z', 20_000, 1_800, 'win', 'two_zero'),
      matchObservation('match-2', '2026-07-11T00:00:00.000Z', 21_000, 2_000, 'loss', 'two_one'),
      matchObservation('match-3', '2026-07-12T00:00:00.000Z', 22_000, 2_100, 'win', 'two_zero'),
    ],
  });

  const output = calculateRatingUpdate(input);

  assert.equal(output.kind, 'applied');
  if (output.kind !== 'applied') return;
  assert.equal(output.measurementStatus, 'provisional');
  assert.equal(output.evaluatedMatchCount, 3);
  assert.equal(output.evaluatedStandaloneZeroOneCount, 0);
  assert.equal(output.establishedAt, '2026-07-12T00:00:00.000Z');
  assert.ok(output.ratingTenths !== null);
  assert.ok(output.calculationDetailJson.includes('"initialOutlierControl"'));
});

test('standalone 01 updates only 01 Index and caps total rating delta to 0.2', () => {
  const observations = [
    matchObservation('match-1', '2026-07-10T00:00:00.000Z', 20_000, 1_800, 'win', 'two_zero'),
    matchObservation('match-2', '2026-07-11T00:00:00.000Z', 21_000, 2_000, 'loss', 'two_one'),
    matchObservation('match-3', '2026-07-12T00:00:00.000Z', 22_000, 2_100, 'win', 'two_zero'),
    standaloneObservation('standalone-01', 'standalone_zero_one', '2026-07-13T00:00:00.000Z', {
      ppdMilli: 42_000,
    }),
  ];
  const input = baseInput({
    targetEvaluationId: 'standalone-01',
    observations,
    establishedAt: '2026-07-12T00:00:00.000Z',
    previousPreciseRatingMilli: 7_000,
    zeroOneIndexMilli: 7_000,
    cricketIndexMilli: 7_000,
    matchIndexMilli: 7_000,
  });

  const output = calculateRatingUpdate(input);

  assert.equal(output.kind, 'applied');
  if (output.kind !== 'applied') return;
  assert.notEqual(output.zeroOneIndexMilli, 7_000);
  assert.equal(output.cricketIndexMilli, 7_000);
  assert.equal(output.matchIndexMilli, 7_000);
  assert.ok(Math.abs(output.appliedDeltaMilli ?? 0) <= 200);
  assert.equal(output.evaluatedMatchCount, 3);
  assert.equal(output.evaluatedStandaloneZeroOneCount, 1);
});

test('standalone observations before initial rating are excluded and do not retroactively establish rating', () => {
  const input = baseInput({
    targetEvaluationId: 'standalone-01',
    observations: [
      standaloneObservation('standalone-01', 'standalone_zero_one', '2026-07-13T00:00:00.000Z', {
        ppdMilli: 30_000,
      }),
    ],
  });

  const output = calculateRatingUpdate(input);

  assert.equal(output.kind, 'excluded');
  if (output.kind !== 'excluded') return;
  assert.deepEqual(output.reasonCodes, ['INITIAL_RATING_NOT_ESTABLISHED']);
});

test('cricket zero-point natural clear is excluded', () => {
  const input = baseInput({
    targetEvaluationId: 'cricket-zero-clear',
    establishedAt: '2026-07-12T00:00:00.000Z',
    observations: [
      matchObservation('match-1', '2026-07-10T00:00:00.000Z', 20_000, 1_800, 'win', 'two_zero'),
      matchObservation('match-2', '2026-07-11T00:00:00.000Z', 21_000, 2_000, 'loss', 'two_one'),
      matchObservation('match-3', '2026-07-12T00:00:00.000Z', 22_000, 2_100, 'win', 'two_zero'),
      standaloneObservation(
        'cricket-zero-clear',
        'standalone_cricket',
        '2026-07-13T00:00:00.000Z',
        {
          mprMilli: 2_000,
          cricketClearFlag: true,
          cricketFinalScore: 0,
        },
      ),
    ],
  });

  const output = calculateRatingUpdate(input);

  assert.equal(output.kind, 'excluded');
  if (output.kind !== 'excluded') return;
  assert.deepEqual(output.reasonCodes, ['INVALID_CRICKET_ZERO_POINT_CLEAR']);
});

function baseInput(input: {
  targetEvaluationId: string;
  observations: RatingObservation[];
  establishedAt?: string | null;
  previousPreciseRatingMilli?: number | null;
  zeroOneIndexMilli?: number | null;
  cricketIndexMilli?: number | null;
  matchIndexMilli?: number | null;
}): RatingUpdateInput {
  return {
    targetEvaluationId: input.targetEvaluationId,
    calculationDateTime: NOW,
    profile: {
      accountId: 'account-1',
      ownerPlayerId: 'owner-player',
      measurementStatus: input.establishedAt ? 'provisional' : 'unmeasured',
      ratingTenths: input.previousPreciseRatingMilli
        ? Math.round(input.previousPreciseRatingMilli / 100)
        : null,
      preciseRatingMilli: input.previousPreciseRatingMilli ?? null,
      confidenceBp: 0,
      eligibleMatchCount: input.establishedAt ? 3 : 0,
      eligibleStandaloneZeroOneCount: 0,
      eligibleStandaloneCricketCount: 0,
      zeroOneIndexMilli: input.zeroOneIndexMilli ?? null,
      cricketIndexMilli: input.cricketIndexMilli ?? null,
      matchIndexMilli: input.matchIndexMilli ?? null,
      establishedAt: input.establishedAt ?? null,
    },
    previousSnapshot:
      input.previousPreciseRatingMilli === undefined || input.previousPreciseRatingMilli === null
        ? null
        : {
            id: 'snapshot-prev',
            ratingTenths: Math.round(input.previousPreciseRatingMilli / 100),
            preciseRatingMilli: input.previousPreciseRatingMilli,
          },
    observations: input.observations,
  };
}

function matchObservation(
  evaluationId: string,
  observedAt: string,
  ppdMilli: number,
  mprMilli: number,
  matchResult: 'win' | 'loss',
  matchCompletionReason: 'two_zero' | 'two_one',
): RatingObservation {
  return {
    evaluationId,
    accountId: 'account-1',
    playerId: 'owner-player',
    sourceType: 'match',
    sourceMatchId: evaluationId,
    sourceGameId: null,
    sourceRevision: 1,
    sourceWeightMilli: 1000,
    observedAt,
    matchResult,
    matchCompletionReason,
    manualOutcomeAdjustment: false,
    zeroOnePpdMilli: ppdMilli,
    cricketMprMilli: mprMilli,
    totalDarts: 45,
    totalRounds: 15,
    adjustedDarts: 0,
    correctionCount: 0,
    cricketClearFlag: false,
    cricketFinalScore: null,
  };
}

function standaloneObservation(
  evaluationId: string,
  sourceType: 'standalone_zero_one' | 'standalone_cricket',
  observedAt: string,
  input: {
    ppdMilli?: number;
    mprMilli?: number;
    cricketClearFlag?: boolean;
    cricketFinalScore?: number;
  },
): RatingObservation {
  return {
    evaluationId,
    accountId: 'account-1',
    playerId: 'owner-player',
    sourceType,
    sourceMatchId: null,
    sourceGameId: evaluationId,
    sourceRevision: 1,
    sourceWeightMilli: 500,
    observedAt,
    matchResult: null,
    matchCompletionReason: null,
    manualOutcomeAdjustment: false,
    zeroOnePpdMilli: input.ppdMilli ?? null,
    cricketMprMilli: input.mprMilli ?? null,
    totalDarts: 30,
    totalRounds: 10,
    adjustedDarts: 0,
    correctionCount: 0,
    cricketClearFlag: input.cricketClearFlag ?? false,
    cricketFinalScore: input.cricketFinalScore ?? null,
  };
}

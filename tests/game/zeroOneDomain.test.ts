import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateZeroOneDartScore,
  evaluateZeroOneTurn,
  summarizeZeroOneGame,
} from '../../features/game/domain/zeroOne';
import type { ZeroOneTurn } from '../../features/game/domain/zeroOne';

test('01 scoring calculates segment and bull values from rules', () => {
  assert.deepEqual(calculateZeroOneDartScore({ area: 'triple', segmentNumber: 20 }, 'fat_bull'), {
    multiplier: 3,
    score: 60,
  });
  assert.deepEqual(
    calculateZeroOneDartScore({ area: 'outer_bull', segmentNumber: null }, 'fat_bull'),
    { multiplier: 2, score: 50 },
  );
  assert.deepEqual(
    calculateZeroOneDartScore({ area: 'outer_bull', segmentNumber: null }, 'separate_bull'),
    { multiplier: 1, score: 25 },
  );
});

test('01 turn evaluation supports single out and master out checkout rules', () => {
  const singleFinish = [{ area: 'single' as const, score: 20, status: 'active' as const }];
  assert.equal(evaluateZeroOneTurn(20, singleFinish, 'single_out').status, 'checkout');
  assert.equal(evaluateZeroOneTurn(20, singleFinish, 'master_out').status, 'bust');

  const masterFinish = [{ area: 'double' as const, score: 20, status: 'active' as const }];
  assert.equal(evaluateZeroOneTurn(20, masterFinish, 'master_out').status, 'checkout');

  const remainingOne = [{ area: 'single' as const, score: 19, status: 'active' as const }];
  const oneLeft = evaluateZeroOneTurn(20, remainingOne, 'master_out');
  assert.equal(oneLeft.status, 'in_progress');
  assert.equal(oneLeft.endRemainingScore, 1);
});

test('01 bust keeps raw score but applies zero and resets remaining to turn start', () => {
  const evaluation = evaluateZeroOneTurn(
    10,
    [{ area: 'triple', score: 60, status: 'active' }],
    'single_out',
  );

  assert.equal(evaluation.status, 'bust');
  assert.equal(evaluation.rawScore, 60);
  assert.equal(evaluation.appliedScore, 0);
  assert.equal(evaluation.endRemainingScore, 10);
  assert.equal(evaluation.isBust, true);
});

test('01 summary excludes bust score from effective score but counts bust darts in PPD', () => {
  const turns: ZeroOneTurn[] = [
    createTurn({ roundNo: 1, rawScore: 60, appliedScore: 60, endRemainingScore: 241 }),
    createTurn({
      roundNo: 2,
      status: 'bust',
      rawScore: 180,
      appliedScore: 0,
      startRemainingScore: 241,
      endRemainingScore: 241,
      isBust: true,
    }),
  ];

  const result = summarizeZeroOneGame(turns, 301, 'round_limit');
  assert.equal(result.effectiveScore, 60);
  assert.equal(result.dartsThrown, 2);
  assert.equal(result.bustCount, 1);
  assert.equal(result.ppdMilli, 30000);
  assert.equal(result.threeDartAverageMilli, 90000);
});

function createTurn(input: Partial<ZeroOneTurn>): ZeroOneTurn {
  return {
    id: `turn-${input.roundNo ?? 1}`,
    roundNo: input.roundNo ?? 1,
    turnSequenceNo: input.turnSequenceNo ?? input.roundNo ?? 1,
    status: input.status ?? 'confirmed',
    darts: [
      {
        id: `dart-${input.roundNo ?? 1}`,
        roundNo: input.roundNo ?? 1,
        turnSequenceNo: input.turnSequenceNo ?? input.roundNo ?? 1,
        dartNo: 1,
        area: 'triple',
        segmentNumber: 20,
        multiplier: 3,
        score: input.rawScore ?? 60,
        status: 'active',
        inputSource: 'manual_segment',
        correctionCount: 0,
        clientActionId: `action-${input.roundNo ?? 1}`,
        createdAt: new Date(0).toISOString(),
      },
    ],
    rawScore: input.rawScore ?? 60,
    appliedScore: input.appliedScore ?? 60,
    startRemainingScore: input.startRemainingScore ?? 301,
    endRemainingScore: input.endRemainingScore ?? 241,
    dartCount: 1,
    isBust: input.isBust ?? false,
    isCheckout: input.isCheckout ?? false,
  };
}

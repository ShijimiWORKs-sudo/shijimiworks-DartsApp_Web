import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCricketTargetStates,
  calculateCricketDart,
  isNaturalCricketFinish,
  summarizeCricketGame,
} from '../../features/game/domain/cricket';
import type { CricketDart, CricketTurn } from '../../features/game/domain/cricket';

test('CRICKET scoring maps targets, bull marks, and non-targets', () => {
  assert.deepEqual(calculateCricketDart({ area: 'triple', segmentNumber: 20 }, 'fat_bull'), {
    multiplier: 3,
    score: 60,
    target: '20',
    cricketMarks: 3,
  });
  assert.deepEqual(calculateCricketDart({ area: 'inner_bull', segmentNumber: null }, 'fat_bull'), {
    multiplier: 2,
    score: 50,
    target: 'BULL',
    cricketMarks: 2,
  });
  assert.equal(
    calculateCricketDart({ area: 'triple', segmentNumber: 14 }, 'fat_bull').cricketMarks,
    0,
  );
});

test('CRICKET natural finish requires all targets closed and at least one point', () => {
  const zeroPointTurns = [
    createTurn(1, [dart(1, 'triple', 20), dart(2, 'triple', 19), dart(3, 'triple', 18)]),
    createTurn(2, [dart(1, 'triple', 17), dart(2, 'triple', 16), dart(3, 'triple', 15)]),
    createTurn(3, [dart(1, 'inner_bull', null), dart(2, 'outer_bull', null)]),
  ];
  const zeroPointStates = buildCricketTargetStates(zeroPointTurns);

  assert.equal(
    zeroPointStates.every((state) => state.isClosed),
    true,
  );
  assert.equal(
    zeroPointStates.reduce((sum, state) => sum + state.pointsScored, 0),
    0,
  );
  assert.equal(isNaturalCricketFinish(zeroPointStates), false);

  const scoringTurns = [...zeroPointTurns, createTurn(4, [dart(1, 'single', 20)])];
  const scoringStates = buildCricketTargetStates(scoringTurns);
  assert.equal(isNaturalCricketFinish(scoringStates), true);
  assert.equal(summarizeCricketGame(scoringTurns).clearFlag, true);
});

function createTurn(roundNo: number, darts: CricketDart[]): CricketTurn {
  return {
    id: `turn-${roundNo}`,
    roundNo,
    turnSequenceNo: roundNo,
    status: 'confirmed',
    darts: darts.map((entry) => ({
      ...entry,
      roundNo,
      turnSequenceNo: roundNo,
    })),
    rawScore: 0,
    appliedScore: 0,
    cricketMarksTotal: darts.reduce((sum, entry) => sum + entry.cricketMarks, 0),
    cricketPointsScored: 0,
    dartCount: darts.length,
  };
}

function dart(
  dartNo: number,
  area: CricketDart['area'],
  segmentNumber: CricketDart['segmentNumber'],
): CricketDart {
  const calculated = calculateCricketDart({ area, segmentNumber }, 'fat_bull');
  return {
    id: `dart-${dartNo}-${area}-${segmentNumber ?? 'bull'}`,
    roundNo: 1,
    turnSequenceNo: 1,
    dartNo,
    area,
    segmentNumber,
    multiplier: calculated.multiplier,
    score: calculated.score,
    cricketMarks: calculated.cricketMarks,
    status: 'active',
    inputSource: 'manual_segment',
    correctionCount: 0,
    clientActionId: `action-${dartNo}-${area}-${segmentNumber ?? 'bull'}`,
    createdAt: new Date(0).toISOString(),
  };
}

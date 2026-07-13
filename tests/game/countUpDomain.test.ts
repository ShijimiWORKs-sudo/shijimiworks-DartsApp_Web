import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateCountUpDartScore,
  summarizeCountUpGame,
} from '../../features/game/domain/countUp';
import type { CountUpDart, CountUpTurn } from '../../features/game/domain/countUp';

test('COUNT-UP scoring applies fat bull and separate bull rules', () => {
  assert.equal(calculateCountUpDartScore({ area: 'single', segmentNumber: 20 }, 'fat_bull'), 20);
  assert.equal(calculateCountUpDartScore({ area: 'double', segmentNumber: 20 }, 'fat_bull'), 40);
  assert.equal(calculateCountUpDartScore({ area: 'triple', segmentNumber: 20 }, 'fat_bull'), 60);
  assert.equal(
    calculateCountUpDartScore({ area: 'outer_bull', segmentNumber: null }, 'fat_bull'),
    50,
  );
  assert.equal(
    calculateCountUpDartScore({ area: 'outer_bull', segmentNumber: null }, 'separate_bull'),
    25,
  );
  assert.equal(
    calculateCountUpDartScore({ area: 'inner_bull', segmentNumber: null }, 'fat_bull'),
    50,
  );
  assert.equal(calculateCountUpDartScore({ area: 'miss', segmentNumber: null }, 'fat_bull'), 0);
});

test('COUNT-UP summary stores total, bull, averages, and manual correction stats', () => {
  const turns: CountUpTurn[] = [
    {
      id: 'turn-1',
      roundNo: 1,
      status: 'confirmed',
      score: 0,
      darts: [
        makeDart('dart-1', 1, 'triple', 20, 60, 'active', 0),
        makeDart('dart-2', 2, 'inner_bull', null, 50, 'active', 1),
        makeDart('dart-3', 3, 'miss', null, 0, 'voided', 0),
      ],
    },
    {
      id: 'turn-2',
      roundNo: 2,
      status: 'confirmed',
      score: 0,
      darts: [makeDart('dart-4', 1, 'double', 18, 36, 'active', 0)],
    },
  ];

  const result = summarizeCountUpGame(turns);

  assert.equal(result.totalScore, 146);
  assert.equal(result.bullCount, 1);
  assert.equal(result.tripleCount, 1);
  assert.equal(result.doubleCount, 1);
  assert.equal(result.missCount, 0);
  assert.deepEqual(result.roundScores, [110, 36]);
  assert.equal(result.roundAverageMilli, 73000);
  assert.equal(result.fullyManualDarts, 3);
  assert.equal(result.correctionCount, 1);
});

function makeDart(
  id: string,
  dartNo: 1 | 2 | 3,
  area: 'single' | 'double' | 'triple' | 'outer_bull' | 'inner_bull' | 'miss',
  segmentNumber: number | null,
  score: number,
  status: 'active' | 'voided' | 'invalidated',
  correctionCount: number,
): CountUpDart {
  const multiplier = getMultiplier(area);

  return {
    id,
    turnId: 'turn',
    dartNo,
    area,
    segmentNumber,
    multiplier,
    score,
    status,
    inputSource: 'manual_segment' as const,
    correctionCount,
    clientActionId: `action-${id}`,
    createdAt: '2026-07-13T00:00:00.000Z',
  };
}

function getMultiplier(
  area: 'single' | 'double' | 'triple' | 'outer_bull' | 'inner_bull' | 'miss',
): 0 | 1 | 2 | 3 {
  if (area === 'miss') {
    return 0;
  }
  if (area === 'triple') {
    return 3;
  }
  if (area === 'double' || area === 'inner_bull') {
    return 2;
  }
  return 1;
}

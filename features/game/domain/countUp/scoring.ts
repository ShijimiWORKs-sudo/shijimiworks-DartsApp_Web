import type { BullRule, DartArea } from '../types';
import type { CountUpDart, CountUpDartInput, CountUpResult, CountUpTurn } from './types';

export function calculateCountUpDartScore(input: CountUpDartInput, bullRule: BullRule): number {
  validateCountUpDartInput(input);

  switch (input.area) {
    case 'single':
      return getSegmentNumber(input);
    case 'double':
      return getSegmentNumber(input) * 2;
    case 'triple':
      return getSegmentNumber(input) * 3;
    case 'outer_bull':
      return bullRule === 'fat_bull' ? 50 : 25;
    case 'inner_bull':
      return 50;
    case 'miss':
      return 0;
  }
}

export function getCountUpMultiplier(area: DartArea): 0 | 1 | 2 | 3 {
  switch (area) {
    case 'single':
    case 'outer_bull':
      return 1;
    case 'double':
    case 'inner_bull':
      return 2;
    case 'triple':
      return 3;
    case 'miss':
      return 0;
  }
}

export function validateCountUpDartInput(input: CountUpDartInput): void {
  if (input.area === 'single' || input.area === 'double' || input.area === 'triple') {
    const segmentNumber = input.segmentNumber;
    if (
      !Number.isInteger(segmentNumber) ||
      segmentNumber === null ||
      segmentNumber < 1 ||
      segmentNumber > 20
    ) {
      throw new Error('S/D/T must use a segment number from 1 to 20.');
    }
    return;
  }

  if (input.segmentNumber !== null) {
    throw new Error('Bull and miss inputs must not include a segment number.');
  }
}

function getSegmentNumber(input: CountUpDartInput): number {
  if (input.segmentNumber === null) {
    throw new Error('S/D/T must use a segment number from 1 to 20.');
  }
  return input.segmentNumber;
}

export function summarizeTurn(darts: CountUpDart[]): number {
  return darts
    .filter((dart) => dart.status === 'active')
    .reduce((sum, dart) => sum + dart.score, 0);
}

export function summarizeCountUpGame(turns: CountUpTurn[]): CountUpResult {
  const activeDarts = turns.flatMap((turn) =>
    turn.darts.filter((dart) => dart.status === 'active'),
  );
  const roundScores = turns.map((turn) => summarizeTurn(turn.darts));
  const totalScore = roundScores.reduce((sum, score) => sum + score, 0);
  const dartsThrown = activeDarts.length;

  return {
    totalScore,
    roundAverageMilli: Math.round((totalScore * 1000) / Math.max(roundScores.length, 1)),
    dartAverageMilli: dartsThrown === 0 ? 0 : Math.round((totalScore * 1000) / dartsThrown),
    bullCount: activeDarts.filter(
      (dart) => dart.area === 'outer_bull' || dart.area === 'inner_bull',
    ).length,
    innerBullCount: activeDarts.filter((dart) => dart.area === 'inner_bull').length,
    outerBullCount: activeDarts.filter((dart) => dart.area === 'outer_bull').length,
    tripleCount: activeDarts.filter((dart) => dart.area === 'triple').length,
    doubleCount: activeDarts.filter((dart) => dart.area === 'double').length,
    missCount: activeDarts.filter((dart) => dart.area === 'miss').length,
    highRoundScore: roundScores.length ? Math.max(...roundScores) : 0,
    lowRoundScore: roundScores.length ? Math.min(...roundScores) : 0,
    roundScores,
    dartsThrown,
    fullyManualDarts: activeDarts.filter((dart) => dart.inputSource.startsWith('manual_')).length,
    correctionCount: turns
      .flatMap((turn) => turn.darts)
      .reduce((sum, dart) => sum + dart.correctionCount, 0),
  };
}

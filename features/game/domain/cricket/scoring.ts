import type { BullRule, DartArea } from '../types';
import type {
  CricketDartInput,
  CricketSummary,
  CricketTarget,
  CricketTargetState,
  CricketTurn,
} from './types';
import { CRICKET_TARGETS } from './types';

export type CricketTurnProgress = {
  marksTotal: number;
  pointsScored: number;
};

export type CricketProgress = {
  targetStates: CricketTargetState[];
  turnStats: Map<string, CricketTurnProgress>;
  currentScore: number;
};

export function calculateCricketDart(input: CricketDartInput, bullRule: BullRule) {
  validateCricketDartInput(input);

  const multiplier = getCricketMultiplier(input.area, bullRule);
  const score = calculateDisplayScore(input, bullRule, multiplier);
  const target = getCricketTarget(input);
  const cricketMarks = target ? getCricketMarks(input.area) : 0;

  return { multiplier, score, target, cricketMarks };
}

export function getCricketTarget(input: Pick<CricketDartInput, 'area' | 'segmentNumber'>) {
  if (input.area === 'outer_bull' || input.area === 'inner_bull') {
    return 'BULL' satisfies CricketTarget;
  }

  if (
    (input.area === 'single' || input.area === 'double' || input.area === 'triple') &&
    input.segmentNumber !== null &&
    input.segmentNumber >= 15 &&
    input.segmentNumber <= 20
  ) {
    return String(input.segmentNumber) as CricketTarget;
  }

  return null;
}

export function summarizeCricketGame(turns: CricketTurn[]): CricketSummary {
  const countedTurns = turns.filter((turn) => turn.status !== 'in_progress');
  const activeDarts = countedTurns.flatMap((turn) =>
    turn.darts.filter((dart) => dart.status === 'active'),
  );
  const targetStates = buildCricketTargetStates(countedTurns);
  const finalCricketScore = targetStates.reduce((sum, state) => sum + state.pointsScored, 0);
  const marksTotal = activeDarts.reduce((sum, dart) => sum + dart.cricketMarks, 0);
  const closedTargetCount = targetStates.filter((state) => state.isClosed).length;
  const allTargetsClosed = closedTargetCount === CRICKET_TARGETS.length;
  const allClosedZeroScore = allTargetsClosed && finalCricketScore === 0;

  return {
    finalCricketScore,
    marksTotal,
    mprMilli: countedTurns.length === 0 ? 0 : Math.round((marksTotal * 1000) / countedTurns.length),
    closedTargetCount,
    allTargetsClosed,
    allClosedZeroScore,
    clearFlag: allTargetsClosed && finalCricketScore > 0,
    roundsPlayed:
      countedTurns.length === 0 ? 0 : Math.max(...countedTurns.map((turn) => turn.roundNo)),
    turnsPlayed: countedTurns.length,
    dartsThrown: activeDarts.length,
    bullCount: activeDarts.filter(
      (dart) => dart.area === 'outer_bull' || dart.area === 'inner_bull',
    ).length,
    innerBullCount: activeDarts.filter((dart) => dart.area === 'inner_bull').length,
    outerBullCount: activeDarts.filter((dart) => dart.area === 'outer_bull').length,
    tripleCount: activeDarts.filter((dart) => dart.area === 'triple').length,
    doubleCount: activeDarts.filter((dart) => dart.area === 'double').length,
    missCount: activeDarts.filter((dart) => dart.area === 'miss').length,
    turns5MarksPlus: countedTurns.filter((turn) => turn.cricketMarksTotal >= 5).length,
    turns7MarksPlus: countedTurns.filter((turn) => turn.cricketMarksTotal >= 7).length,
    turns9Marks: countedTurns.filter((turn) => turn.cricketMarksTotal === 9).length,
    fullyManualDarts: activeDarts.filter((dart) => dart.inputSource.startsWith('manual_')).length,
    correctionCount: countedTurns
      .flatMap((turn) => turn.darts)
      .reduce((sum, dart) => sum + dart.correctionCount, 0),
    targetStates,
  };
}

export function buildCricketTargetStates(turns: CricketTurn[]): CricketTargetState[] {
  return evaluateCricketProgress(turns).targetStates;
}

export function evaluateCricketProgress(turns: CricketTurn[]): CricketProgress {
  const states = new Map<CricketTarget, CricketTargetState>();
  const turnStats = new Map<string, CricketTurnProgress>();
  for (const target of CRICKET_TARGETS) {
    states.set(target, {
      target,
      marksTotal: 0,
      isClosed: false,
      closedAtTurnId: null,
      closedAtRoundNo: null,
      pointsScored: 0,
    });
  }

  const darts = turns
    .slice()
    .sort((a, b) => a.turnSequenceNo - b.turnSequenceNo)
    .flatMap((turn) =>
      turn.darts
        .filter((dart) => dart.status === 'active')
        .sort((a, b) => a.dartNo - b.dartNo)
        .map((dart) => ({ turn, dart })),
    );

  for (const { turn, dart } of darts) {
    const stats = turnStats.get(turn.id) ?? { marksTotal: 0, pointsScored: 0 };
    stats.marksTotal += dart.cricketMarks;
    turnStats.set(turn.id, stats);

    const target = getCricketTarget(dart);
    if (!target || dart.cricketMarks <= 0) {
      continue;
    }

    const state = states.get(target);
    if (!state) {
      continue;
    }

    const marksNeeded = Math.max(3 - state.marksTotal, 0);
    const scoringMarks = Math.max(dart.cricketMarks - marksNeeded, 0);
    const pointsScored = scoringMarks * getTargetPointValue(target);
    state.marksTotal += dart.cricketMarks;
    state.pointsScored += pointsScored;
    stats.pointsScored += pointsScored;
    if (!state.isClosed && state.marksTotal >= 3) {
      state.isClosed = true;
      state.closedAtTurnId = turn.id;
      state.closedAtRoundNo = turn.roundNo;
    }
  }

  const targetStates = CRICKET_TARGETS.map((target) => states.get(target)).filter(
    (state): state is CricketTargetState => Boolean(state),
  );

  return {
    targetStates,
    turnStats,
    currentScore: targetStates.reduce((sum, state) => sum + state.pointsScored, 0),
  };
}

export function isNaturalCricketFinish(targetStates: CricketTargetState[]) {
  return (
    targetStates.every((state) => state.isClosed) &&
    targetStates.reduce((sum, state) => sum + state.pointsScored, 0) > 0
  );
}

function validateCricketDartInput(input: CricketDartInput): void {
  if (input.area === 'single' || input.area === 'double' || input.area === 'triple') {
    if (
      !Number.isInteger(input.segmentNumber) ||
      input.segmentNumber === null ||
      input.segmentNumber < 1 ||
      input.segmentNumber > 20
    ) {
      throw new Error('Segment darts must use a segment number from 1 to 20.');
    }
    return;
  }

  if (input.segmentNumber !== null) {
    throw new Error('Bull and miss darts cannot have a segment number.');
  }
}

function getCricketMultiplier(area: DartArea, bullRule: BullRule): 0 | 1 | 2 | 3 {
  switch (area) {
    case 'single':
      return 1;
    case 'double':
      return 2;
    case 'triple':
      return 3;
    case 'outer_bull':
      return bullRule === 'fat_bull' ? 2 : 1;
    case 'inner_bull':
      return 2;
    case 'miss':
      return 0;
  }
}

function calculateDisplayScore(
  input: CricketDartInput,
  bullRule: BullRule,
  multiplier: 0 | 1 | 2 | 3,
): number {
  if (input.area === 'miss') {
    return 0;
  }

  if (input.area === 'outer_bull') {
    return bullRule === 'fat_bull' ? 50 : 25;
  }

  if (input.area === 'inner_bull') {
    return 50;
  }

  return (input.segmentNumber ?? 0) * multiplier;
}

function getCricketMarks(area: DartArea): number {
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

function getTargetPointValue(target: CricketTarget): number {
  return target === 'BULL' ? 25 : Number(target);
}

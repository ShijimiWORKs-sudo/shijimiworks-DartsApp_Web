import type { BullRule, DartArea } from '../types';
import type {
  ZeroOneDart,
  ZeroOneDartInput,
  ZeroOneLastTurnResult,
  ZeroOneOutRule,
  ZeroOneResult,
  ZeroOneStartScore,
  ZeroOneTurn,
} from './types';

export const ZERO_ONE_START_SCORES: ZeroOneStartScore[] = [301, 501, 701, 901];
export const ZERO_ONE_MAX_ROUNDS = 15;

export type ZeroOneTurnEvaluation = {
  status: 'in_progress' | 'confirmed' | 'bust' | 'checkout';
  rawScore: number;
  appliedScore: number;
  endRemainingScore: number;
  isBust: boolean;
  isCheckout: boolean;
};

export function validateZeroOneStartScore(value: number): ZeroOneStartScore {
  if (ZERO_ONE_START_SCORES.includes(value as ZeroOneStartScore)) {
    return value as ZeroOneStartScore;
  }
  throw new Error('Unsupported 01 start score.');
}

export function calculateZeroOneDartScore(input: ZeroOneDartInput, bullRule: BullRule) {
  validateZeroOneDartInput(input);

  const multiplier = getZeroOneMultiplier(input.area, bullRule);
  const score =
    input.area === 'miss'
      ? 0
      : input.area === 'outer_bull'
        ? bullRule === 'fat_bull'
          ? 50
          : 25
        : input.area === 'inner_bull'
          ? 50
          : (input.segmentNumber ?? 0) * multiplier;

  return { multiplier, score };
}

export function evaluateZeroOneTurn(
  startRemainingScore: number,
  darts: Pick<ZeroOneDart, 'score' | 'area' | 'status'>[],
  outRule: ZeroOneOutRule,
  forceConfirm = false,
): ZeroOneTurnEvaluation {
  const activeDarts = darts.filter((dart) => dart.status === 'active');
  const rawScore = activeDarts.reduce((sum, dart) => sum + dart.score, 0);
  const projectedRemaining = startRemainingScore - rawScore;
  const lastDart = activeDarts[activeDarts.length - 1] ?? null;

  if (lastDart && projectedRemaining < 0) {
    return {
      status: 'bust',
      rawScore,
      appliedScore: 0,
      endRemainingScore: startRemainingScore,
      isBust: true,
      isCheckout: false,
    };
  }

  if (lastDart && projectedRemaining === 0) {
    const isCheckout =
      outRule === 'single_out' ||
      ['double', 'triple', 'outer_bull', 'inner_bull'].includes(lastDart.area);

    if (isCheckout) {
      return {
        status: 'checkout',
        rawScore,
        appliedScore: rawScore,
        endRemainingScore: 0,
        isBust: false,
        isCheckout: true,
      };
    }

    return {
      status: 'bust',
      rawScore,
      appliedScore: 0,
      endRemainingScore: startRemainingScore,
      isBust: true,
      isCheckout: false,
    };
  }

  return {
    status: forceConfirm ? 'confirmed' : 'in_progress',
    rawScore,
    appliedScore: rawScore,
    endRemainingScore: projectedRemaining,
    isBust: false,
    isCheckout: false,
  };
}

export function summarizeZeroOneGame(
  turns: ZeroOneTurn[],
  startScore: ZeroOneStartScore,
  completionReason: 'checkout' | 'round_limit',
): ZeroOneResult {
  const countedTurns = turns.filter((turn) =>
    ['confirmed', 'bust', 'checkout'].includes(turn.status),
  );
  const activeDarts = countedTurns.flatMap((turn) =>
    turn.darts.filter((dart) => dart.status === 'active'),
  );
  const effectiveScore = countedTurns.reduce((sum, turn) => sum + turn.appliedScore, 0);
  const dartsThrown = activeDarts.length;
  const checkoutTurn = countedTurns.find((turn) => turn.isCheckout) ?? null;
  const checkoutDarts = checkoutTurn
    ? countedTurns
        .filter((turn) => turn.turnSequenceNo <= checkoutTurn.turnSequenceNo)
        .reduce((sum, turn) => sum + turn.dartCount, 0)
    : null;
  const finalRemainingScore = checkoutTurn ? 0 : Math.max(startScore - effectiveScore, 0);
  const ppdMilli = dartsThrown === 0 ? 0 : Math.round((effectiveScore * 1000) / dartsThrown);

  return {
    startScore,
    finalRemainingScore,
    effectiveScore,
    dartsThrown,
    roundsPlayed:
      countedTurns.length === 0 ? 0 : Math.max(...countedTurns.map((turn) => turn.roundNo)),
    turnsPlayed: countedTurns.length,
    bustCount: countedTurns.filter((turn) => turn.isBust).length,
    bullCount: activeDarts.filter(
      (dart) => dart.area === 'outer_bull' || dart.area === 'inner_bull',
    ).length,
    innerBullCount: activeDarts.filter((dart) => dart.area === 'inner_bull').length,
    outerBullCount: activeDarts.filter((dart) => dart.area === 'outer_bull').length,
    tripleCount: activeDarts.filter((dart) => dart.area === 'triple').length,
    doubleCount: activeDarts.filter((dart) => dart.area === 'double').length,
    missCount: activeDarts.filter((dart) => dart.area === 'miss').length,
    turns100Plus: countedTurns.filter((turn) => turn.appliedScore >= 100).length,
    turns140Plus: countedTurns.filter((turn) => turn.appliedScore >= 140).length,
    turns180: countedTurns.filter((turn) => turn.appliedScore === 180).length,
    ppdMilli,
    threeDartAverageMilli: ppdMilli * 3,
    completionReason,
    checkoutRoundNo: checkoutTurn?.roundNo ?? null,
    checkoutDarts,
    outboxStatus: null,
  };
}

export function toZeroOneLastTurnResult(turn: ZeroOneTurn | null): ZeroOneLastTurnResult | null {
  if (!turn || turn.status === 'in_progress') {
    return null;
  }

  return {
    id: turn.id,
    roundNo: turn.roundNo,
    turnSequenceNo: turn.turnSequenceNo,
    status: turn.status,
    rawScore: turn.rawScore,
    appliedScore: turn.appliedScore,
    startRemainingScore: turn.startRemainingScore,
    endRemainingScore: turn.endRemainingScore,
    dartCount: turn.dartCount,
    isBust: turn.isBust,
    isCheckout: turn.isCheckout,
  };
}

function validateZeroOneDartInput(input: ZeroOneDartInput) {
  if (['single', 'double', 'triple'].includes(input.area)) {
    if (!input.segmentNumber || input.segmentNumber < 1 || input.segmentNumber > 20) {
      throw new Error('Segment number is required for segment darts.');
    }
    return;
  }

  if (input.segmentNumber !== null) {
    throw new Error('Bull and miss darts cannot have a segment number.');
  }
}

function getZeroOneMultiplier(area: DartArea, bullRule: BullRule): 0 | 1 | 2 | 3 {
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

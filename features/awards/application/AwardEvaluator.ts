import type { AwardCode, AwardContext, AwardDart, AwardEvent } from '../domain/types';

const PRIORITY: Record<AwardCode, number> = {
  THREE_IN_THE_BLACK: 100,
  WHITE_HORSE: 90,
  HAT_TRICK: 80,
  TON_80: 70,
  HIGH_TON: 60,
  LOW_TON: 50,
  CRICKET_TRIPLE: 30,
  CRICKET_DOUBLE: 25,
  IN_BULL: 20,
  OUT_BULL: 19,
  TRIPLE: 18,
  DOUBLE: 17,
  NORMAL: 1,
};

const LABELS: Record<AwardCode, string> = {
  LOW_TON: 'LOW TON',
  HIGH_TON: 'HIGH TON',
  TON_80: 'TON 80',
  HAT_TRICK: 'HAT TRICK',
  THREE_IN_THE_BLACK: 'THREE IN THE BLACK',
  WHITE_HORSE: 'WHITE HORSE',
  IN_BULL: 'IN BULL',
  OUT_BULL: 'OUT BULL',
  NORMAL: 'NORMAL',
  DOUBLE: 'DOUBLE',
  TRIPLE: 'TRIPLE',
  CRICKET_DOUBLE: 'CRICKET DOUBLE',
  CRICKET_TRIPLE: 'CRICKET TRIPLE',
};

export class AwardEvaluator {
  evaluateTurn(input: { darts: AwardDart[]; context: AwardContext; now?: Date }): AwardEvent {
    const activeDarts = input.darts.filter(
      (dart) => dart.status !== 'voided' && dart.status !== 'invalidated',
    );
    const code = resolveAwardCode(activeDarts, input.context.mode);
    const createdAt = (input.now ?? new Date()).toISOString();

    return {
      awardId: `${createdAt}:${code}:${activeDarts.length}:${activeDarts
        .map((dart) => `${dart.area}:${dart.segmentNumber ?? 'B'}:${dart.multiplier}`)
        .join('|')}`,
      code,
      label: LABELS[code],
      priority: PRIORITY[code],
      playbackOwner: input.context.playbackOwner,
      createdAt,
    };
  }
}

export function resolveAwardCode(darts: AwardDart[], mode: AwardContext['mode']): AwardCode {
  if (isThreeInTheBlack(darts)) {
    return 'THREE_IN_THE_BLACK';
  }
  if (mode === 'cricket' || mode === 'match') {
    if (isWhiteHorse(darts)) {
      return 'WHITE_HORSE';
    }
  }
  if (isHatTrick(darts)) {
    return 'HAT_TRICK';
  }
  if (isTon80(darts)) {
    return 'TON_80';
  }

  const score = darts.reduce((sum, dart) => sum + dart.score, 0);
  if (score >= 150 && score <= 179) {
    return 'HIGH_TON';
  }
  if (score >= 100 && score <= 149) {
    return 'LOW_TON';
  }

  const lastDart = darts[darts.length - 1];
  if (!lastDart) {
    return 'NORMAL';
  }
  if (mode === 'cricket' || mode === 'match') {
    if ((lastDart.cricketMarks ?? 0) >= 3) {
      return 'CRICKET_TRIPLE';
    }
    if ((lastDart.cricketMarks ?? 0) === 2) {
      return 'CRICKET_DOUBLE';
    }
  }
  if (lastDart.area === 'inner_bull') {
    return 'IN_BULL';
  }
  if (lastDart.area === 'outer_bull') {
    return 'OUT_BULL';
  }
  if (lastDart.area === 'triple') {
    return 'TRIPLE';
  }
  if (lastDart.area === 'double') {
    return 'DOUBLE';
  }
  return 'NORMAL';
}

function isTon80(darts: AwardDart[]) {
  return (
    darts.length === 3 && darts.every((dart) => dart.area === 'triple' && dart.segmentNumber === 20)
  );
}

function isHatTrick(darts: AwardDart[]) {
  return (
    darts.length === 3 &&
    darts.every((dart) => dart.area === 'inner_bull' || dart.area === 'outer_bull')
  );
}

function isThreeInTheBlack(darts: AwardDart[]) {
  return darts.length === 3 && darts.every((dart) => dart.area === 'inner_bull');
}

function isWhiteHorse(darts: AwardDart[]) {
  const targets = new Set<number | 'BULL'>();
  for (const dart of darts) {
    if (!dart.isCricketTarget || (dart.cricketMarks ?? 0) !== 3) {
      return false;
    }
    targets.add(dart.segmentNumber ?? 'BULL');
  }
  return darts.length === 3 && targets.size === 3;
}

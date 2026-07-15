import type {
  RatingMeasurementStatus,
  RatingObservation,
  RatingUpdateAppliedOutput,
  RatingUpdateInput,
  RatingUpdateOutput,
} from './ratingEngineTypes';

const RATING_MIN = 1;
const RATING_MAX = 18;
const MATCH_WINDOW_WEIGHTS = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55];
const PPD_ANCHORS = [
  10, 13.333, 15, 16.667, 18.333, 20, 21.667, 23.333, 25, 26.667, 28.333, 30, 32, 34, 36, 38, 40,
  42,
];
const MPR_ANCHORS = [
  0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4, 4.2,
];

type IndexedMatchObservation = RatingObservation & {
  zeroOneIndex: number;
  cricketIndex: number;
  outcomeDelta: number;
  matchSkillIndex: number;
};

export function calculateRatingUpdate(input: RatingUpdateInput): RatingUpdateOutput {
  const target = input.observations.find(
    (observation) => observation.evaluationId === input.targetEvaluationId,
  );

  if (!target) {
    return excluded(input, [], ['OBSERVATION_NOT_FOUND']);
  }

  const basicReasons = validateTarget(input, target);
  if (basicReasons.length > 0) {
    return excluded(input, target ? [target] : [], basicReasons);
  }

  const observations = input.observations
    .filter((observation) => observation.observedAt <= target.observedAt)
    .sort(compareObservedAt);
  const matchObservations = observations.filter(
    (observation) => observation.sourceType === 'match',
  );
  const effectiveMatchObservations =
    target.sourceType === 'match' && matchObservations.length === 3
      ? applyInitialOutlierControl(matchObservations)
      : matchObservations;
  const profileEstablishedAt =
    input.profile.establishedAt ??
    (target.sourceType === 'match' && matchObservations.length >= 3 ? target.observedAt : null);

  const zeroOneComponent = calculateZeroOneComponent(
    observations,
    effectiveMatchObservations,
    target,
    profileEstablishedAt,
  );
  const cricketComponent = calculateCricketComponent(
    observations,
    effectiveMatchObservations,
    target,
    profileEstablishedAt,
  );
  const indexedMatches = buildIndexedMatches(effectiveMatchObservations);
  const matchComponent = calculateMatchComponent(indexedMatches);
  const evaluatedMatchCount = Math.max(matchObservations.length, input.profile.eligibleMatchCount);
  const measurementStatus = getMeasurementStatus(evaluatedMatchCount);
  const previousPreciseRating = getPreviousPreciseRating(input);
  const sourceType = target.sourceType;
  const previousZeroOneIndex = milliToRating(input.profile.zeroOneIndexMilli);
  const previousCricketIndex = milliToRating(input.profile.cricketIndexMilli);
  const previousMatchIndex = milliToRating(input.profile.matchIndexMilli);

  const zeroOneIndex =
    sourceType === 'standalone_cricket'
      ? (previousZeroOneIndex ?? zeroOneComponent.index ?? RATING_MIN)
      : (zeroOneComponent.index ?? previousZeroOneIndex ?? cricketComponent.index ?? RATING_MIN);
  const cricketIndex =
    sourceType === 'standalone_zero_one'
      ? (previousCricketIndex ?? cricketComponent.index ?? RATING_MIN)
      : (cricketComponent.index ?? previousCricketIndex ?? zeroOneComponent.index ?? RATING_MIN);
  const matchIndex =
    sourceType === 'match'
      ? matchComponent.matchIndex
      : (previousMatchIndex ?? (zeroOneIndex + cricketIndex) / 2);
  const stabilityAdjustment = sourceType === 'match' ? matchComponent.stabilityAdjustment : 0;
  const continuityBonus = sourceType === 'match' ? matchComponent.continuityBonus : 0;
  const rawTargetRating = clamp(
    zeroOneIndex * 0.45 +
      cricketIndex * 0.45 +
      matchIndex * 0.1 +
      stabilityAdjustment +
      continuityBonus,
    RATING_MIN,
    RATING_MAX,
  );
  const smoothing = calculateSmoothing({
    sourceType,
    matchCount: matchObservations.length,
    previousPreciseRating,
    rawTargetRating,
  });
  const finalPreciseRating = smoothing.finalPreciseRating;
  const ratingTenths = Math.round(finalPreciseRating * 10);
  const preciseRatingMilli = Math.round(finalPreciseRating * 1000);
  const confidence = calculateConfidence({
    matchObservations: indexedMatches,
    calculationDateTime: input.calculationDateTime,
  });
  const confidenceBp =
    indexedMatches.length > 0 ? confidence.confidenceBp : input.profile.confidenceBp;
  const appliedDeltaMilli =
    previousPreciseRating === null
      ? null
      : Math.round((finalPreciseRating - previousPreciseRating) * 1000);
  const standaloneZeroOneCount = observations.filter(
    (observation) => observation.sourceType === 'standalone_zero_one',
  ).length;
  const standaloneCricketCount = observations.filter(
    (observation) => observation.sourceType === 'standalone_cricket',
  ).length;

  return {
    kind: 'applied',
    evaluationId: target.evaluationId,
    accountId: target.accountId,
    playerId: target.playerId,
    sourceType,
    sourceMatchId: target.sourceMatchId,
    sourceGameId: target.sourceGameId,
    previousSnapshotId: input.previousSnapshot?.id ?? null,
    measurementStatus,
    ratingTenths,
    preciseRatingMilli,
    confidenceBp,
    evaluatedMatchCount,
    evaluatedStandaloneZeroOneCount: standaloneZeroOneCount,
    evaluatedStandaloneCricketCount: standaloneCricketCount,
    windowMatchCount: indexedMatches.slice(-10).length,
    windowZeroOneObservationCount: zeroOneComponent.windowCount,
    windowCricketObservationCount: cricketComponent.windowCount,
    zeroOneIndexMilli: Math.round(zeroOneIndex * 1000),
    cricketIndexMilli: Math.round(cricketIndex * 1000),
    matchIndexMilli: Math.round(matchIndex * 1000),
    stabilityAdjustmentMilli: Math.round(stabilityAdjustment * 1000),
    continuityBonusMilli: Math.round(continuityBonus * 1000),
    appliedDeltaMilli,
    establishedAt: profileEstablishedAt,
    calculationDetailJson: stringifyCalculationDetail({
      sourceType,
      windowWeights: MATCH_WINDOW_WEIGHTS.slice(0, Math.min(indexedMatches.length, 10)),
      windowPpd: zeroOneComponent.windowPpd,
      windowMpr: cricketComponent.windowMpr,
      zeroOneIndex,
      cricketIndex,
      weightedOutcomeDelta: matchComponent.weightedOutcomeDelta,
      matchIndex,
      baseRating: zeroOneIndex * 0.45 + cricketIndex * 0.45 + matchIndex * 0.1,
      weightedStdDev: matchComponent.weightedStdDev,
      stabilityAdjustment,
      continuityBonus,
      rawTargetRating,
      previousPreciseRating,
      smoothingAlpha: smoothing.alpha,
      changeCap: smoothing.changeCap,
      finalPreciseRating,
      displayRating: ratingTenths / 10,
      confidence,
      initialOutlierControl:
        target.sourceType === 'match' && matchObservations.length === 3
          ? describeInitialOutlierControl(matchObservations, effectiveMatchObservations)
          : null,
      standaloneConfidenceBonus: 0,
    }),
  };
}

export function interpolateRatingIndex(value: number, anchors: readonly number[]): number {
  if (value <= anchors[0]) return RATING_MIN;
  if (value >= anchors[anchors.length - 1]) return RATING_MAX;

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const left = anchors[index];
    const right = anchors[index + 1];
    if (value >= left && value <= right) {
      const fraction = (value - left) / (right - left);
      return index + 1 + fraction;
    }
  }

  return RATING_MAX;
}

export function ppdMilliToRatingIndex(ppdMilli: number): number {
  return interpolateRatingIndex(ppdMilli / 1000, PPD_ANCHORS);
}

export function mprMilliToRatingIndex(mprMilli: number): number {
  return interpolateRatingIndex(mprMilli / 1000, MPR_ANCHORS);
}

function validateTarget(input: RatingUpdateInput, target: RatingObservation): string[] {
  const reasons: string[] = [];
  if (target.accountId !== input.profile.accountId) reasons.push('ACCOUNT_MISMATCH');
  if (target.playerId !== input.profile.ownerPlayerId) reasons.push('OWNER_NOT_LINKED');
  if (target.sourceType === 'standalone_zero_one' && !input.profile.establishedAt) {
    reasons.push('INITIAL_RATING_NOT_ESTABLISHED');
  }
  if (target.sourceType === 'standalone_cricket' && !input.profile.establishedAt) {
    reasons.push('INITIAL_RATING_NOT_ESTABLISHED');
  }
  if (
    input.profile.establishedAt &&
    target.sourceType !== 'match' &&
    target.observedAt < input.profile.establishedAt
  ) {
    reasons.push('GAME_BEFORE_RATING_ESTABLISHED');
  }
  if (
    target.sourceType === 'standalone_cricket' &&
    target.cricketClearFlag &&
    target.cricketFinalScore === 0
  ) {
    reasons.push('INVALID_CRICKET_ZERO_POINT_CLEAR');
  }
  if (target.sourceType === 'match' && target.matchCompletionReason === 'aborted') {
    reasons.push('MATCH_ABORTED');
  }
  if (
    target.sourceType === 'match' &&
    target.zeroOnePpdMilli === null &&
    target.cricketMprMilli === null
  ) {
    reasons.push('MISSING_MATCH_OBSERVATION');
  }
  if (target.sourceType === 'standalone_zero_one' && target.zeroOnePpdMilli === null) {
    reasons.push('MISSING_ZERO_ONE_OBSERVATION');
  }
  if (target.sourceType === 'standalone_cricket' && target.cricketMprMilli === null) {
    reasons.push('MISSING_CRICKET_OBSERVATION');
  }
  return reasons;
}

function excluded(
  input: RatingUpdateInput,
  observations: RatingObservation[],
  reasonCodes: string[],
): RatingUpdateOutput {
  const target = observations.find(
    (observation) => observation.evaluationId === input.targetEvaluationId,
  );
  return {
    kind: 'excluded',
    evaluationId: input.targetEvaluationId,
    accountId: target?.accountId ?? input.profile.accountId,
    sourceType: target?.sourceType ?? 'match',
    sourceMatchId: target?.sourceMatchId ?? null,
    sourceGameId: target?.sourceGameId ?? null,
    reasonCodes,
  };
}

function calculateZeroOneComponent(
  observations: RatingObservation[],
  effectiveMatches: RatingObservation[],
  target: RatingObservation,
  establishedAt: string | null,
) {
  const matchById = new Map(
    effectiveMatches.map((observation) => [observation.evaluationId, observation]),
  );
  const candidates = observations
    .map((observation) => matchById.get(observation.evaluationId) ?? observation)
    .filter((observation) => {
      if (observation.zeroOnePpdMilli === null) return false;
      if (observation.sourceType === 'standalone_zero_one') {
        return establishedAt !== null && observation.observedAt >= establishedAt;
      }
      return observation.sourceType === 'match';
    });
  const window = candidates.slice(-10).reverse();
  let weightedScore = 0;
  let weightedDarts = 0;

  window.forEach((observation, index) => {
    const recencyWeight =
      MATCH_WINDOW_WEIGHTS[index] ?? MATCH_WINDOW_WEIGHTS[MATCH_WINDOW_WEIGHTS.length - 1];
    const sourceWeight = observation.sourceType === 'standalone_zero_one' ? 0.5 : 1;
    const weight = recencyWeight * sourceWeight;
    const darts = Math.max(observation.totalDarts, 1);
    weightedScore += weight * ((observation.zeroOnePpdMilli ?? 0) / 1000) * darts;
    weightedDarts += weight * darts;
  });

  const windowPpd = weightedDarts > 0 ? weightedScore / weightedDarts : null;
  return {
    index: windowPpd === null ? null : interpolateRatingIndex(windowPpd, PPD_ANCHORS),
    windowPpd,
    windowCount: window.length,
    targetIncluded: window.some((observation) => observation.evaluationId === target.evaluationId),
  };
}

function calculateCricketComponent(
  observations: RatingObservation[],
  effectiveMatches: RatingObservation[],
  target: RatingObservation,
  establishedAt: string | null,
) {
  const matchById = new Map(
    effectiveMatches.map((observation) => [observation.evaluationId, observation]),
  );
  const candidates = observations
    .map((observation) => matchById.get(observation.evaluationId) ?? observation)
    .filter((observation) => {
      if (observation.cricketMprMilli === null) return false;
      if (observation.sourceType === 'standalone_cricket') {
        return establishedAt !== null && observation.observedAt >= establishedAt;
      }
      return observation.sourceType === 'match';
    });
  const window = candidates.slice(-10).reverse();
  let weightedMarks = 0;
  let weightedRounds = 0;

  window.forEach((observation, index) => {
    const recencyWeight =
      MATCH_WINDOW_WEIGHTS[index] ?? MATCH_WINDOW_WEIGHTS[MATCH_WINDOW_WEIGHTS.length - 1];
    const sourceWeight = observation.sourceType === 'standalone_cricket' ? 0.5 : 1;
    const weight = recencyWeight * sourceWeight;
    const rounds = Math.max(
      observation.totalRounds,
      Math.ceil(Math.max(observation.totalDarts, 1) / 3),
      1,
    );
    weightedMarks += weight * ((observation.cricketMprMilli ?? 0) / 1000) * rounds;
    weightedRounds += weight * rounds;
  });

  const windowMpr = weightedRounds > 0 ? weightedMarks / weightedRounds : null;
  return {
    index: windowMpr === null ? null : interpolateRatingIndex(windowMpr, MPR_ANCHORS),
    windowMpr,
    windowCount: window.length,
    targetIncluded: window.some((observation) => observation.evaluationId === target.evaluationId),
  };
}

function buildIndexedMatches(observations: RatingObservation[]): IndexedMatchObservation[] {
  return observations.map((observation) => {
    const zeroOneIndex = ppdMilliToRatingIndex(observation.zeroOnePpdMilli ?? 10000);
    const cricketIndex = mprMilliToRatingIndex(observation.cricketMprMilli ?? 800);
    const outcomeDelta = calculateOutcomeDelta(observation);
    const matchSkillIndex = clamp(
      (zeroOneIndex + cricketIndex) / 2 + outcomeDelta,
      RATING_MIN,
      RATING_MAX,
    );
    return { ...observation, zeroOneIndex, cricketIndex, outcomeDelta, matchSkillIndex };
  });
}

function calculateMatchComponent(matches: IndexedMatchObservation[]) {
  const window = matches.slice(-10).reverse();
  if (window.length === 0) {
    return {
      matchIndex: RATING_MIN,
      weightedOutcomeDelta: 0,
      weightedStdDev: 0,
      stabilityAdjustment: 0,
      continuityBonus: 0,
    };
  }

  const zeroOneIndex = weightedAverage(window.map((match) => match.zeroOneIndex));
  const cricketIndex = weightedAverage(window.map((match) => match.cricketIndex));
  const weightedOutcomeDelta = weightedAverage(window.map((match) => match.outcomeDelta));
  const performanceMid = (zeroOneIndex + cricketIndex) / 2;
  const matchIndex = clamp(performanceMid + weightedOutcomeDelta, RATING_MIN, RATING_MAX);
  const weightedStdDev = calculateWeightedStdDev(window.map((match) => match.matchSkillIndex));
  const stabilityAdjustment = -Math.min(0.6, Math.max(0, weightedStdDev - 0.75) * 0.25);
  const volumeBonus = Math.min(0.15, Math.max(0, (window.length - 4) * 0.025));
  const recentThreeStdDev = calculateWeightedStdDev(
    window.slice(0, 3).map((match) => match.matchSkillIndex),
  );
  const consistencyBonus = recentThreeStdDev <= 1 ? 0.1 : recentThreeStdDev <= 1.5 ? 0.05 : 0;
  const continuityBonus = Math.min(0.25, volumeBonus + consistencyBonus);

  return {
    matchIndex,
    weightedOutcomeDelta,
    weightedStdDev,
    stabilityAdjustment,
    continuityBonus,
  };
}

function calculateOutcomeDelta(observation: RatingObservation): number {
  if (observation.manualOutcomeAdjustment) return 0;
  if (observation.matchCompletionReason === 'two_zero') {
    return observation.matchResult === 'win' ? 8.5 : -8.5;
  }
  if (observation.matchCompletionReason === 'two_one') {
    return observation.matchResult === 'win' ? 5 : -5;
  }
  return 0;
}

function calculateSmoothing(input: {
  sourceType: RatingObservation['sourceType'];
  matchCount: number;
  previousPreciseRating: number | null;
  rawTargetRating: number;
}) {
  if (
    input.previousPreciseRating === null ||
    (input.sourceType === 'match' && input.matchCount === 3)
  ) {
    return {
      finalPreciseRating: input.rawTargetRating,
      alpha: null,
      changeCap: null,
    };
  }

  if (input.sourceType !== 'match') {
    return smooth(input.previousPreciseRating, input.rawTargetRating, 0.25, 0.2);
  }

  return input.matchCount >= 10
    ? smooth(input.previousPreciseRating, input.rawTargetRating, 0.4, 0.5)
    : smooth(input.previousPreciseRating, input.rawTargetRating, 0.5, 0.6);
}

function smooth(previous: number, target: number, alpha: number, changeCap: number) {
  const candidateDelta = (target - previous) * alpha;
  return {
    finalPreciseRating: clamp(
      previous + clamp(candidateDelta, -changeCap, changeCap),
      RATING_MIN,
      RATING_MAX,
    ),
    alpha,
    changeCap,
  };
}

function calculateConfidence(input: {
  matchObservations: IndexedMatchObservation[];
  calculationDateTime: string;
}) {
  const matchCount = input.matchObservations.length;
  if (matchCount === 0) {
    return {
      confidenceBp: 0,
      volumeFactor: 0,
      recencyFactor: 0,
      dataQualityFactor: 1,
      stabilityFactor: 0,
    };
  }

  const volumeFactors = [0, 0.1, 0.25, 0.45, 0.55, 0.65, 0.72, 0.79, 0.86, 0.93];
  const volumeFactor = matchCount >= 10 ? 1 : volumeFactors[matchCount];
  const latestMatch = input.matchObservations[input.matchObservations.length - 1];
  const daysSinceLatest = Math.max(
    0,
    (Date.parse(input.calculationDateTime) - Date.parse(latestMatch.observedAt)) / 86_400_000,
  );
  const recencyFactor =
    daysSinceLatest <= 7
      ? 1
      : daysSinceLatest <= 30
        ? 0.9
        : daysSinceLatest <= 60
          ? 0.75
          : daysSinceLatest <= 90
            ? 0.6
            : daysSinceLatest <= 180
              ? 0.4
              : 0.2;
  const totalDarts = input.matchObservations.reduce(
    (sum, observation) => sum + Math.max(observation.totalDarts, 0),
    0,
  );
  const corrections = input.matchObservations.reduce(
    (sum, observation) => sum + Math.max(observation.correctionCount, 0),
    0,
  );
  const adjusted = input.matchObservations.reduce(
    (sum, observation) => sum + Math.max(observation.adjustedDarts, 0),
    0,
  );
  const correctionPenalty = Math.min(0.25, (corrections / Math.max(totalDarts, 1)) * 5);
  const adjustedPenalty = Math.min(0.1, (adjusted / Math.max(totalDarts, 1)) * 0.2);
  const dataQualityFactor = clamp(1 - correctionPenalty - adjustedPenalty, 0.5, 1);
  const stabilityFactor =
    matchCount === 1
      ? 0.5
      : clamp(
          1 -
            calculateWeightedStdDev(input.matchObservations.map((match) => match.matchSkillIndex)) /
              4,
          0.25,
          1,
        );
  const confidencePercent =
    volumeFactor * 55 + recencyFactor * 15 + dataQualityFactor * 15 + stabilityFactor * 15;
  const cappedConfidencePercent =
    matchCount === 1
      ? Math.min(confidencePercent, 25)
      : matchCount === 2
        ? Math.min(confidencePercent, 45)
        : confidencePercent;

  return {
    confidenceBp: Math.round(cappedConfidencePercent * 100),
    volumeFactor,
    recencyFactor,
    dataQualityFactor,
    stabilityFactor,
  };
}

function applyInitialOutlierControl(observations: RatingObservation[]): RatingObservation[] {
  const medianPpd = median(
    observations.map((observation) => (observation.zeroOnePpdMilli ?? 10000) / 1000),
  );
  const medianMpr = median(
    observations.map((observation) => (observation.cricketMprMilli ?? 800) / 1000),
  );
  return observations.map((observation) => ({
    ...observation,
    zeroOnePpdMilli:
      observation.zeroOnePpdMilli === null
        ? null
        : Math.round(
            clamp(observation.zeroOnePpdMilli / 1000, medianPpd - 6, medianPpd + 6) * 1000,
          ),
    cricketMprMilli:
      observation.cricketMprMilli === null
        ? null
        : Math.round(
            clamp(observation.cricketMprMilli / 1000, medianMpr - 0.6, medianMpr + 0.6) * 1000,
          ),
  }));
}

function describeInitialOutlierControl(
  original: RatingObservation[],
  adjusted: RatingObservation[],
) {
  return original.map((observation, index) => ({
    evaluationId: observation.evaluationId,
    originalPpd: observation.zeroOnePpdMilli === null ? null : observation.zeroOnePpdMilli / 1000,
    adjustedPpd:
      adjusted[index]?.zeroOnePpdMilli === null
        ? null
        : (adjusted[index]?.zeroOnePpdMilli ?? 0) / 1000,
    originalMpr: observation.cricketMprMilli === null ? null : observation.cricketMprMilli / 1000,
    adjustedMpr:
      adjusted[index]?.cricketMprMilli === null
        ? null
        : (adjusted[index]?.cricketMprMilli ?? 0) / 1000,
  }));
}

function getPreviousPreciseRating(input: RatingUpdateInput): number | null {
  if (
    input.previousSnapshot?.preciseRatingMilli !== null &&
    input.previousSnapshot?.preciseRatingMilli !== undefined
  ) {
    return input.previousSnapshot.preciseRatingMilli / 1000;
  }
  if (
    input.previousSnapshot?.ratingTenths !== null &&
    input.previousSnapshot?.ratingTenths !== undefined
  ) {
    return input.previousSnapshot.ratingTenths / 10;
  }
  if (input.profile.preciseRatingMilli !== null) return input.profile.preciseRatingMilli / 1000;
  if (input.profile.ratingTenths !== null) return input.profile.ratingTenths / 10;
  return null;
}

function getMeasurementStatus(matchCount: number): RatingMeasurementStatus {
  if (matchCount <= 0) return 'unmeasured';
  if (matchCount === 1) return 'provisional_1_of_3';
  if (matchCount === 2) return 'provisional_2_of_3';
  if (matchCount <= 4) return 'provisional';
  if (matchCount <= 9) return 'standard';
  return 'stable';
}

function compareObservedAt(left: RatingObservation, right: RatingObservation) {
  if (left.observedAt === right.observedAt) {
    return left.evaluationId.localeCompare(right.evaluationId);
  }
  return left.observedAt.localeCompare(right.observedAt);
}

function weightedAverage(values: number[]): number {
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const weight =
      MATCH_WINDOW_WEIGHTS[index] ?? MATCH_WINDOW_WEIGHTS[MATCH_WINDOW_WEIGHTS.length - 1];
    numerator += value * weight;
    denominator += weight;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateWeightedStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const average = weightedAverage(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const weight =
      MATCH_WINDOW_WEIGHTS[index] ?? MATCH_WINDOW_WEIGHTS[MATCH_WINDOW_WEIGHTS.length - 1];
    numerator += (value - average) ** 2 * weight;
    denominator += weight;
  });
  return denominator === 0 ? 0 : Math.sqrt(numerator / denominator);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function milliToRating(value: number | null): number | null {
  return value === null ? null : value / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stringifyCalculationDetail(detail: Record<string, unknown>): string {
  return JSON.stringify(replaceInvalidNumbers(detail));
}

function replaceInvalidNumbers(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceInvalidNumbers(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, replaceInvalidNumbers(entry)]),
    );
  }
  return value;
}

export function toRatingUpdateSummary(output: RatingUpdateAppliedOutput) {
  return {
    rating: output.ratingTenths === null ? null : output.ratingTenths / 10,
    confidence: output.confidenceBp / 100,
    measurementStatus: output.measurementStatus,
    eligibleMatchCount: output.evaluatedMatchCount,
  };
}

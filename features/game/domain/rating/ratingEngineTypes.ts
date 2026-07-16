export type RatingCalculationVersion = 2;

export type RatingMeasurementStatus =
  | 'unmeasured'
  | 'provisional_1_of_3'
  | 'provisional_2_of_3'
  | 'provisional'
  | 'standard'
  | 'stable';

export type RatingSourceType = 'match' | 'standalone_zero_one' | 'standalone_cricket';

export type RatingMatchResult = 'win' | 'loss';

export type RatingMatchCompletionReason = 'two_zero' | 'two_one' | 'aborted' | 'invalid';

export type RatingEvaluationStatus =
  'pending' | 'eligible' | 'excluded' | 'applied' | 'invalidated';

export type RatingObservation = {
  evaluationId: string;
  accountId: string;
  playerId: string;
  sourceType: RatingSourceType;
  sourceMatchId: string | null;
  sourceGameId: string | null;
  sourceRevision: number;
  sourceWeightMilli: number;
  observedAt: string;
  matchResult: RatingMatchResult | null;
  matchCompletionReason: RatingMatchCompletionReason | null;
  manualOutcomeAdjustment: boolean;
  zeroOnePpdMilli: number | null;
  cricketMprMilli: number | null;
  totalDarts: number;
  totalRounds: number;
  adjustedDarts: number;
  correctionCount: number;
  cricketClearFlag: boolean;
  cricketFinalScore: number | null;
};

export type RatingPreviousSnapshot = {
  id: string;
  preciseRatingMilli: number | null;
  ratingTenths: number | null;
};

export type RatingProfileForUpdate = {
  accountId: string;
  ownerPlayerId: string;
  measurementStatus: RatingMeasurementStatus;
  ratingTenths: number | null;
  preciseRatingMilli: number | null;
  confidenceBp: number;
  eligibleMatchCount: number;
  eligibleStandaloneZeroOneCount: number;
  eligibleStandaloneCricketCount: number;
  zeroOneIndexMilli: number | null;
  cricketIndexMilli: number | null;
  matchIndexMilli: number | null;
  establishedAt: string | null;
};

export type RatingUpdateInput = {
  targetEvaluationId: string;
  calculationDateTime: string;
  profile: RatingProfileForUpdate;
  previousSnapshot: RatingPreviousSnapshot | null;
  observations: RatingObservation[];
};

export type RatingUpdateAppliedOutput = {
  kind: 'applied';
  evaluationId: string;
  accountId: string;
  playerId: string;
  sourceType: RatingSourceType;
  sourceMatchId: string | null;
  sourceGameId: string | null;
  previousSnapshotId: string | null;
  measurementStatus: RatingMeasurementStatus;
  ratingTenths: number | null;
  preciseRatingMilli: number | null;
  confidenceBp: number;
  evaluatedMatchCount: number;
  evaluatedStandaloneZeroOneCount: number;
  evaluatedStandaloneCricketCount: number;
  windowMatchCount: number;
  windowZeroOneObservationCount: number;
  windowCricketObservationCount: number;
  zeroOneIndexMilli: number | null;
  cricketIndexMilli: number | null;
  matchIndexMilli: number | null;
  stabilityAdjustmentMilli: number | null;
  continuityBonusMilli: number | null;
  appliedDeltaMilli: number | null;
  establishedAt: string | null;
  calculationDetailJson: string;
};

export type RatingUpdateExcludedOutput = {
  kind: 'excluded';
  evaluationId: string;
  accountId: string;
  sourceType: RatingSourceType;
  sourceMatchId: string | null;
  sourceGameId: string | null;
  reasonCodes: string[];
};

export type RatingUpdateOutput = RatingUpdateAppliedOutput | RatingUpdateExcludedOutput;

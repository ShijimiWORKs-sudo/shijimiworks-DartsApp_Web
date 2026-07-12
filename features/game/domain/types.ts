import type {
  BULL_RULES,
  DART_AREAS,
  GAME_MODES,
  GAME_STATUSES,
  INPUT_SOURCES,
  MATCH_STATUSES,
  OUTBOX_EVENT_TYPES,
  OUTBOX_STATUSES,
  OUT_RULES,
  PLAYER_KINDS,
  RATING_ELIGIBILITY_STATUSES,
  TURN_RESULTS,
} from './constants';

export type PlayerKind = (typeof PLAYER_KINDS)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type GameStatus = (typeof GAME_STATUSES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type OutRule = (typeof OUT_RULES)[number];
export type BullRule = (typeof BULL_RULES)[number];
export type InputSource = (typeof INPUT_SOURCES)[number];
export type DartArea = (typeof DART_AREAS)[number];
export type TurnResult = (typeof TURN_RESULTS)[number];
export type RatingEligibilityStatus = (typeof RATING_ELIGIBILITY_STATUSES)[number];
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];
export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];
export type ThrowingHand = 'right' | 'left' | 'unknown';

export type Player = {
  id: string;
  playerType: PlayerKind;
  displayName: string;
  throwingHand: ThrowingHand;
  colorKey: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  anonymizedAt: string | null;
};

export type Match = {
  id: string;
  status: MatchStatus;
  zeroOneStartScore: 501 | 701;
  outRule: OutRule;
  bullRule: BullRule;
  currentGameNo: number;
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  rowVersion: number;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type GameSession = {
  id: string;
  matchId: string | null;
  matchGameNo: number | null;
  mode: GameMode;
  status: GameStatus;
  maxRounds: number;
  bullRule: BullRule;
  outRule: OutRule | null;
  zeroOneStartScore: 301 | 501 | 701 | 901 | null;
  playerCount: 1 | 2;
  currentRoundNo: number;
  currentTurnSequenceNo: number;
  currentPlayerId: string | null;
  winnerPlayerId: string | null;
  ratingCandidate: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type GamePlayer = {
  id: string;
  gameId: string;
  playerId: string | null;
  slotNo: 1 | 2;
  turnOrder: 1 | 2;
  displayNameSnapshot: string;
  playerTypeSnapshot: PlayerKind;
  startingScore: number | null;
  currentRemainingScore: number | null;
  currentTotalScore: number;
  currentCricketScore: number;
  dartsThrown: number;
  turnsConfirmed: number;
  isWinner: boolean;
  result: 'pending' | 'win' | 'loss' | 'completed' | 'no_result';
  createdAt: string;
  updatedAt: string;
};

export type Round = {
  id: string;
  gameId: string;
  roundNo: number;
  status: 'in_progress' | 'completed' | 'terminated' | 'voided';
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Turn = {
  id: string;
  gameId: string;
  roundId: string;
  gamePlayerId: string;
  turnSequenceNo: number;
  roundNo: number;
  playerTurnOrder: 1 | 2;
  status: TurnResult;
  startRemainingScore: number | null;
  endRemainingScore: number | null;
  rawScore: number;
  appliedScore: number;
  cricketMarksTotal: number;
  cricketPointsScored: number;
  isBust: boolean;
  isCheckout: boolean;
  dartCount: number;
  revisionNo: number;
  createdAt: string;
  updatedAt: string;
};

export type Dart = {
  id: string;
  gameId: string;
  turnId: string;
  gamePlayerId: string;
  roundNo: number;
  dartNo: 1 | 2 | 3;
  segmentNumber: number | null;
  area: DartArea;
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  cricketMarks: number;
  inputSource: InputSource;
  detectionConfidenceBp: number | null;
  candidateId: string | null;
  normalizedX: number | null;
  normalizedY: number | null;
  status: 'active' | 'voided' | 'invalidated';
  isRatingEligible: boolean;
  correctionCount: number;
  clientActionId: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RatingSnapshot = {
  id: string;
  playerId: string;
  evaluationId: string | null;
  measurementStatus:
    | 'unmeasured'
    | 'provisional_1_of_3'
    | 'provisional_2_of_3'
    | 'provisional'
    | 'standard'
    | 'stable';
  ratingTenths: number | null;
  confidenceBp: number;
  evaluatedMatchCount: number;
  createdAt: string;
  invalidatedAt: string | null;
};

export type IntegrationOutboxEvent = {
  id: string;
  eventType: OutboxEventType;
  aggregateType: 'game' | 'match' | 'player';
  aggregateId: string;
  idempotencyKey: string;
  payloadJson: string;
  status: OutboxStatus;
  attemptCount: number;
  availableAt: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
};

export type CreateOwnerPlayerInput = {
  displayName: string;
  throwingHand?: ThrowingHand;
  colorKey?: string | null;
};

export type CreateGuestPlayerInput = CreateOwnerPlayerInput;

export type EnqueueOutboxInput = {
  eventType: OutboxEventType;
  aggregateType: 'game' | 'match' | 'player';
  aggregateId: string;
  idempotencyKey: string;
  payloadJson: string;
  availableAt?: string;
};

import type {
  CreateGuestPlayerInput,
  CreateOwnerPlayerInput,
  EnqueueOutboxInput,
  GameSession,
  IntegrationOutboxEvent,
  Match,
  Player,
  RatingSnapshot,
} from '../domain/types';
import type {
  RatingMeasurementStatus,
  RatingSourceType,
  RatingUpdateInput,
  RatingUpdateOutput,
} from '../domain/rating';

export type PlayerRepository = {
  getOrCreateOwner(input?: CreateOwnerPlayerInput): Promise<Player>;
  createGuest(input: CreateGuestPlayerInput): Promise<Player>;
  listActiveGuests(): Promise<Player[]>;
  archive(playerId: string): Promise<void>;
  findById(playerId: string): Promise<Player | null>;
};

export type MatchRepository = {
  findActive(): Promise<Match | null>;
  findById(matchId: string): Promise<Match | null>;
};

export type GameRepository = {
  findActive(): Promise<GameSession | null>;
  findById(gameId: string): Promise<GameSession | null>;
};

export type RatingRepository = {
  getLatestSnapshot(playerId: string): Promise<RatingSnapshot | null>;
  listPendingEvaluationRefs(limit?: number): Promise<RatingEvaluationRef[]>;
  listSnapshots(accountId: string): Promise<RatingSnapshotHistoryItem[]>;
  getSnapshotForEvaluation(evaluationId: string): Promise<RatingSnapshotHistoryItem | null>;
  getLatestValidSnapshot(accountId: string): Promise<RatingSnapshotHistoryItem | null>;
  getRatingResultForSource(input: RatingSourceLookup): Promise<RatingSourceResult>;
  invalidateSnapshotsFrom(
    accountId: string,
    evaluatedAt: string,
    invalidatedAt?: string,
  ): Promise<void>;
  listLatestEvaluationsFrom(accountId: string, evaluatedAt: string): Promise<RatingEvaluationRef[]>;
  restoreProfileFromSnapshot(
    accountId: string,
    snapshot: RatingSnapshotHistoryItem,
    restoredAt?: string,
  ): Promise<void>;
  clearProfileToUnmeasured(accountId: string, clearedAt?: string): Promise<void>;
  applyEvaluationUpdate(
    evaluationId: string,
    calculationDateTime: string,
    calculate: (input: RatingUpdateInput) => RatingUpdateOutput,
  ): Promise<RatingEvaluationApplyResult>;
  recalculateFromEvaluation(
    evaluationId: string,
    calculationDateTime: string,
    calculate: (input: RatingUpdateInput) => RatingUpdateOutput,
  ): Promise<RatingRecalculationResult>;
};

export type RatingEvaluationRef = {
  evaluationId: string;
  accountId: string;
};

export type RatingEvaluationApplyResult =
  | {
      status: 'applied' | 'excluded' | 'already_applied' | 'skipped';
      evaluationId: string;
      accountId: string | null;
      reasonCodes?: string[];
    }
  | {
      status: 'not_found';
      evaluationId: string;
      accountId: null;
    };

export type RatingSourceLookup =
  { sourceGameId: string; sourceMatchId?: never } | { sourceMatchId: string; sourceGameId?: never };

export type RatingSnapshotHistoryItem = {
  id: string;
  accountId: string;
  playerId: string;
  evaluationId: string | null;
  previousSnapshotId: string | null;
  sourceType: RatingSourceType;
  sourceMatchId: string | null;
  sourceGameId: string | null;
  measurementStatus: RatingMeasurementStatus;
  ratingTenths: number | null;
  previousRatingTenths: number | null;
  preciseRatingMilli: number | null;
  confidenceBp: number;
  evaluatedMatchCount: number;
  evaluatedStandaloneZeroOneCount: number;
  evaluatedStandaloneCricketCount: number;
  zeroOneIndexMilli: number | null;
  cricketIndexMilli: number | null;
  matchIndexMilli: number | null;
  appliedDeltaMilli: number | null;
  calculationVersion: number;
  createdAt: string;
  invalidatedAt: string | null;
};

export type RatingSourceResult =
  | {
      status: 'not_target';
      label: string;
      message: string;
      reasonCode: string | null;
    }
  | {
      status: 'processing';
      label: string;
      message: string;
      evaluationId: string;
      sourceType: RatingSourceType;
    }
  | {
      status: 'excluded';
      label: string;
      message: string;
      evaluationId: string;
      sourceType: RatingSourceType;
      reasonCodes: string[];
    }
  | {
      status: 'applied';
      label: string;
      message: string;
      evaluationId: string;
      sourceType: RatingSourceType;
      snapshot: RatingSnapshotHistoryItem;
      isInitialEstablished: boolean;
    };

export type RatingRecalculationResult = {
  accountId: string | null;
  targetEvaluationId: string;
  invalidatedEvaluationIds: string[];
  invalidatedSnapshotIds: string[];
  replayedEvaluationIds: string[];
  finalSnapshotId: string | null;
};

export type IntegrationOutboxRepository = {
  enqueue(input: EnqueueOutboxInput): Promise<IntegrationOutboxEvent>;
  listPending(limit?: number, now?: string): Promise<IntegrationOutboxEvent[]>;
  markProcessed(id: string, processedAt?: string): Promise<void>;
  markFailed(
    id: string,
    error: { code: string; message: string },
    failedAt?: string,
  ): Promise<void>;
};

export type GameRepositories = {
  players: PlayerRepository;
  matches: MatchRepository;
  games: GameRepository;
  ratings: RatingRepository;
  outbox: IntegrationOutboxRepository;
};

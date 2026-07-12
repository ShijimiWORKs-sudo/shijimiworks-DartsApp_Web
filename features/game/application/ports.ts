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

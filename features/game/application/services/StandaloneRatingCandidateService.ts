import {
  evaluateStandaloneRatingEligibility,
  type StandaloneRatingEligibility,
  type StandaloneRatingMode,
} from '../../domain/rating';
import type { GameDatabaseExecutor } from '../../infrastructure/sqlite/types';

export type StandaloneRatingCandidateRequest = {
  mode: StandaloneRatingMode;
  ownerPlayerId: string | null;
  gameStartedAt?: string;
};

export type StandaloneRatingStartDecision = {
  eligibility: StandaloneRatingEligibility;
  ratingCandidate: 0 | 1;
  configJsonPatch: {
    rating: {
      candidate: boolean;
      reasonCode: StandaloneRatingEligibility['reasonCode'];
    };
  };
};

type RatingProfileLookupRow = {
  owner_player_id: string | null;
  player_type: string | null;
  account_status: string | null;
  linked_owner_player_id: string | null;
  eligible_match_count: number | null;
  established_at: string | null;
};

export class StandaloneRatingCandidateService {
  constructor(private readonly db: GameDatabaseExecutor) {}

  async evaluateGameStart(
    input: StandaloneRatingCandidateRequest,
  ): Promise<StandaloneRatingEligibility> {
    const context = await this.loadOwnerRatingContext(input.ownerPlayerId);

    return evaluateStandaloneRatingEligibility({
      mode: input.mode,
      gameStartedAt: input.gameStartedAt ?? new Date().toISOString(),
      accountStatus: context.account_status,
      isOwnerPlayer: context.player_type === null ? null : context.player_type === 'owner',
      ownerPlayerId: context.owner_player_id,
      linkedOwnerPlayerId: context.linked_owner_player_id,
      eligibleMatchCount: context.eligible_match_count,
      establishedAt: context.established_at,
    });
  }

  async buildGameStartDecision(
    input: StandaloneRatingCandidateRequest,
  ): Promise<StandaloneRatingStartDecision> {
    const eligibility = await this.evaluateGameStart(input);

    return {
      eligibility,
      ratingCandidate: eligibility.ratingCandidate,
      configJsonPatch: {
        rating: {
          candidate: eligibility.ratingCandidate === 1,
          reasonCode: eligibility.reasonCode,
        },
      },
    };
  }

  private async loadOwnerRatingContext(
    ownerPlayerId: string | null,
  ): Promise<RatingProfileLookupRow> {
    if (!ownerPlayerId) {
      return emptyRatingProfileLookupRow;
    }

    const row = await this.db.getFirstAsync<RatingProfileLookupRow>(
      `SELECT
         p.id AS owner_player_id,
         p.player_type,
         a.status AS account_status,
         rp.owner_player_id AS linked_owner_player_id,
         rp.eligible_match_count,
         rp.established_at
       FROM players p
       LEFT JOIN accounts a ON a.id = p.account_id
       LEFT JOIN rating_profiles rp ON rp.account_id = a.id
       WHERE p.id = ?`,
      ownerPlayerId,
    );

    return row ?? emptyRatingProfileLookupRow;
  }
}

const emptyRatingProfileLookupRow: RatingProfileLookupRow = {
  owner_player_id: null,
  player_type: null,
  account_status: null,
  linked_owner_player_id: null,
  eligible_match_count: null,
  established_at: null,
};

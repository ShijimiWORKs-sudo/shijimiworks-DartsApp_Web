export type StandaloneRatingMode =
  'count_up' | 'zero_one' | 'cricket' | 'dojo' | 'cricket_count_up';

export type StandaloneRatingExclusionReason =
  | null
  | 'ACCOUNT_NOT_REGISTERED'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'OWNER_NOT_LINKED'
  | 'INITIAL_RATING_NOT_ESTABLISHED'
  | 'GAME_BEFORE_RATING_ESTABLISHED'
  | 'UNSUPPORTED_STANDALONE_MODE';

export type StandaloneRatingEligibility = {
  eligible: boolean;
  ratingCandidate: 0 | 1;
  reasonCode: StandaloneRatingExclusionReason;
};

export type StandaloneRatingEligibilityInput = {
  mode: StandaloneRatingMode;
  gameStartedAt: string;
  accountStatus: string | null;
  isOwnerPlayer?: boolean | null;
  ownerPlayerId: string | null;
  linkedOwnerPlayerId: string | null;
  eligibleMatchCount?: number | null;
  establishedAt: string | null;
};

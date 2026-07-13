import type {
  StandaloneRatingEligibility,
  StandaloneRatingEligibilityInput,
} from './eligibilityTypes';

export function evaluateStandaloneRatingEligibility(
  input: StandaloneRatingEligibilityInput,
): StandaloneRatingEligibility {
  if (input.mode !== 'zero_one' && input.mode !== 'cricket') {
    return {
      eligible: false,
      ratingCandidate: 0,
      reasonCode: 'UNSUPPORTED_STANDALONE_MODE',
    };
  }

  if (!input.accountStatus) {
    return { eligible: false, ratingCandidate: 0, reasonCode: 'ACCOUNT_NOT_REGISTERED' };
  }

  if (input.accountStatus !== 'local_registered' && input.accountStatus !== 'cloud_verified') {
    return {
      eligible: false,
      ratingCandidate: 0,
      reasonCode:
        input.accountStatus === 'profile_incomplete'
          ? 'ACCOUNT_NOT_REGISTERED'
          : 'ACCOUNT_NOT_ACTIVE',
    };
  }

  if (
    input.isOwnerPlayer === false ||
    !input.ownerPlayerId ||
    input.ownerPlayerId !== input.linkedOwnerPlayerId
  ) {
    return { eligible: false, ratingCandidate: 0, reasonCode: 'OWNER_NOT_LINKED' };
  }

  if ((input.eligibleMatchCount ?? 0) < 3 || !input.establishedAt) {
    return {
      eligible: false,
      ratingCandidate: 0,
      reasonCode: 'INITIAL_RATING_NOT_ESTABLISHED',
    };
  }

  if (new Date(input.gameStartedAt).getTime() < new Date(input.establishedAt).getTime()) {
    return {
      eligible: false,
      ratingCandidate: 0,
      reasonCode: 'GAME_BEFORE_RATING_ESTABLISHED',
    };
  }

  return { eligible: true, ratingCandidate: 1, reasonCode: null };
}

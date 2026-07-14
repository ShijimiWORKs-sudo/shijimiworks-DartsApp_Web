import type { RatingProfile } from '../../account/domain';
import type { CommonRatingJson, CommonRatingStatus } from '../domain/types';

export function toCommonRatingJson(ratingProfile: RatingProfile): CommonRatingJson {
  return {
    schema_version: 1,
    rating_profile_id: ratingProfile.accountId,
    account_id: ratingProfile.accountId,
    rating_value:
      ratingProfile.preciseRatingMilli !== null
        ? ratingProfile.preciseRatingMilli / 1000
        : ratingProfile.ratingTenths !== null
          ? ratingProfile.ratingTenths / 10
          : null,
    rating_status: mapRatingStatus(ratingProfile.measurementStatus),
    confidence_percent: Math.round(ratingProfile.confidenceBp / 100),
    evaluated_match_count: ratingProfile.eligibleMatchCount,
    calculation_version: 2,
    updated_at: ratingProfile.updatedAt,
  };
}

function mapRatingStatus(status: RatingProfile['measurementStatus']): CommonRatingStatus {
  switch (status) {
    case 'unmeasured':
      return 'unmeasured';
    case 'provisional_1_of_3':
    case 'provisional_2_of_3':
      return 'measuring';
    case 'provisional':
      return 'provisional';
    case 'standard':
      return 'standard';
    case 'stable':
      return 'stable';
  }
}

export type AccountStatus =
  'profile_incomplete' | 'local_registered' | 'cloud_verified' | 'disabled' | 'deleted';

export type AuthProvider = 'local' | 'email' | 'apple' | 'google';

export type RatingMeasurementStatus =
  | 'unmeasured'
  | 'provisional_1_of_3'
  | 'provisional_2_of_3'
  | 'provisional'
  | 'standard'
  | 'stable';

export type Account = {
  id: string;
  userName: string | null;
  displayName: string;
  emailNormalized: string | null;
  status: AccountStatus;
  authProvider: AuthProvider;
  registeredAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RatingProfile = {
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
  lastEvaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountOverview = {
  account: Account;
  ownerPlayer: {
    id: string;
    displayName: string;
  };
  ratingProfile: RatingProfile;
};

export type AccountRegistrationInput = {
  userName: string;
  displayName: string;
  email?: string | null;
};

export type AccountProfileUpdateInput = {
  displayName: string;
  email?: string | null;
};

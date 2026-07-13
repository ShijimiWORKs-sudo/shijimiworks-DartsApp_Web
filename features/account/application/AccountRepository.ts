import type {
  AccountOverview,
  AccountProfileUpdateInput,
  AccountRegistrationInput,
  RatingProfile,
} from '../domain';

export type NormalizedAccountRegistrationInput = Omit<AccountRegistrationInput, 'email'> & {
  emailNormalized: string | null;
};

export type NormalizedAccountProfileUpdateInput = Omit<AccountProfileUpdateInput, 'email'> & {
  emailNormalized: string | null;
};

export type AccountRepository = {
  findOverviewByAccountId(accountId: string): Promise<AccountOverview | null>;
  findActiveRegisteredOverview(): Promise<AccountOverview | null>;
  findRegistrationTarget(): Promise<AccountOverview | null>;
  registerLocalAccount(input: NormalizedAccountRegistrationInput): Promise<AccountOverview>;
  updateProfile(
    accountId: string,
    input: NormalizedAccountProfileUpdateInput,
  ): Promise<AccountOverview>;
  ensureRatingProfile(accountId: string): Promise<RatingProfile>;
  seedEstablishedRatingProfile(input: {
    accountId: string;
    ratingTenths: number;
    establishedAt: string;
  }): Promise<RatingProfile>;
};

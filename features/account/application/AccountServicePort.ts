import type {
  AccountOverview,
  AccountProfileUpdateInput,
  AccountRegistrationInput,
  RatingProfile,
} from '../domain';

export type AccountServicePort = {
  getActiveAccount(activeAccountId?: string | null): Promise<AccountOverview | null>;
  getAccountById(accountId: string): Promise<AccountOverview | null>;
  getRegistrationTarget(): Promise<AccountOverview | null>;
  registerLocalAccount(input: AccountRegistrationInput): Promise<AccountOverview>;
  updateProfile(accountId: string, input: AccountProfileUpdateInput): Promise<AccountOverview>;
  ensureRatingProfile(accountId: string): Promise<RatingProfile>;
  seedEstablishedRatingProfile(input: {
    accountId: string;
    ratingTenths?: number;
    establishedAt?: string;
  }): Promise<RatingProfile>;
};

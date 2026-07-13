import type { AccountServicePort } from './AccountServicePort';
import type { AccountRepository } from './AccountRepository';
import type {
  AccountOverview,
  AccountProfileUpdateInput,
  AccountRegistrationInput,
  RatingProfile,
} from '../domain';
import { validateAccountProfileUpdate, validateAccountRegistration } from '../domain';

export class AccountService implements AccountServicePort {
  constructor(private readonly repository: AccountRepository) {}

  async getActiveAccount(activeAccountId?: string | null): Promise<AccountOverview | null> {
    if (activeAccountId) {
      const overview = await this.repository.findOverviewByAccountId(activeAccountId);
      return overview?.account.status === 'deleted' ? null : overview;
    }

    return this.repository.findActiveRegisteredOverview();
  }

  async getAccountById(accountId: string): Promise<AccountOverview | null> {
    return this.repository.findOverviewByAccountId(accountId);
  }

  async getRegistrationTarget(): Promise<AccountOverview | null> {
    return this.repository.findRegistrationTarget();
  }

  async registerLocalAccount(input: AccountRegistrationInput): Promise<AccountOverview> {
    const validated = validateAccountRegistration(input);
    return this.repository.registerLocalAccount(validated);
  }

  async updateProfile(
    accountId: string,
    input: AccountProfileUpdateInput,
  ): Promise<AccountOverview> {
    const validated = validateAccountProfileUpdate(input);
    return this.repository.updateProfile(accountId, validated);
  }

  async ensureRatingProfile(accountId: string): Promise<RatingProfile> {
    return this.repository.ensureRatingProfile(accountId);
  }

  async seedEstablishedRatingProfile(input: {
    accountId: string;
    ratingTenths?: number;
    establishedAt?: string;
  }): Promise<RatingProfile> {
    return this.repository.seedEstablishedRatingProfile({
      accountId: input.accountId,
      ratingTenths: input.ratingTenths ?? 100,
      establishedAt: input.establishedAt ?? new Date().toISOString(),
    });
  }
}

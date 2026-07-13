import { createGameId } from '../../../game/domain/ids';
import type {
  GameDatabaseConnection,
  GameDatabaseExecutor,
} from '../../../game/infrastructure/sqlite/types';
import type { AccountRepository } from '../../application';
import {
  AccountNotFoundError,
  AccountUserNameAlreadyExistsError,
  type Account,
  type AccountOverview,
  type AccountStatus,
  type AuthProvider,
  type RatingMeasurementStatus,
  type RatingProfile,
} from '../../domain';
import type {
  NormalizedAccountProfileUpdateInput,
  NormalizedAccountRegistrationInput,
} from '../../application/AccountRepository';

type AccountOverviewRow = {
  account_id: string;
  user_name: string | null;
  display_name: string;
  email_normalized: string | null;
  status: AccountStatus;
  auth_provider: AuthProvider;
  registered_at: string | null;
  verified_at: string | null;
  account_created_at: string;
  account_updated_at: string;
  owner_player_id: string;
  owner_display_name: string;
  measurement_status: RatingMeasurementStatus;
  rating_tenths: number | null;
  precise_rating_milli: number | null;
  confidence_bp: number;
  eligible_match_count: number;
  eligible_standalone_zero_one_count: number;
  eligible_standalone_cricket_count: number;
  zero_one_index_milli: number | null;
  cricket_index_milli: number | null;
  match_index_milli: number | null;
  established_at: string | null;
  last_evaluated_at: string | null;
  profile_created_at: string;
  profile_updated_at: string;
};

type OwnerRow = {
  id: string;
  display_name: string;
  account_id: string | null;
};

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async findOverviewByAccountId(accountId: string): Promise<AccountOverview | null> {
    await this.ensureRatingProfile(accountId);
    return loadOverview(this.db, accountId);
  }

  async findActiveRegisteredOverview(): Promise<AccountOverview | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT a.id
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       WHERE a.status IN ('local_registered', 'cloud_verified')
         AND a.deleted_at IS NULL
         AND p.player_type = 'owner'
         AND p.is_archived = 0
       ORDER BY a.updated_at DESC
       LIMIT 1`,
    );

    return row ? this.findOverviewByAccountId(row.id) : null;
  }

  async findRegistrationTarget(): Promise<AccountOverview | null> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT a.id
       FROM accounts a
       JOIN players p ON p.account_id = a.id
       WHERE a.status IN ('profile_incomplete', 'local_registered', 'cloud_verified')
         AND a.deleted_at IS NULL
         AND p.player_type = 'owner'
         AND p.is_archived = 0
       ORDER BY
         CASE a.status WHEN 'profile_incomplete' THEN 0 ELSE 1 END,
         a.created_at ASC
       LIMIT 1`,
    );

    return row ? this.findOverviewByAccountId(row.id) : null;
  }

  async registerLocalAccount(input: NormalizedAccountRegistrationInput): Promise<AccountOverview> {
    let accountId: string | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await assertUserNameAvailable(transaction, input.userName);
      const owner = await getOrCreateOwner(transaction, input.displayName);
      const now = new Date().toISOString();

      accountId = owner.account_id;

      if (!accountId) {
        const incomplete = await transaction.getFirstAsync<{ id: string }>(
          `SELECT a.id
           FROM accounts a
           JOIN players p ON p.account_id = a.id
           WHERE p.id = ?
             AND a.deleted_at IS NULL
           LIMIT 1`,
          owner.id,
        );
        accountId = incomplete?.id ?? null;
      }

      if (accountId) {
        await transaction.runAsync(
          `UPDATE accounts
           SET user_name = ?,
               display_name = ?,
               email_normalized = ?,
               status = 'local_registered',
               auth_provider = 'local',
               registered_at = COALESCE(registered_at, ?),
               updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          input.userName,
          input.displayName,
          input.emailNormalized,
          now,
          now,
          accountId,
        );
      } else {
        accountId = createGameId();
        await transaction.runAsync(
          `INSERT INTO accounts(
             id, user_name, display_name, email_normalized, status, auth_provider,
             auth_subject, registered_at, verified_at, last_login_at,
             created_at, updated_at, deleted_at
           )
           VALUES (?, ?, ?, ?, 'local_registered', 'local', NULL, ?, NULL, NULL, ?, ?, NULL)`,
          accountId,
          input.userName,
          input.displayName,
          input.emailNormalized,
          now,
          now,
          now,
        );
      }

      await transaction.runAsync(
        `UPDATE players
         SET account_id = ?, display_name = ?, updated_at = ?, last_used_at = ?
         WHERE id = ? AND player_type = 'owner' AND is_archived = 0`,
        accountId,
        input.displayName,
        now,
        now,
        owner.id,
      );

      await upsertInitialRatingProfile(transaction, accountId, owner.id, now);
    });

    if (!accountId) {
      throw new Error('Failed to register local Account.');
    }

    const overview = await loadOverview(this.db, accountId);
    if (!overview) {
      throw new AccountNotFoundError(accountId);
    }
    return overview;
  }

  async updateProfile(
    accountId: string,
    input: NormalizedAccountProfileUpdateInput,
  ): Promise<AccountOverview> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const owner = await loadOwnerByAccountId(transaction, accountId);
      if (!owner) {
        throw new AccountNotFoundError(accountId);
      }

      const now = new Date().toISOString();
      await transaction.runAsync(
        `UPDATE accounts
         SET display_name = ?, email_normalized = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        input.displayName,
        input.emailNormalized,
        now,
        accountId,
      );
      await transaction.runAsync(
        `UPDATE players
         SET display_name = ?, updated_at = ?, last_used_at = ?
         WHERE id = ? AND player_type = 'owner' AND is_archived = 0`,
        input.displayName,
        now,
        now,
        owner.id,
      );
      await upsertInitialRatingProfile(transaction, accountId, owner.id, now);
    });

    const overview = await loadOverview(this.db, accountId);
    if (!overview) {
      throw new AccountNotFoundError(accountId);
    }
    return overview;
  }

  async ensureRatingProfile(accountId: string): Promise<RatingProfile> {
    let profile: RatingProfile | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const owner = await loadOwnerByAccountId(transaction, accountId);
      if (!owner) {
        throw new AccountNotFoundError(accountId);
      }

      const now = new Date().toISOString();
      await upsertInitialRatingProfile(transaction, accountId, owner.id, now);
      profile = await loadRatingProfile(transaction, accountId);
    });

    if (!profile) {
      throw new AccountNotFoundError(accountId);
    }
    return profile;
  }

  async seedEstablishedRatingProfile(input: {
    accountId: string;
    ratingTenths: number;
    establishedAt: string;
  }): Promise<RatingProfile> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const owner = await loadOwnerByAccountId(transaction, input.accountId);
      if (!owner) {
        throw new AccountNotFoundError(input.accountId);
      }

      const now = new Date().toISOString();
      await upsertInitialRatingProfile(transaction, input.accountId, owner.id, now);
      await transaction.runAsync(
        `UPDATE rating_profiles
         SET measurement_status = 'provisional',
             rating_tenths = ?,
             precise_rating_milli = ?,
             confidence_bp = 4500,
             eligible_match_count = 3,
             established_at = ?,
             last_evaluated_at = ?,
             updated_at = ?
         WHERE account_id = ?`,
        input.ratingTenths,
        input.ratingTenths * 100,
        input.establishedAt,
        input.establishedAt,
        now,
        input.accountId,
      );
    });

    const profile = await loadRatingProfile(this.db, input.accountId);
    if (!profile) {
      throw new AccountNotFoundError(input.accountId);
    }
    return profile;
  }
}

async function assertUserNameAvailable(
  db: GameDatabaseExecutor,
  userName: string,
  currentAccountId?: string,
) {
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM accounts
     WHERE user_name = ? AND deleted_at IS NULL
     LIMIT 1`,
    userName,
  );

  if (row && row.id !== currentAccountId) {
    throw new AccountUserNameAlreadyExistsError(userName);
  }
}

async function getOrCreateOwner(db: GameDatabaseExecutor, displayName: string): Promise<OwnerRow> {
  const existing = await db.getFirstAsync<OwnerRow>(
    `SELECT id, display_name, account_id
     FROM players
     WHERE player_type = 'owner' AND is_archived = 0
     ORDER BY created_at ASC
     LIMIT 1`,
  );

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const id = createGameId();
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived,
       created_at, updated_at, last_used_at, account_id
     )
     VALUES (?, 'owner', ?, 'unknown', 0, ?, ?, ?, NULL)`,
    id,
    displayName,
    now,
    now,
    now,
  );

  return { id, display_name: displayName, account_id: null };
}

async function loadOwnerByAccountId(
  db: GameDatabaseExecutor,
  accountId: string,
): Promise<OwnerRow | null> {
  return db.getFirstAsync<OwnerRow>(
    `SELECT id, display_name, account_id
     FROM players
     WHERE account_id = ?
       AND player_type = 'owner'
       AND is_archived = 0
     LIMIT 1`,
    accountId,
  );
}

async function upsertInitialRatingProfile(
  db: GameDatabaseExecutor,
  accountId: string,
  ownerPlayerId: string,
  now: string,
) {
  await db.runAsync(
    `INSERT INTO rating_profiles(
       account_id, owner_player_id, measurement_status, rating_tenths,
       precise_rating_milli, confidence_bp, eligible_match_count,
       eligible_standalone_zero_one_count, eligible_standalone_cricket_count,
       zero_one_index_milli, cricket_index_milli, match_index_milli,
       calculation_version, established_at, last_evaluated_at, created_at, updated_at
     )
     VALUES (?, ?, 'unmeasured', NULL, NULL, 0, 0, 0, 0, NULL, NULL, NULL, 2, NULL, NULL, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       owner_player_id = excluded.owner_player_id,
       updated_at = excluded.updated_at`,
    accountId,
    ownerPlayerId,
    now,
    now,
  );
}

async function loadOverview(
  db: GameDatabaseExecutor,
  accountId: string,
): Promise<AccountOverview | null> {
  const row = await db.getFirstAsync<AccountOverviewRow>(
    `SELECT
       a.id AS account_id,
       a.user_name,
       a.display_name,
       a.email_normalized,
       a.status,
       a.auth_provider,
       a.registered_at,
       a.verified_at,
       a.created_at AS account_created_at,
       a.updated_at AS account_updated_at,
       p.id AS owner_player_id,
       p.display_name AS owner_display_name,
       rp.measurement_status,
       rp.rating_tenths,
       rp.precise_rating_milli,
       rp.confidence_bp,
       rp.eligible_match_count,
       rp.eligible_standalone_zero_one_count,
       rp.eligible_standalone_cricket_count,
       rp.zero_one_index_milli,
       rp.cricket_index_milli,
       rp.match_index_milli,
       rp.established_at,
       rp.last_evaluated_at,
       rp.created_at AS profile_created_at,
       rp.updated_at AS profile_updated_at
     FROM accounts a
     JOIN players p ON p.account_id = a.id
     JOIN rating_profiles rp ON rp.account_id = a.id
     WHERE a.id = ?
       AND a.deleted_at IS NULL
       AND p.player_type = 'owner'
       AND p.is_archived = 0
     LIMIT 1`,
    accountId,
  );

  return row ? mapOverview(row) : null;
}

async function loadRatingProfile(
  db: GameDatabaseExecutor,
  accountId: string,
): Promise<RatingProfile | null> {
  const row = await db.getFirstAsync<
    Pick<
      AccountOverviewRow,
      | 'owner_player_id'
      | 'measurement_status'
      | 'rating_tenths'
      | 'precise_rating_milli'
      | 'confidence_bp'
      | 'eligible_match_count'
      | 'eligible_standalone_zero_one_count'
      | 'eligible_standalone_cricket_count'
      | 'zero_one_index_milli'
      | 'cricket_index_milli'
      | 'match_index_milli'
      | 'established_at'
      | 'last_evaluated_at'
      | 'profile_created_at'
      | 'profile_updated_at'
    >
  >(
    `SELECT
       owner_player_id,
       measurement_status,
       rating_tenths,
       precise_rating_milli,
       confidence_bp,
       eligible_match_count,
       eligible_standalone_zero_one_count,
       eligible_standalone_cricket_count,
       zero_one_index_milli,
       cricket_index_milli,
       match_index_milli,
       established_at,
       last_evaluated_at,
       created_at AS profile_created_at,
       updated_at AS profile_updated_at
     FROM rating_profiles
     WHERE account_id = ?
     LIMIT 1`,
    accountId,
  );

  return row ? mapRatingProfile(accountId, row) : null;
}

function mapOverview(row: AccountOverviewRow): AccountOverview {
  const account: Account = {
    id: row.account_id,
    userName: row.user_name,
    displayName: row.display_name,
    emailNormalized: row.email_normalized,
    status: row.status,
    authProvider: row.auth_provider,
    registeredAt: row.registered_at,
    verifiedAt: row.verified_at,
    createdAt: row.account_created_at,
    updatedAt: row.account_updated_at,
  };

  return {
    account,
    ownerPlayer: {
      id: row.owner_player_id,
      displayName: row.owner_display_name,
    },
    ratingProfile: mapRatingProfile(row.account_id, row),
  };
}

function mapRatingProfile(
  accountId: string,
  row: Pick<
    AccountOverviewRow,
    | 'owner_player_id'
    | 'measurement_status'
    | 'rating_tenths'
    | 'precise_rating_milli'
    | 'confidence_bp'
    | 'eligible_match_count'
    | 'eligible_standalone_zero_one_count'
    | 'eligible_standalone_cricket_count'
    | 'zero_one_index_milli'
    | 'cricket_index_milli'
    | 'match_index_milli'
    | 'established_at'
    | 'last_evaluated_at'
    | 'profile_created_at'
    | 'profile_updated_at'
  >,
): RatingProfile {
  return {
    accountId,
    ownerPlayerId: row.owner_player_id,
    measurementStatus: row.measurement_status,
    ratingTenths: row.rating_tenths,
    preciseRatingMilli: row.precise_rating_milli,
    confidenceBp: row.confidence_bp,
    eligibleMatchCount: row.eligible_match_count,
    eligibleStandaloneZeroOneCount: row.eligible_standalone_zero_one_count,
    eligibleStandaloneCricketCount: row.eligible_standalone_cricket_count,
    zeroOneIndexMilli: row.zero_one_index_milli,
    cricketIndexMilli: row.cricket_index_milli,
    matchIndexMilli: row.match_index_milli,
    establishedAt: row.established_at,
    lastEvaluatedAt: row.last_evaluated_at,
    createdAt: row.profile_created_at,
    updatedAt: row.profile_updated_at,
  };
}

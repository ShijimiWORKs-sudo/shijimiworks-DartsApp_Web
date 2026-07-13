import assert from 'node:assert/strict';
import { test } from 'node:test';

import { StandaloneRatingCandidateService } from '../../features/game/application/services/StandaloneRatingCandidateService';
import { createMigratedTestDatabase, type NodeSqliteTestDatabase } from './nodeSqliteTestAdapter';

const now = '2026-07-13T10:00:00.000Z';

test('standalone rating candidate service returns zero_one candidate for established owner account', async () => {
  const db = await createRatingCandidateTestDatabase();
  try {
    await seedOwnerAccount(db, {
      accountStatus: 'local_registered',
      eligibleMatchCount: 3,
      establishedAt: '2026-07-13T09:00:00.000Z',
    });

    const service = new StandaloneRatingCandidateService(db);
    const decision = await service.buildGameStartDecision({
      mode: 'zero_one',
      ownerPlayerId: 'owner-player',
      gameStartedAt: now,
    });

    assert.equal(decision.ratingCandidate, 1);
    assert.equal(decision.configJsonPatch.rating.candidate, true);
    assert.equal(decision.configJsonPatch.rating.reasonCode, null);
  } finally {
    db.close();
  }
});

test('standalone rating candidate service excludes count_up and keeps game start allowed', async () => {
  const db = await createRatingCandidateTestDatabase();
  try {
    await seedOwnerAccount(db, {
      accountStatus: 'local_registered',
      eligibleMatchCount: 3,
      establishedAt: '2026-07-13T09:00:00.000Z',
    });

    const service = new StandaloneRatingCandidateService(db);
    const decision = await service.buildGameStartDecision({
      mode: 'count_up',
      ownerPlayerId: 'owner-player',
      gameStartedAt: now,
    });

    assert.equal(decision.ratingCandidate, 0);
    assert.equal(decision.configJsonPatch.rating.candidate, false);
    assert.equal(decision.configJsonPatch.rating.reasonCode, 'UNSUPPORTED_STANDALONE_MODE');
  } finally {
    db.close();
  }
});

test('standalone rating candidate service excludes before established_at and incomplete accounts', async () => {
  const db = await createRatingCandidateTestDatabase();
  try {
    await seedOwnerAccount(db, {
      accountStatus: 'local_registered',
      eligibleMatchCount: 3,
      establishedAt: '2026-07-13T09:00:00.000Z',
    });

    const service = new StandaloneRatingCandidateService(db);
    const beforeEstablished = await service.buildGameStartDecision({
      mode: 'zero_one',
      ownerPlayerId: 'owner-player',
      gameStartedAt: '2026-07-13T08:59:59.999Z',
    });
    assert.equal(beforeEstablished.ratingCandidate, 0);
    assert.equal(
      beforeEstablished.configJsonPatch.rating.reasonCode,
      'GAME_BEFORE_RATING_ESTABLISHED',
    );

    await db.runAsync("UPDATE accounts SET status = 'profile_incomplete' WHERE id = 'account-1'");
    const incomplete = await service.buildGameStartDecision({
      mode: 'zero_one',
      ownerPlayerId: 'owner-player',
      gameStartedAt: now,
    });
    assert.equal(incomplete.ratingCandidate, 0);
    assert.equal(incomplete.configJsonPatch.rating.reasonCode, 'ACCOUNT_NOT_REGISTERED');
  } finally {
    db.close();
  }
});

test('standalone rating candidate service excludes guest and owner/profile mismatches', async () => {
  const db = await createRatingCandidateTestDatabase();
  try {
    await seedOwnerAccount(db, {
      accountStatus: 'local_registered',
      eligibleMatchCount: 3,
      establishedAt: '2026-07-13T09:00:00.000Z',
    });
    await seedPlayer(db, {
      id: 'guest-player',
      playerType: 'guest',
      displayName: 'Guest',
      accountId: 'account-1',
    });

    const service = new StandaloneRatingCandidateService(db);
    const guest = await service.buildGameStartDecision({
      mode: 'zero_one',
      ownerPlayerId: 'guest-player',
      gameStartedAt: now,
    });
    assert.equal(guest.ratingCandidate, 0);
    assert.equal(guest.configJsonPatch.rating.reasonCode, 'OWNER_NOT_LINKED');

    await db.runAsync(
      "UPDATE rating_profiles SET owner_player_id = 'guest-player' WHERE account_id = 'account-1'",
    );
    const mismatch = await service.buildGameStartDecision({
      mode: 'zero_one',
      ownerPlayerId: 'owner-player',
      gameStartedAt: now,
    });
    assert.equal(mismatch.ratingCandidate, 0);
    assert.equal(mismatch.configJsonPatch.rating.reasonCode, 'OWNER_NOT_LINKED');
  } finally {
    db.close();
  }
});

async function createRatingCandidateTestDatabase(): Promise<NodeSqliteTestDatabase> {
  return createMigratedTestDatabase();
}

async function seedOwnerAccount(
  db: NodeSqliteTestDatabase,
  input: {
    accountStatus: string;
    eligibleMatchCount: number;
    establishedAt: string | null;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO accounts(
       id, user_name, display_name, email_normalized, status, auth_provider,
       registered_at, verified_at, created_at, updated_at
     )
     VALUES ('account-1', NULL, 'Owner', NULL, ?, 'local', NULL, NULL, ?, ?)`,
    input.accountStatus,
    now,
    now,
  );
  await seedPlayer(db, {
    id: 'owner-player',
    playerType: 'owner',
    displayName: 'Owner',
    accountId: 'account-1',
  });
  await db.runAsync(
    `INSERT INTO rating_profiles(
       account_id, owner_player_id, measurement_status, rating_tenths,
       precise_rating_milli, confidence_bp, eligible_match_count,
       eligible_standalone_zero_one_count, eligible_standalone_cricket_count,
       calculation_version, established_at, last_evaluated_at, created_at, updated_at
     )
     VALUES ('account-1', 'owner-player', 'standard', 70, 7000, 5000, ?, 0, 0, 2, ?, NULL, ?, ?)`,
    input.eligibleMatchCount,
    input.establishedAt,
    now,
    now,
  );
}

async function seedPlayer(
  db: NodeSqliteTestDatabase,
  input: {
    id: string;
    playerType: 'owner' | 'guest';
    displayName: string;
    accountId: string | null;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived, created_at, updated_at, account_id
     )
     VALUES (?, ?, ?, 'unknown', 0, ?, ?, ?)`,
    input.id,
    input.playerType,
    input.displayName,
    now,
    now,
    input.accountId,
  );
}

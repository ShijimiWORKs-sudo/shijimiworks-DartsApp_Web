import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AccountOverview } from '../features/account/domain';
import {
  createCommonEvent,
  createCommonExportEnvelope,
  createCommonOutboxItem,
  isUuidV4,
  previewCommonImportEnvelope,
  toCommonAccountJson,
  toCommonGameSessionJson,
  toCommonOwnerProfileJson,
  toCommonRatingJson,
  validateCommonImportEnvelope,
} from '../features/common-contract';

const accountId = '8ad2b35e-d973-4e2c-bf2f-6df0f430af10';
const ownerPlayerId = '7cc978a2-661d-48c3-9d6a-8c76d73b30a4';
const now = '2026-07-13T10:00:00.000Z';

test('common contract validates UUID v4 and maps Account without secrets', () => {
  const overview = createOverview();
  const json = toCommonAccountJson(overview.account);

  assert.equal(isUuidV4(json.account_id), true);
  assert.equal(json.schema_version, 1);
  assert.equal(json.account_id, accountId);
  assert.equal(json.user_name, 'player_01');
  assert.equal(json.display_name, 'Player One');
  assert.equal(json.email, 'player@example.com');
  assert.equal(json.account_status, 'local_active');
  assert.equal(json.auth_mode, 'local_no_auth');
  assert.equal(json.cloud_auth_subject, null);
  assert.equal('auth_subject' in json, false);
  assert.equal('pin' in json, false);
  assert.equal('token' in json, false);
});

test('common contract keeps legacy account ids as metadata without rewriting references', () => {
  const overview = createOverview({ accountId: 'legacy-owner-id' });
  const json = toCommonAccountJson(overview.account);

  assert.equal(json.account_id, 'legacy-owner-id');
  assert.equal(json.legacy_account_id, 'legacy-owner-id');
});

test('common player profile links OWNER to account while GUEST can stay account-free', () => {
  const owner = toCommonOwnerProfileJson(createOverview());
  assert.equal(owner.profile_id, ownerPlayerId);
  assert.equal(owner.account_id, accountId);
  assert.equal(owner.player_type, 'owner');

  const guest = {
    ...owner,
    profile_id: 'guest-player-id',
    account_id: null,
    player_type: 'guest' as const,
  };
  assert.equal(guest.account_id, null);
});

test('common rating json uses account_id as the rating owner', () => {
  const rating = toCommonRatingJson(createOverview().ratingProfile);

  assert.equal(rating.account_id, accountId);
  assert.equal(rating.rating_profile_id, accountId);
  assert.equal(rating.rating_value, 7);
  assert.equal(rating.rating_status, 'standard');
  assert.equal(rating.confidence_percent, 50);
  assert.equal(rating.evaluated_match_count, 3);
});

test('common game session json is snake_case and marks DartsApp as source', () => {
  const game = toCommonGameSessionJson({
    id: '5ce00885-bdf0-4aa3-b978-0d09f8071d48',
    accountId,
    mode: 'zero_one',
    variant: '501',
    status: 'completed',
    startedAt: now,
    completedAt: '2026-07-13T10:20:00.000Z',
    ratingEligible: true,
    score: null,
    ppdMilli: 21800,
    threeDartAverageMilli: 65400,
    mprMilli: null,
    bullCount: 5,
    tripleCount: 7,
    doubleCount: 2,
    bustCount: 1,
  });

  assert.equal(game.account_id, accountId);
  assert.equal(game.game_type, 'ZERO_ONE');
  assert.equal(game.game_variant, '501');
  assert.equal(game.source_app, 'darts_app');
  assert.equal(game.source_record_id, game.session_id);
  assert.equal(game.summary.ppd, 21.8);
  assert.equal(game.summary.three_dart_average, 65.4);
});

test('common events and outbox default to DartsApp and local_only', () => {
  const event = createCommonEvent({
    eventType: 'account_created',
    accountId,
    sourceRecordId: accountId,
    occurredAt: now,
    createdAt: now,
    payload: { account_id: accountId },
  });
  const outbox = createCommonOutboxItem(event, now);

  assert.equal(isUuidV4(event.event_id), true);
  assert.equal(event.event_type, 'account_created');
  assert.equal(event.event_version, 1);
  assert.equal(event.source_app, 'darts_app');
  assert.equal(outbox.sync_status, 'local_only');
  assert.equal(outbox.retry_count, 0);
  assert.equal(outbox.last_error, null);
});

test('common export envelope validates contract and rejects invalid imports', () => {
  const envelope = createCommonExportEnvelope(
    {
      accounts: [toCommonAccountJson(createOverview().account)],
      events: [
        createCommonEvent({
          eventType: 'rating_updated',
          accountId,
          occurredAt: now,
          createdAt: now,
        }),
      ],
    },
    accountId,
    '0.1.0',
    now,
  );

  const valid = validateCommonImportEnvelope(envelope);
  assert.equal(valid.contract_name, 'darts_common_data');
  assert.equal(valid.contract_version, 1);
  assert.equal(valid.source_app, 'darts_app');

  const preview = previewCommonImportEnvelope(envelope);
  assert.deepEqual(preview.payload_keys, ['accounts', 'events']);
  assert.equal(preview.event_count, 1);

  assert.throws(
    () => validateCommonImportEnvelope({ ...envelope, contract_name: 'wrong' }),
    /Unsupported common contract name/,
  );
  assert.throws(
    () => validateCommonImportEnvelope({ ...envelope, contract_version: 2 }),
    /Unsupported common contract version/,
  );
  assert.throws(
    () => validateCommonImportEnvelope({ ...envelope, account_id: 'not-a-uuid' }),
    /account_id must be a UUID v4/,
  );
});

function createOverview(input: { accountId?: string } = {}): AccountOverview {
  const resolvedAccountId = input.accountId ?? accountId;
  return {
    account: {
      id: resolvedAccountId,
      userName: 'player_01',
      displayName: 'Player One',
      emailNormalized: 'player@example.com',
      status: 'local_registered',
      authProvider: 'local',
      registeredAt: now,
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    ownerPlayer: {
      id: ownerPlayerId,
      displayName: 'Player One',
    },
    ratingProfile: {
      accountId: resolvedAccountId,
      ownerPlayerId,
      measurementStatus: 'standard',
      ratingTenths: 70,
      preciseRatingMilli: null,
      confidenceBp: 5000,
      eligibleMatchCount: 3,
      eligibleStandaloneZeroOneCount: 0,
      eligibleStandaloneCricketCount: 0,
      zeroOneIndexMilli: null,
      cricketIndexMilli: null,
      matchIndexMilli: null,
      establishedAt: now,
      lastEvaluatedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
}

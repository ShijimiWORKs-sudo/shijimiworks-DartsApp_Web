import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createCommonEvent,
  createCommonExportEnvelope,
  createCommonOutboxItem,
  previewCommonImportEnvelope,
  toCommonMatchJson,
  validateCommonImportEnvelope,
} from '../../features/common-contract';

const accountId = '8ad2b35e-d973-4e2c-bf2f-6df0f430af10';
const player1Id = '11111111-1111-4111-8111-111111111111';
const player2Id = '22222222-2222-4222-8222-222222222222';
const matchId = '33333333-3333-4333-8333-333333333333';

test('common match mapper emits completed MATCH JSON without secrets', () => {
  const json = toCommonMatchJson({
    matchId,
    accountId,
    status: 'completed',
    zeroOneStartScore: 701,
    outRule: 'master_out',
    bullRule: 'separate_bull',
    winnerPlayerId: player1Id,
    loserPlayerId: player2Id,
    gamesWon: {
      [player1Id]: 2,
      [player2Id]: 1,
    },
    gameIds: ['game-1', 'game-2', 'game-3'],
    completedAt: '2026-07-14T10:00:00.000Z',
    ratingCandidate: true,
  });

  assert.equal(json.match_id, matchId);
  assert.equal(json.account_id, accountId);
  assert.equal(json.zero_one_start_score, 701);
  assert.equal(json.out_rule, 'master_out');
  assert.equal(json.bull_rule, 'separate_bull');
  assert.equal(json.winner_player_id, player1Id);
  assert.equal(json.loser_player_id, player2Id);
  assert.deepEqual(json.game_ids, ['game-1', 'game-2', 'game-3']);
  assert.equal(json.games_won[player1Id], 2);
  assert.equal(json.rating_candidate, true);
  assert.equal(json.source_app, 'darts_app');
  assert.equal('email' in json, false);
  assert.equal('token' in json, false);
});

test('common match completed event and outbox stay local_only', () => {
  const event = createCommonEvent({
    eventType: 'match_completed',
    accountId,
    sourceRecordId: matchId,
    occurredAt: '2026-07-14T10:00:00.000Z',
    createdAt: '2026-07-14T10:00:01.000Z',
    payload: { match_id: matchId },
  });
  const outbox = createCommonOutboxItem(event, '2026-07-14T10:00:02.000Z');

  assert.equal(event.event_type, 'match_completed');
  assert.equal(event.source_app, 'darts_app');
  assert.equal(event.source_record_id, matchId);
  assert.equal(outbox.sync_status, 'local_only');
});

test('common export accepts optional matches and remains backward compatible', () => {
  const envelope = createCommonExportEnvelope(
    {
      matches: [
        toCommonMatchJson({
          matchId,
          accountId,
          status: 'completed',
          zeroOneStartScore: 501,
          outRule: 'single_out',
          bullRule: 'fat_bull',
          winnerPlayerId: player1Id,
          loserPlayerId: player2Id,
          gamesWon: { [player1Id]: 2, [player2Id]: 0 },
          gameIds: ['game-1', 'game-2'],
          completedAt: '2026-07-14T10:00:00.000Z',
          ratingCandidate: true,
        }),
      ],
    },
    accountId,
    '0.1.0',
    '2026-07-14T10:00:03.000Z',
  );

  assert.equal(validateCommonImportEnvelope(envelope).contract_version, 1);
  assert.deepEqual(previewCommonImportEnvelope(envelope).payload_keys, ['matches']);

  const legacyEnvelope = createCommonExportEnvelope(
    { accounts: [], events: [] },
    accountId,
    '0.1.0',
    '2026-07-14T10:00:03.000Z',
  );
  assert.equal(validateCommonImportEnvelope(legacyEnvelope).contract_name, 'darts_common_data');

  assert.throws(
    () => validateCommonImportEnvelope({ ...envelope, contract_name: 'wrong' }),
    /Unsupported common contract name/,
  );
  assert.throws(
    () => validateCommonImportEnvelope({ ...envelope, contract_version: 2 }),
    /Unsupported common contract version/,
  );
});

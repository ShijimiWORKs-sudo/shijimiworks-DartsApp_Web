import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateStandaloneRatingEligibility } from '../../features/game/domain/rating';
import type { StandaloneRatingEligibilityInput } from '../../features/game/domain/rating';

const establishedInput: StandaloneRatingEligibilityInput = {
  mode: 'zero_one',
  gameStartedAt: '2026-07-13T10:00:00.000Z',
  accountStatus: 'local_registered',
  isOwnerPlayer: true,
  ownerPlayerId: 'player-owner',
  linkedOwnerPlayerId: 'player-owner',
  eligibleMatchCount: 3,
  establishedAt: '2026-07-13T09:00:00.000Z',
};

test('standalone rating excludes games without an account', () => {
  const result = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    accountStatus: null,
    ownerPlayerId: null,
    linkedOwnerPlayerId: null,
    eligibleMatchCount: null,
    establishedAt: null,
  });

  assert.deepEqual(result, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'ACCOUNT_NOT_REGISTERED',
  });
});

test('standalone rating excludes profile_incomplete accounts', () => {
  const result = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    accountStatus: 'profile_incomplete',
  });

  assert.deepEqual(result, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'ACCOUNT_NOT_REGISTERED',
  });
});

test('standalone rating excludes active accounts before initial rating establishment', () => {
  const result = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    eligibleMatchCount: 2,
    establishedAt: null,
  });

  assert.deepEqual(result, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'INITIAL_RATING_NOT_ESTABLISHED',
  });
});

test('standalone rating requires at least three eligible matches even if established_at is present', () => {
  const result = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    eligibleMatchCount: 2,
  });

  assert.deepEqual(result, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'INITIAL_RATING_NOT_ESTABLISHED',
  });
});

test('standalone rating allows zero_one and cricket games after established_at', () => {
  assert.deepEqual(evaluateStandaloneRatingEligibility(establishedInput), {
    eligible: true,
    ratingCandidate: 1,
    reasonCode: null,
  });

  assert.deepEqual(
    evaluateStandaloneRatingEligibility({
      ...establishedInput,
      mode: 'cricket',
    }),
    {
      eligible: true,
      ratingCandidate: 1,
      reasonCode: null,
    },
  );
});

test('standalone rating excludes games that started before rating establishment', () => {
  const result = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    gameStartedAt: '2026-07-13T08:59:59.999Z',
  });

  assert.deepEqual(result, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'GAME_BEFORE_RATING_ESTABLISHED',
  });
});

test('standalone rating excludes count up and other unsupported standalone modes', () => {
  const countUp = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    mode: 'count_up',
  });
  const dojo = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    mode: 'dojo',
  });

  assert.equal(countUp.reasonCode, 'UNSUPPORTED_STANDALONE_MODE');
  assert.equal(countUp.ratingCandidate, 0);
  assert.equal(dojo.reasonCode, 'UNSUPPORTED_STANDALONE_MODE');
  assert.equal(dojo.ratingCandidate, 0);
});

test('standalone rating excludes guest or owner mismatches', () => {
  const guest = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    isOwnerPlayer: false,
  });
  const mismatch = evaluateStandaloneRatingEligibility({
    ...establishedInput,
    linkedOwnerPlayerId: 'other-player',
  });

  assert.deepEqual(guest, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'OWNER_NOT_LINKED',
  });
  assert.deepEqual(mismatch, {
    eligible: false,
    ratingCandidate: 0,
    reasonCode: 'OWNER_NOT_LINKED',
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BULL_RULES,
  DART_AREAS,
  GAME_MODES,
  GAME_STATUSES,
  INPUT_SOURCES,
  MATCH_STATUSES,
  OUT_RULES,
  PLAYER_KINDS,
  RATING_ELIGIBILITY_STATUSES,
} from '../../features/game/domain/constants';
import { createGameId } from '../../features/game/domain/ids';

test('game domain enum values match DB enum strings', () => {
  assert.deepEqual(PLAYER_KINDS, ['owner', 'guest']);
  assert.ok(GAME_MODES.includes('count_up'));
  assert.ok(GAME_STATUSES.includes('in_progress'));
  assert.ok(MATCH_STATUSES.includes('paused'));
  assert.ok(OUT_RULES.includes('master_out'));
  assert.ok(BULL_RULES.includes('separate_bull'));
  assert.ok(INPUT_SOURCES.includes('photo_adjusted'));
  assert.ok(DART_AREAS.includes('inner_bull'));
  assert.ok(RATING_ELIGIBILITY_STATUSES.includes('invalidated'));
});

test('createGameId returns deterministic UUID v4 shape with injectable random bytes', () => {
  const id = createGameId({
    randomBytes: () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
  });

  assert.equal(id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.match(
    createGameId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

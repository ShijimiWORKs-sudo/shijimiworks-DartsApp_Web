import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAccountService } from '../../features/account';
import { MatchActiveExistsError, MatchGameService } from '../../features/game/application/services';
import { createGameRepositories } from '../../features/game/infrastructure/sqlite/repositories';
import type { GameDatabaseConnection } from '../../features/game/infrastructure/sqlite/types';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

test('MATCH start creates GAME 1 zero-one and keeps user_version 3', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const { service, ownerPlayerId, guestPlayerId } = await createMatchFixture(db);

    const match = await service.startMatch({
      zeroOneStartScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
      player1Id: ownerPlayerId,
      player2Id: guestPlayerId,
      game1FirstThrowPlayerId: ownerPlayerId,
    });

    assert.equal(match.status, 'in_progress');
    assert.equal(match.activeGame?.gameNo, 1);
    assert.equal(match.activeGame?.mode, 'zero_one');
    assert.equal(match.activeGame?.players[0]?.startingScore, 501);
    assert.equal(match.activeGame?.currentPlayerId, ownerPlayerId);

    await assert.rejects(
      () =>
        service.startMatch({
          zeroOneStartScore: 701,
          outRule: 'single_out',
          bullRule: 'fat_bull',
          player1Id: ownerPlayerId,
          player2Id: guestPlayerId,
          game1FirstThrowPlayerId: ownerPlayerId,
        }),
      (error) => error instanceof MatchActiveExistsError,
    );

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    assert.equal(version?.user_version, 3);
  } finally {
    db.close();
  }
});

test('MATCH completes 2-0 with owner rating evaluation and local-only common outbox', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const { service, ownerPlayerId, guestPlayerId } = await createMatchFixture(db);
    let match = await service.startMatch({
      zeroOneStartScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
      player1Id: ownerPlayerId,
      player2Id: guestPlayerId,
      game1FirstThrowPlayerId: ownerPlayerId,
    });

    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game one winner',
    });
    assert.equal(match.status, 'in_progress');
    assert.equal(match.phase, 'next_game_available');

    match = await service.startNextGame(match.matchId);
    assert.equal(match.activeGame?.gameNo, 2);
    assert.equal(match.activeGame?.mode, 'cricket');
    assert.equal(match.activeGame?.currentPlayerId, guestPlayerId);

    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game two winner',
    });

    assert.equal(match.status, 'completed');
    assert.equal(match.completionReason, 'two_zero');
    assert.equal(match.winnerPlayerId, ownerPlayerId);
    assert.equal(match.result?.ratingCandidate, true);
    assert.equal(match.result?.commonOutboxStatus, 'local_only');

    const ownerEvaluations = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM rating_evaluations
       WHERE source_type = 'match' AND source_match_id = ? AND player_id = ?`,
      match.matchId,
      ownerPlayerId,
    );
    assert.equal(ownerEvaluations?.count, 1);

    const guestEvaluations = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM rating_evaluations
       WHERE source_type = 'match' AND source_match_id = ? AND player_id = ?`,
      match.matchId,
      guestPlayerId,
    );
    assert.equal(guestEvaluations?.count, 0);

    const outbox = await db.getFirstAsync<{ sync_status: string; event_type: string }>(
      `SELECT o.sync_status, e.event_type
       FROM common_outbox o
       JOIN common_events e ON e.event_id = o.event_id
       WHERE e.source_record_id = ?`,
      match.matchId,
    );
    assert.equal(outbox?.sync_status, 'local_only');
    assert.equal(outbox?.event_type, 'match_completed');
  } finally {
    db.close();
  }
});

test('MATCH 1-1 advances to CHOICE and GAME 3 zero-one keeps GAME 1 start score', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const { service, ownerPlayerId, guestPlayerId } = await createMatchFixture(db);
    let match = await service.startMatch({
      zeroOneStartScore: 701,
      outRule: 'master_out',
      bullRule: 'separate_bull',
      player1Id: ownerPlayerId,
      player2Id: guestPlayerId,
      game1FirstThrowPlayerId: guestPlayerId,
    });

    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game one winner',
    });
    match = await service.startNextGame(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: guestPlayerId,
      reason: 'manual game two winner',
    });

    assert.equal(match.status, 'in_progress');
    assert.equal(match.phase, 'choice_required');
    assert.equal(match.activeGame, null);

    match = await service.chooseFinalGame(match.matchId, {
      selectedByPlayerId: ownerPlayerId,
      mode: 'zero_one',
      firstThrowPlayerId: ownerPlayerId,
    });

    assert.equal(match.activeGame?.gameNo, 3);
    assert.equal(match.activeGame?.mode, 'zero_one');
    assert.equal(match.activeGame?.players[0]?.startingScore, 701);
    assert.equal(match.activeGame?.currentPlayerId, ownerPlayerId);
  } finally {
    db.close();
  }
});

test('MATCH undo and redo keep the voided dart row and redo is screen-session scoped', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const { service, ownerPlayerId, guestPlayerId } = await createMatchFixture(db);
    let match = await service.startMatch({
      zeroOneStartScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
      player1Id: ownerPlayerId,
      player2Id: guestPlayerId,
      game1FirstThrowPlayerId: ownerPlayerId,
    });

    match = await service.recordDart(match.matchId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'match-dart-1',
    });
    const dartId = match.activeGame?.currentTurn?.darts[0]?.id;
    assert.ok(dartId);

    match = await service.undoDart(match.matchId);
    assert.equal(
      match.activeGame?.currentTurn?.darts.filter((dart) => dart.status === 'active').length,
      0,
    );

    const voided = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM darts WHERE id = ?',
      dartId,
    );
    assert.equal(voided?.status, 'voided');

    match = await service.redoDart(match.matchId, dartId);
    assert.equal(
      match.activeGame?.currentTurn?.darts.filter((dart) => dart.status === 'active').length,
      1,
    );

    await service.pauseMatch(match.matchId);
    match = await service.resumeMatch(match.matchId);
    match = await service.recordDart(match.matchId, {
      area: 'single',
      segmentNumber: 19,
      clientActionId: 'match-dart-after-resume',
    });
    assert.equal(match.status, 'in_progress');
  } finally {
    db.close();
  }
});

test('MATCH abort stores aborted status without rating evaluation', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const { service, ownerPlayerId, guestPlayerId } = await createMatchFixture(db);
    const match = await service.startMatch({
      zeroOneStartScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
      player1Id: ownerPlayerId,
      player2Id: guestPlayerId,
      game1FirstThrowPlayerId: ownerPlayerId,
    });

    await service.abortMatch(match.matchId);
    const aborted = await service.loadMatch(match.matchId);
    assert.equal(aborted.status, 'aborted');
    assert.equal(aborted.activeGame, null);

    const evaluations = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM rating_evaluations WHERE source_match_id = ?`,
      match.matchId,
    );
    assert.equal(evaluations?.count, 0);
  } finally {
    db.close();
  }
});

async function createMatchFixture(db: GameDatabaseConnection) {
  const account = await createAccountService(db).registerLocalAccount({
    userName: 'owner_1',
    displayName: 'Owner',
  });
  const repositories = createGameRepositories(db);
  const guest = await repositories.players.createGuest({ displayName: 'Guest' });
  return {
    service: new MatchGameService(db),
    ownerPlayerId: account.ownerPlayer.id,
    guestPlayerId: guest.id,
  };
}

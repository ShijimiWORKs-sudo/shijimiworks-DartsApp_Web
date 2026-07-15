import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAccountService } from '../../features/account';
import {
  MatchActiveExistsError,
  MatchGameService,
  RatingApplicationService,
} from '../../features/game/application/services';
import {
  createGameRepositories,
  SqliteRatingRepository,
} from '../../features/game/infrastructure/sqlite/repositories';
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

test('MATCH saves weighted 01 PPD separately from three dart average for rating', async () => {
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
      clientActionId: 'match-rating-dart-1',
    });
    match = await service.recordDart(match.matchId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'match-rating-dart-2',
    });
    match = await service.confirmTurn(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game one winner',
    });
    match = await service.startNextGame(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game two winner',
    });

    const zeroOneResult = await db.getFirstAsync<{
      ppd_milli: number | null;
      three_dart_average_milli: number | null;
      extra_stats_json: string;
    }>(
      `SELECT r.ppd_milli, r.three_dart_average_milli, r.extra_stats_json
       FROM game_player_results r
       JOIN game_sessions g ON g.id = r.game_id
       WHERE g.match_id = ? AND g.mode = 'zero_one' AND r.player_id = ?`,
      match.matchId,
      ownerPlayerId,
    );
    assert.equal(zeroOneResult?.ppd_milli, 13333);
    assert.equal(zeroOneResult?.three_dart_average_milli, 40000);
    assert.match(zeroOneResult?.extra_stats_json ?? '', /"zeroOneRatingDarts":3/);

    const matchResult = await db.getFirstAsync<{
      zero_one_ppd_milli: number | null;
      zero_one_three_dart_average_milli: number | null;
    }>(
      `SELECT zero_one_ppd_milli, zero_one_three_dart_average_milli
       FROM match_player_results
       WHERE match_id = ? AND player_id = ?`,
      match.matchId,
      ownerPlayerId,
    );
    assert.equal(matchResult?.zero_one_ppd_milli, 13333);
    assert.equal(matchResult?.zero_one_three_dart_average_milli, 40000);

    const evaluation = await db.getFirstAsync<{
      zero_one_ppd_milli: number | null;
      cricket_mpr_milli: number | null;
    }>(
      `SELECT zero_one_ppd_milli, cricket_mpr_milli
       FROM rating_evaluations
       WHERE source_match_id = ? AND player_id = ?`,
      match.matchId,
      ownerPlayerId,
    );
    assert.equal(evaluation?.zero_one_ppd_milli, 13333);

    const evaluationGame = await db.getFirstAsync<{
      ppd_milli: number | null;
      three_dart_average_milli: number | null;
    }>(
      `SELECT g.ppd_milli, g.three_dart_average_milli
       FROM rating_evaluation_games g
       JOIN rating_evaluations e ON e.id = g.evaluation_id
       WHERE e.source_match_id = ? AND g.mode = 'zero_one'`,
      match.matchId,
    );
    assert.equal(evaluationGame?.ppd_milli, 13333);
    assert.equal(evaluationGame?.three_dart_average_milli, 40000);

    const ratingService = new RatingApplicationService(
      new SqliteRatingRepository(db),
      () => '2026-07-15T00:00:00.000Z',
    );
    await ratingService.processPending({ calculationDateTime: '2026-07-15T00:00:00.000Z' });
    const snapshot = await db.getFirstAsync<{ calculation_detail_json: string }>(
      `SELECT s.calculation_detail_json
       FROM rating_snapshots s
       JOIN rating_evaluations e ON e.id = s.evaluation_id
       WHERE e.source_match_id = ?`,
      match.matchId,
    );
    const calculationDetail = JSON.parse(snapshot?.calculation_detail_json ?? '{}') as {
      windowPpd?: number;
    };
    assert.ok(Math.abs((calculationDetail.windowPpd ?? 0) - 13.333) < 0.001);

    assert.equal(match.result?.zeroOnePpdMilli, 13333);
    assert.equal(match.result?.zeroOneThreeDartAverageMilli, 40000);
  } finally {
    db.close();
  }
});

test('MATCH natural 501 checkout counts the final checkout darts in PPD', async () => {
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

    for (const [index, action] of (
      [
        ['triple', 20],
        ['triple', 20],
        ['triple', 20],
      ] as const
    ).entries()) {
      match = await service.recordDart(match.matchId, {
        area: action[0],
        segmentNumber: action[1],
        clientActionId: `checkout-r1-${index}`,
      });
    }
    match = await service.confirmTurn(match.matchId);
    match = await service.recordDart(match.matchId, {
      area: 'miss',
      segmentNumber: null,
      clientActionId: 'guest-miss-1',
    });
    match = await service.confirmTurn(match.matchId);

    for (const [index, action] of (
      [
        ['triple', 20],
        ['triple', 20],
        ['triple', 20],
      ] as const
    ).entries()) {
      match = await service.recordDart(match.matchId, {
        area: action[0],
        segmentNumber: action[1],
        clientActionId: `checkout-r2-${index}`,
      });
    }
    match = await service.confirmTurn(match.matchId);
    match = await service.recordDart(match.matchId, {
      area: 'miss',
      segmentNumber: null,
      clientActionId: 'guest-miss-2',
    });
    match = await service.confirmTurn(match.matchId);

    match = await service.recordDart(match.matchId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'checkout-final-t20',
    });
    match = await service.recordDart(match.matchId, {
      area: 'triple',
      segmentNumber: 19,
      clientActionId: 'checkout-final-t19',
    });
    match = await service.recordDart(match.matchId, {
      area: 'double',
      segmentNumber: 12,
      clientActionId: 'checkout-final-d12',
    });

    assert.equal(match.activeGame, null);
    assert.equal(match.phase, 'next_game_available');

    const checkoutTurn = await db.getFirstAsync<{
      id: string;
      round_no: number;
      status: string;
      applied_score: number;
      dart_count: number;
      active_darts: number;
      is_checkout: number;
      is_bust: number;
    }>(
      `SELECT t.id, t.round_no, t.status, t.applied_score, t.dart_count,
              COUNT(d.id) AS active_darts, t.is_checkout, t.is_bust
       FROM turns t
       LEFT JOIN darts d ON d.turn_id = t.id AND d.status = 'active'
       WHERE t.game_id = ? AND t.is_checkout = 1
       GROUP BY t.id
       LIMIT 1`,
      match.games[0]?.gameId,
    );
    assert.equal(checkoutTurn?.round_no, 3);
    assert.equal(checkoutTurn?.status, 'checkout');
    assert.equal(checkoutTurn?.applied_score, 141);
    assert.equal(checkoutTurn?.dart_count, 3);
    assert.equal(checkoutTurn?.active_darts, 3);

    match = await service.startNextGame(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game two winner',
    });

    const refreshed = await service.loadMatch(match.matchId);
    assert.equal(refreshed.status, 'completed');
    assert.equal(refreshed.games[0]?.status, 'completed');
    assert.equal(refreshed.result?.zeroOnePpdMilli, 55667);
    assert.equal(refreshed.result?.zeroOneThreeDartAverageMilli, 167000);

    const zeroOneResult = await db.getFirstAsync<{
      effective_score: number;
      darts_thrown: number;
      ppd_milli: number | null;
      three_dart_average_milli: number | null;
      extra_stats_json: string;
    }>(
      `SELECT r.effective_score, r.darts_thrown, r.ppd_milli,
              r.three_dart_average_milli, r.extra_stats_json
       FROM game_player_results r
       JOIN game_sessions g ON g.id = r.game_id
       WHERE g.match_id = ? AND g.mode = 'zero_one' AND r.player_id = ?`,
      match.matchId,
      ownerPlayerId,
    );
    assert.equal(zeroOneResult?.effective_score, 501);
    assert.equal(zeroOneResult?.darts_thrown, 9);
    assert.equal(zeroOneResult?.ppd_milli, 55667);
    assert.equal(zeroOneResult?.three_dart_average_milli, 167000);
    assert.match(zeroOneResult?.extra_stats_json ?? '', /"zeroOneRatingDarts":9/);
  } finally {
    db.close();
  }
});

test('MATCH rating repair creates a new source revision when stored PPD is stale', async () => {
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
      clientActionId: 'match-repair-dart-1',
    });
    match = await service.recordDart(match.matchId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'match-repair-dart-2',
    });
    match = await service.confirmTurn(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game one winner',
    });
    match = await service.startNextGame(match.matchId);
    match = await service.completeCurrentGameByManualWinner(match.matchId, {
      winnerPlayerId: ownerPlayerId,
      reason: 'manual game two winner',
    });

    await db.runAsync(
      `UPDATE rating_evaluations
       SET zero_one_ppd_milli = 40000
       WHERE source_match_id = ? AND source_revision = 1`,
      match.matchId,
    );

    const repair = await service.ensureRatingEvaluationCurrent(match.matchId);
    assert.equal(repair.recalculationRequired, true);
    assert.ok(repair.evaluationId);

    const latest = await db.getFirstAsync<{
      source_revision: number;
      zero_one_ppd_milli: number | null;
    }>(
      `SELECT source_revision, zero_one_ppd_milli
       FROM rating_evaluations
       WHERE source_match_id = ?
       ORDER BY source_revision DESC
       LIMIT 1`,
      match.matchId,
    );
    assert.equal(latest?.source_revision, 2);
    assert.equal(latest?.zero_one_ppd_milli, 13333);

    const revisionOne = await db.getFirstAsync<{ zero_one_ppd_milli: number | null }>(
      `SELECT zero_one_ppd_milli
       FROM rating_evaluations
       WHERE source_match_id = ? AND source_revision = 1`,
      match.matchId,
    );
    assert.equal(revisionOne?.zero_one_ppd_milli, 40000);
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

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CricketActiveGameExistsError,
  CricketGameService,
  ZeroOneGameService,
} from '../../features/game/application/services';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

test('CRICKET start creates graph and active uniqueness blocks another game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CricketGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull', ownerName: 'Owner' });

    assert.equal(game.status, 'in_progress');
    assert.equal(game.currentRoundNo, 1);
    assert.equal(game.targetStates.length, 7);
    assert.equal(game.currentCricketScore, 0);

    await assert.rejects(
      () => service.startGame({ bullRule: 'separate_bull' }),
      (error) => error instanceof CricketActiveGameExistsError,
    );

    await assert.rejects(
      () =>
        new ZeroOneGameService(db).startGame({
          startScore: 301,
          outRule: 'single_out',
          bullRule: 'fat_bull',
        }),
      (error) => error instanceof Error,
    );
  } finally {
    db.close();
  }
});

test('CRICKET all closed with zero points continues until a scoring mark is added', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CricketGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });

    await recordTurn(service, game.gameId, [
      ['triple', 20],
      ['triple', 19],
      ['triple', 18],
    ]);
    await recordTurn(service, game.gameId, [
      ['triple', 17],
      ['triple', 16],
      ['triple', 15],
    ]);
    const allClosedZero = await recordTurn(service, game.gameId, [
      ['inner_bull', null],
      ['outer_bull', null],
    ]);

    assert.equal(allClosedZero.status, 'in_progress');
    assert.equal(allClosedZero.closedTargetCount, 7);
    assert.equal(allClosedZero.allClosedZeroScore, true);
    assert.equal(allClosedZero.currentCricketScore, 0);
    assert.equal(allClosedZero.currentRoundNo, 4);

    const completed = await service.recordDart(game.gameId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'cricket-score-after-zero-clear',
    });

    assert.equal(completed.status, 'completed');
    assert.equal(completed.result?.completionReason, 'all_closed_with_score');
    assert.equal(completed.result?.finalCricketScore, 20);
    assert.equal(completed.result?.clearFlag, true);
  } finally {
    db.close();
  }
});

test('CRICKET round limit completes zero-point all closed as no clear', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CricketGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });

    await recordTurn(service, game.gameId, [
      ['triple', 20],
      ['triple', 19],
      ['triple', 18],
    ]);
    await recordTurn(service, game.gameId, [
      ['triple', 17],
      ['triple', 16],
      ['triple', 15],
    ]);
    await recordTurn(service, game.gameId, [
      ['inner_bull', null],
      ['outer_bull', null],
    ]);

    let latest = await service.loadGame(game.gameId);
    while (latest.currentRoundNo <= 15 && latest.status !== 'completed') {
      latest = await recordTurn(service, game.gameId, [['miss', null]]);
    }

    assert.equal(latest.status, 'completed');
    assert.equal(latest.result?.completionReason, 'round_limit');
    assert.equal(latest.result?.finalCricketScore, 0);
    assert.equal(latest.result?.clearFlag, false);
    assert.equal(latest.result?.allClosedZeroScore, true);
  } finally {
    db.close();
  }
});

test('CRICKET undo/redo keeps voided rows and pause resume allows fresh input', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CricketGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });
    const entered = await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'cricket-redo-1',
    });
    const dartId = entered.currentTurn?.darts[0].id;
    assert.ok(dartId);

    const undone = await service.undoDart(game.gameId);
    assert.equal(undone.currentTurnMarks, 0);

    const redone = await service.redoDart(game.gameId, dartId);
    assert.equal(redone.currentTurnMarks, 3);

    await service.undoDart(game.gameId);
    const voided = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM darts WHERE id = ?',
      dartId,
    );
    assert.equal(voided?.status, 'voided');

    await service.pauseGame(game.gameId);
    await service.resumeGame(game.gameId);
    const fresh = await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 19,
      clientActionId: 'cricket-redo-2',
    });

    assert.equal(fresh.currentTurnMarks, 3);
    const rows = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM darts
       WHERE game_id = ?`,
      game.gameId,
    );
    assert.equal(rows?.count, 1);
  } finally {
    db.close();
  }
});

test('CRICKET creates standalone cricket rating evaluation after rating is established', async () => {
  const db = await createMigratedTestDatabase();
  try {
    await seedEstablishedOwner(db);
    const service = new CricketGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });

    await recordTurn(service, game.gameId, [
      ['triple', 20],
      ['triple', 19],
      ['triple', 18],
    ]);
    await recordTurn(service, game.gameId, [
      ['triple', 17],
      ['triple', 16],
      ['triple', 15],
    ]);
    await recordTurn(service, game.gameId, [
      ['inner_bull', null],
      ['outer_bull', null],
    ]);
    const completed = await service.recordDart(game.gameId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'cricket-rating-score',
    });

    assert.equal(completed.status, 'completed');
    const evaluation = await db.getFirstAsync<{
      source_type: string;
      cricket_game_count: number;
      cricket_mpr_milli: number;
      source_weight_milli: number;
    }>(
      `SELECT source_type, cricket_game_count, cricket_mpr_milli, source_weight_milli
       FROM rating_evaluations
       WHERE source_game_id = ?`,
      game.gameId,
    );
    assert.equal(evaluation?.source_type, 'standalone_cricket');
    assert.equal(evaluation?.cricket_game_count, 1);
    assert.equal(evaluation?.source_weight_milli, 500);
    assert.ok((evaluation?.cricket_mpr_milli ?? 0) > 0);

    const outbox = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM integration_outbox
       WHERE event_type = 'rating_recalculate' AND aggregate_id = ?`,
      game.gameId,
    );
    assert.equal(outbox?.count, 1);
  } finally {
    db.close();
  }
});

type DartEntry = [
  area: 'single' | 'double' | 'triple' | 'outer_bull' | 'inner_bull' | 'miss',
  segmentNumber: number | null,
];

async function recordTurn(service: CricketGameService, gameId: string, darts: DartEntry[]) {
  let latest = await service.loadGame(gameId);
  for (const [index, [area, segmentNumber]] of darts.entries()) {
    latest = await service.recordDart(gameId, {
      area,
      segmentNumber,
      clientActionId: `cricket-${latest.currentRoundNo}-${index}-${area}-${segmentNumber ?? 'x'}`,
    });
    if (latest.status === 'completed') {
      return latest;
    }
  }
  return service.confirmTurn(gameId);
}

async function seedEstablishedOwner(db: Awaited<ReturnType<typeof createMigratedTestDatabase>>) {
  const now = '2026-07-13T00:00:00.000Z';
  await db.runAsync(
    `INSERT INTO accounts(
       id, user_name, display_name, email_normalized, status, auth_provider,
       registered_at, verified_at, created_at, updated_at
     )
     VALUES ('cricket-account', NULL, 'Owner', NULL, 'local_registered', 'local', ?, NULL, ?, ?)`,
    now,
    now,
    now,
  );
  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, is_archived,
       created_at, updated_at, last_used_at, account_id
     )
     VALUES ('cricket-owner', 'owner', 'Owner', 'unknown', 0, ?, ?, ?, 'cricket-account')`,
    now,
    now,
    now,
  );
  await db.runAsync(
    `INSERT INTO rating_profiles(
       account_id, owner_player_id, measurement_status, rating_tenths,
       precise_rating_milli, confidence_bp, eligible_match_count,
       eligible_standalone_zero_one_count, eligible_standalone_cricket_count,
       calculation_version, established_at, last_evaluated_at, created_at, updated_at
     )
     VALUES (
       'cricket-account', 'cricket-owner', 'standard', 70, 7000, 5000,
       3, 0, 0, 2, '2026-07-13T00:00:00.000Z', NULL, ?, ?
     )`,
    now,
    now,
  );
}

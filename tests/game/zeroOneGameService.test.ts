import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearZeroOneRedoSession,
  createZeroOneLeaveChoices,
  ZeroOneActiveGameExistsError,
  ZeroOneGameService,
  ZeroOneRedoSession,
} from '../../features/game/application/services';
import { CountUpGameService } from '../../features/game/application/services/CountUpGameService';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

test('01 start creates the initial game graph and active uniqueness blocks another game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const game = await service.startGame({
      startScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
      ownerName: 'Owner',
    });

    assert.equal(game.status, 'in_progress');
    assert.equal(game.currentRoundNo, 1);
    assert.equal(game.currentRemainingScore, 501);
    assert.equal(game.outRule, 'single_out');
    assert.equal(game.turns.length, 1);

    await assert.rejects(
      () =>
        service.startGame({
          startScore: 301,
          outRule: 'master_out',
          bullRule: 'separate_bull',
        }),
      (error) => error instanceof ZeroOneActiveGameExistsError,
    );

    await service.pauseGame(game.gameId);
    await assert.rejects(
      () =>
        new CountUpGameService(db).startGame({
          bullRule: 'fat_bull',
        }),
      (error) => error instanceof Error,
    );

    const resumed = await service.resumeGame(game.gameId);
    assert.equal(resumed.status, 'in_progress');
  } finally {
    db.close();
  }
});

test('01 records darts, supports undo/redo in the same screen session, and keeps voided rows', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const game = await service.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'separate_bull',
    });

    const entered = await service.recordDart(game.gameId, {
      area: 'outer_bull',
      segmentNumber: null,
      clientActionId: 'zero-one-redo-1',
    });
    assert.equal(entered.currentTurnScore, 25);
    assert.equal(entered.currentRemainingScore, 276);

    const dartId = entered.currentTurn?.darts[0].id;
    assert.ok(dartId);

    const undone = await service.undoDart(game.gameId);
    assert.equal(undone.currentTurnScore, 0);
    assert.equal(undone.currentRemainingScore, 301);

    const session = new ZeroOneRedoSession();
    session.push(dartId);
    const redoneDartId = session.pop();
    assert.equal(redoneDartId, dartId);

    const redone = await service.redoDart(game.gameId, redoneDartId);
    assert.equal(redone.currentTurnScore, 25);
    assert.equal(redone.currentRemainingScore, 276);

    const dartRows = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM darts WHERE game_id = ?',
      game.gameId,
    );
    assert.equal(dartRows?.count, 1);
  } finally {
    db.close();
  }
});

test('01 redo session clears on leave and pause resume does not expose redo candidates', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const redoSession = new ZeroOneRedoSession();
    let canRedo = false;
    const game = await service.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });

    const entered = await service.recordDart(game.gameId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'zero-one-clear-1',
    });
    const dartId = entered.currentTurn?.darts[0].id;
    assert.ok(dartId);

    await service.undoDart(game.gameId);
    redoSession.push(dartId);
    assert.equal(redoSession.canRedo, true);

    await service.pauseGame(game.gameId);
    clearZeroOneRedoSession(redoSession, (nextCanRedo) => {
      canRedo = nextCanRedo;
    });

    assert.equal(canRedo, false);
    assert.equal(redoSession.pop(), null);

    const voided = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM darts WHERE id = ?',
      dartId,
    );
    assert.equal(voided?.status, 'voided');

    await service.resumeGame(game.gameId);
    const fresh = await service.recordDart(game.gameId, {
      area: 'single',
      segmentNumber: 19,
      clientActionId: 'zero-one-clear-2',
    });

    assert.equal(fresh.currentTurnScore, 19);
    assert.equal(fresh.currentRemainingScore, 282);
  } finally {
    db.close();
  }
});

test('01 bust saves the dart, advances the round, and rejects undo for the completed bust turn', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const game = await service.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });

    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-setup-1',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-setup-2',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-setup-3',
    });
    const afterSetup = await service.confirmTurn(game.gameId);
    assert.equal(afterSetup.currentRemainingScore, 121);

    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-2-1',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-2-2',
    });
    const busted = await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'bust-2-3',
    });

    assert.equal(busted.lastTurnResult?.status, 'bust');
    assert.equal(busted.lastTurnResult?.rawScore, 180);
    assert.equal(busted.currentRoundNo, 3);
    assert.equal(busted.currentRemainingScore, 121);

    const bustDart = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM darts d
       JOIN turns t ON t.id = d.turn_id
       WHERE d.game_id = ? AND t.status = 'bust' AND d.status = 'active'`,
      game.gameId,
    );
    assert.equal(bustDart?.count, 3);
  } finally {
    db.close();
  }
});

test('01 checkout completes, writes result and outbox, excludes rating, and rejects further input', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const game = await service.startGame({
      startScore: 301,
      outRule: 'master_out',
      bullRule: 'fat_bull',
    });

    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'checkout-1',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'checkout-2',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'checkout-3',
    });
    await service.confirmTurn(game.gameId);

    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 20,
      clientActionId: 'checkout-4',
    });
    await service.recordDart(game.gameId, {
      area: 'triple',
      segmentNumber: 19,
      clientActionId: 'checkout-5',
    });
    const completed = await service.recordDart(game.gameId, {
      area: 'double',
      segmentNumber: 2,
      clientActionId: 'checkout-6',
    });

    assert.equal(completed.status, 'completed');
    assert.equal(completed.result?.completionReason, 'checkout');
    assert.equal(completed.result?.finalRemainingScore, 0);
    assert.equal(completed.result?.effectiveScore, 301);
    assert.equal(completed.result?.outboxStatus, 'pending');

    const session = await db.getFirstAsync<{ rating_candidate: number }>(
      'SELECT rating_candidate FROM game_sessions WHERE id = ?',
      game.gameId,
    );
    assert.equal(session?.rating_candidate, 0);

    const ratingRows = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM rating_evaluation_games WHERE game_id = ?',
      game.gameId,
    );
    assert.equal(ratingRows?.count, 0);

    await assert.rejects(() =>
      service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 1,
        clientActionId: 'after-checkout',
      }),
    );
  } finally {
    db.close();
  }
});

test('01 leave choices pause, continue, and abort through the expected services', async () => {
  const calls: string[] = [];
  const choices = createZeroOneLeaveChoices({
    gameId: 'game-1',
    zeroOne: {
      pauseGame: async (gameId) => {
        calls.push(`pause:${gameId}`);
        return {} as Awaited<ReturnType<ZeroOneGameService['pauseGame']>>;
      },
      abortGame: async (gameId) => {
        calls.push(`abort:${gameId}`);
      },
    },
    navigateToGameHub: () => {
      calls.push('navigate:/game');
    },
  });

  assert.deepEqual(
    choices.map((choice) => choice.label),
    ['一時停止してゲームハブへ戻る', 'ゲームを続ける', '途中終了する'],
  );

  await choices.find((choice) => choice.id === 'pause_to_hub')?.run();
  await choices.find((choice) => choice.id === 'continue_game')?.run();
  await choices.find((choice) => choice.id === 'abort_to_hub')?.run();

  assert.deepEqual(calls, ['pause:game-1', 'navigate:/game', 'abort:game-1', 'navigate:/game']);
});

test('01 round limit completes after 15 confirmed turns and then allows a new game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    let game = await service.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });

    for (let round = 1; round <= 15; round += 1) {
      game = await service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 1,
        clientActionId: `round-limit-${round}`,
      });
      game = await service.confirmTurn(game.gameId);
    }

    assert.equal(game.status, 'completed');
    assert.equal(game.result?.completionReason, 'round_limit');
    assert.equal(game.result?.finalRemainingScore, 286);

    const nextGame = await service.startGame({
      startScore: 501,
      outRule: 'master_out',
      bullRule: 'separate_bull',
    });
    assert.equal(nextGame.status, 'in_progress');
  } finally {
    db.close();
  }
});

test('01 aborted games reject further input and do not block a new game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new ZeroOneGameService(db);
    const game = await service.startGame({
      startScore: 501,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });

    await service.abortGame(game.gameId);

    await assert.rejects(() =>
      service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 20,
        clientActionId: 'after-zero-one-abort',
      }),
    );

    const nextGame = await service.startGame({
      startScore: 301,
      outRule: 'single_out',
      bullRule: 'fat_bull',
    });
    assert.equal(nextGame.status, 'in_progress');
  } finally {
    db.close();
  }
});

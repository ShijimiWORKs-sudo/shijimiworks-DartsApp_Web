import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ActiveGameExistsError,
  CountUpGameService,
} from '../../features/game/application/services/CountUpGameService';
import { CountUpRedoSession } from '../../features/game/application/services/CountUpRedoSession';
import { createCountUpLeaveChoices } from '../../features/game/application/services/countUpLeaveActions';
import { createMigratedTestDatabase } from './nodeSqliteTestAdapter';

test('COUNT-UP start creates the initial game graph and active uniqueness blocks a second game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CountUpGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull', ownerName: 'Owner' });

    assert.equal(game.status, 'in_progress');
    assert.equal(game.currentRoundNo, 1);
    assert.equal(game.turns.length, 1);
    assert.equal(game.turns[0].status, 'in_progress');
    assert.equal(game.bullRule, 'fat_bull');

    await assert.rejects(
      () => service.startGame({ bullRule: 'fat_bull' }),
      (error) => error instanceof ActiveGameExistsError,
    );

    await service.pauseGame(game.gameId);
    await assert.rejects(
      () => service.startGame({ bullRule: 'separate_bull' }),
      (error) => error instanceof ActiveGameExistsError,
    );

    const paused = await service.getActiveGame();
    assert.equal(paused?.gameId, game.gameId);
    assert.equal(paused?.status, 'paused');

    const resumed = await service.resumeGame(game.gameId);
    assert.equal(resumed.status, 'in_progress');
  } finally {
    db.close();
  }
});

test('COUNT-UP dart input is idempotent and undo/redo preserves dart rows', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CountUpGameService(db);
    const game = await service.startGame({ bullRule: 'separate_bull' });

    await service.recordDart(game.gameId, {
      area: 'outer_bull',
      segmentNumber: null,
      clientActionId: 'action-1',
    });
    const duplicate = await service.recordDart(game.gameId, {
      area: 'outer_bull',
      segmentNumber: null,
      clientActionId: 'action-1',
    });
    assert.equal(duplicate.currentTurnScore, 25);
    assert.equal(duplicate.dartsThrown, 1);

    const dart = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM darts WHERE game_id = ? AND status = ?',
      game.gameId,
      'active',
    );
    assert.ok(dart?.id);

    const undone = await service.undoDart(game.gameId);
    assert.equal(undone.currentTurnScore, 0);
    assert.equal(undone.dartsThrown, 0);

    const redone = await service.redoDart(game.gameId, dart.id);
    assert.equal(redone.currentTurnScore, 25);
    assert.equal(redone.dartsThrown, 1);

    const dartRows = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM darts WHERE game_id = ?',
      game.gameId,
    );
    assert.equal(dartRows?.count, 1);
  } finally {
    db.close();
  }
});

test('COUNT-UP redo session only exposes candidates for the current screen instance', () => {
  const session = new CountUpRedoSession();
  assert.equal(session.canRedo, false);

  session.push('dart-1');
  assert.equal(session.canRedo, true);
  assert.equal(session.pop(), 'dart-1');
  assert.equal(session.canRedo, false);

  session.push('dart-2');
  session.clear();
  assert.equal(session.canRedo, false);

  const remountedSession = new CountUpRedoSession();
  assert.equal(remountedSession.canRedo, false);
  assert.equal(remountedSession.pop(), null);
});

test('COUNT-UP redo requires the current screen session dart id and keeps voided history when unavailable', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CountUpGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });
    const entered = await service.recordDart(game.gameId, {
      area: 'single',
      segmentNumber: 20,
      clientActionId: 'redo-scope-1',
    });
    const dartId = entered.turns[0].darts[0].id;

    await service.undoDart(game.gameId);
    const withoutSessionCandidate = await service.redoDart(game.gameId, 'missing-session-dart');
    assert.equal(withoutSessionCandidate.currentTurnScore, 0);
    assert.equal(withoutSessionCandidate.dartsThrown, 0);

    const rowAfterMissingRedo = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM darts WHERE id = ?',
      dartId,
    );
    assert.equal(rowAfterMissingRedo?.status, 'voided');

    const redone = await service.redoDart(game.gameId, dartId);
    assert.equal(redone.currentTurnScore, 20);
    assert.equal(redone.dartsThrown, 1);
  } finally {
    db.close();
  }
});

test('COUNT-UP leave choices pause, continue, and abort through the expected services', async () => {
  const calls: string[] = [];
  const choices = createCountUpLeaveChoices({
    gameId: 'game-1',
    countUp: {
      pauseGame: async (gameId) => {
        calls.push(`pause:${gameId}`);
        return {} as Awaited<ReturnType<CountUpGameService['pauseGame']>>;
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

test('COUNT-UP completes after 8 rounds, writes result and pending Outbox, then allows a new game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CountUpGameService(db);
    let game = await service.startGame({ bullRule: 'fat_bull' });

    for (let round = 1; round <= 8; round += 1) {
      game = await service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 20,
        clientActionId: `round-${round}-dart-1`,
      });
      game = await service.confirmTurn(game.gameId, { machineType: 'DARTSLIVE' });
    }

    assert.equal(game.status, 'completed');
    assert.equal(game.result?.totalScore, 160);
    assert.equal(game.result?.roundScores.length, 8);
    assert.equal(game.result?.dartsThrown, 8);
    assert.equal(game.outboxStatus, 'pending');

    const session = await db.getFirstAsync<{ rating_candidate: number }>(
      'SELECT rating_candidate FROM game_sessions WHERE id = ?',
      game.gameId,
    );
    assert.equal(session?.rating_candidate, 0);

    const outbox = await db.getFirstAsync<{ status: string; payload_json: string }>(
      'SELECT status, payload_json FROM integration_outbox WHERE aggregate_id = ?',
      game.gameId,
    );
    assert.equal(outbox?.status, 'pending');
    assert.equal(JSON.parse(outbox?.payload_json ?? '{}').bullRule, 'fat_bull');

    await assert.rejects(() =>
      service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 1,
        clientActionId: 'after-complete',
      }),
    );

    const nextGame = await service.startGame({ bullRule: 'fat_bull' });
    assert.equal(nextGame.status, 'in_progress');
  } finally {
    db.close();
  }
});

test('COUNT-UP aborted games reject further input and do not block a new game', async () => {
  const db = await createMigratedTestDatabase();
  try {
    const service = new CountUpGameService(db);
    const game = await service.startGame({ bullRule: 'fat_bull' });

    await service.abortGame(game.gameId);

    await assert.rejects(() =>
      service.recordDart(game.gameId, {
        area: 'single',
        segmentNumber: 20,
        clientActionId: 'after-abort',
      }),
    );

    const nextGame = await service.startGame({ bullRule: 'separate_bull' });
    assert.equal(nextGame.status, 'in_progress');
    assert.equal(nextGame.bullRule, 'separate_bull');
  } finally {
    db.close();
  }
});

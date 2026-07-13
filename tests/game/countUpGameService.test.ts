import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ActiveGameExistsError,
  CountUpGameService,
} from '../../features/game/application/services/CountUpGameService';
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

    const undone = await service.undoDart(game.gameId);
    assert.equal(undone.currentTurnScore, 0);
    assert.equal(undone.dartsThrown, 0);

    const redone = await service.redoDart(game.gameId);
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

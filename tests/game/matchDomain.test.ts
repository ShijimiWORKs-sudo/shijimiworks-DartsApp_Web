import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildTwoPlayerCricketProgress,
  deriveMatchPhase,
  evaluateTwoPlayerCricketGame,
  evaluateTwoPlayerZeroOneGame,
  getMatchGameSetup,
  summarizeMatchCompletion,
  summarizeMatchResult,
} from '../../features/game/domain/match';
import type {
  MatchDart,
  MatchGameNo,
  MatchGameState,
  MatchPlayerState,
  MatchTurn,
} from '../../features/game/domain/match';

const PLAYER_1 = 'player-1';
const PLAYER_2 = 'player-2';

test('MATCH completion summary derives 2-0 and 2-1 winners', () => {
  const players = createMatchPlayers();
  const twoZero = summarizeMatchCompletion(
    [
      createGame({ gameNo: 1, winnerPlayerId: PLAYER_1 }),
      createGame({ gameNo: 2, mode: 'cricket', winnerPlayerId: PLAYER_1 }),
    ],
    players,
  );

  assert.equal(twoZero.winnerPlayerId, PLAYER_1);
  assert.equal(twoZero.loserPlayerId, PLAYER_2);
  assert.equal(twoZero.completionReason, 'two_zero');
  assert.deepEqual(twoZero.gamesWon, { [PLAYER_1]: 2 });

  const twoOne = summarizeMatchCompletion(
    [
      createGame({ gameNo: 1, winnerPlayerId: PLAYER_1 }),
      createGame({ gameNo: 2, mode: 'cricket', winnerPlayerId: PLAYER_2 }),
      createGame({ gameNo: 3, mode: 'zero_one', winnerPlayerId: PLAYER_1 }),
    ],
    players,
  );

  assert.equal(twoOne.winnerPlayerId, PLAYER_1);
  assert.equal(twoOne.completionReason, 'two_one');
  assert.deepEqual(twoOne.gamesWon, { [PLAYER_1]: 2, [PLAYER_2]: 1 });
});

test('MATCH phase derives choice_required after 1-1 without GAME 3', () => {
  const players = createMatchPlayers();

  assert.equal(
    deriveMatchPhase({
      status: 'in_progress',
      players,
      games: [
        createGame({ gameNo: 1, winnerPlayerId: PLAYER_1 }),
        createGame({ gameNo: 2, mode: 'cricket', winnerPlayerId: PLAYER_2 }),
      ],
    }),
    'choice_required',
  );

  assert.equal(
    deriveMatchPhase({
      status: 'in_progress',
      players,
      games: [
        createGame({ gameNo: 1, winnerPlayerId: PLAYER_1 }),
        createGame({ gameNo: 2, mode: 'cricket', winnerPlayerId: PLAYER_1 }),
      ],
    }),
    'completed',
  );
});

test('MATCH game setup sequences GAME1, GAME2, and CHOICE 01 start score', () => {
  const players = createMatchPlayers();
  const game1 = getMatchGameSetup({
    gameNo: 1,
    players,
    game1FirstThrowPlayerId: PLAYER_1,
    zeroOneStartScore: 701,
  });
  const game2 = getMatchGameSetup({
    gameNo: 2,
    players,
    game1FirstThrowPlayerId: PLAYER_1,
    zeroOneStartScore: 701,
  });
  const game3 = getMatchGameSetup({
    gameNo: 3,
    players,
    game1FirstThrowPlayerId: PLAYER_1,
    zeroOneStartScore: 701,
    choice: {
      selectedByPlayerId: PLAYER_2,
      mode: 'zero_one',
      firstThrowPlayerId: PLAYER_2,
    },
  });

  assert.deepEqual(game1, {
    gameNo: 1,
    mode: 'zero_one',
    firstThrowPlayerId: PLAYER_1,
    zeroOneStartScore: 701,
    maxRounds: 15,
  });
  assert.equal(game2.mode, 'cricket');
  assert.equal(game2.firstThrowPlayerId, PLAYER_2);
  assert.equal(game2.zeroOneStartScore, null);
  assert.equal(game3.mode, 'zero_one');
  assert.equal(game3.firstThrowPlayerId, PLAYER_2);
  assert.equal(game3.zeroOneStartScore, 701);
});

test('two-player 01 round limit compares remaining score and requires manual winner on tie', () => {
  const decisive = createGame({
    gameNo: 1,
    players: [
      createGamePlayer(PLAYER_1, { currentRemainingScore: 40 }),
      createGamePlayer(PLAYER_2, { slotNo: 2, turnOrder: 2, currentRemainingScore: 60 }),
    ],
    turns: [
      zeroOneTurn(PLAYER_1, 29, { endRemainingScore: 40 }),
      zeroOneTurn(PLAYER_2, 30, { endRemainingScore: 60 }),
    ],
  });
  const tied = createGame({
    gameNo: 1,
    players: [
      createGamePlayer(PLAYER_1, { currentRemainingScore: 40 }),
      createGamePlayer(PLAYER_2, { slotNo: 2, turnOrder: 2, currentRemainingScore: 40 }),
    ],
    turns: [
      zeroOneTurn(PLAYER_1, 29, { endRemainingScore: 40 }),
      zeroOneTurn(PLAYER_2, 30, { endRemainingScore: 40 }),
    ],
  });

  assert.deepEqual(evaluateTwoPlayerZeroOneGame(decisive), {
    status: 'completed',
    winnerPlayerId: PLAYER_1,
    loserPlayerId: PLAYER_2,
    completionReason: 'zero_one_round_limit',
    manualWinnerRequired: false,
  });
  assert.deepEqual(evaluateTwoPlayerZeroOneGame(tied), {
    status: 'manual_winner_required',
    winnerPlayerId: null,
    loserPlayerId: null,
    completionReason: 'zero_one_round_limit',
    manualWinnerRequired: true,
  });
});

test('two-player CRICKET scores over marks only while opponent target is open', () => {
  const game = createGame({
    gameNo: 2,
    mode: 'cricket',
    turns: [
      cricketTurn(PLAYER_1, 1, [dart(1, 'triple', 20), dart(2, 'single', 20)]),
      cricketTurn(PLAYER_2, 2, [dart(1, 'triple', 20)]),
      cricketTurn(PLAYER_1, 3, [dart(1, 'single', 20)]),
    ],
  });

  const progress = buildTwoPlayerCricketProgress(game);
  const player1 = progress.find((entry) => entry.playerId === PLAYER_1);
  const player2 = progress.find((entry) => entry.playerId === PLAYER_2);

  assert.equal(player1?.score, 20);
  assert.equal(player1?.targetMarks['20'], 5);
  assert.equal(player2?.score, 0);
  assert.equal(player2?.targetMarks['20'], 3);
});

test('two-player CRICKET natural win requires positive score and score parity or lead', () => {
  const zeroPointAllClosed = createGame({
    gameNo: 2,
    mode: 'cricket',
    turns: cricketCloseAllTurns(PLAYER_1),
  });
  assert.equal(evaluateTwoPlayerCricketGame(zeroPointAllClosed).status, 'in_progress');

  const scoringAllClosed = createGame({
    gameNo: 2,
    mode: 'cricket',
    turns: [...cricketCloseAllTurns(PLAYER_1), cricketTurn(PLAYER_1, 8, [dart(1, 'single', 20)])],
  });
  assert.deepEqual(evaluateTwoPlayerCricketGame(scoringAllClosed), {
    status: 'completed',
    winnerPlayerId: PLAYER_1,
    loserPlayerId: PLAYER_2,
    completionReason: 'cricket_all_closed_with_score',
    manualWinnerRequired: false,
  });
});

test('two-player CRICKET 15R compares score, closes, marks, then manual winner', () => {
  const byCloseCount = createGame({
    gameNo: 2,
    mode: 'cricket',
    turns: [
      cricketTurn(PLAYER_1, 29, [dart(1, 'triple', 20)]),
      cricketTurn(PLAYER_2, 30, [dart(1, 'single', 20), dart(2, 'single', 19)]),
    ],
  });
  const tied = createGame({
    gameNo: 2,
    mode: 'cricket',
    turns: [
      cricketTurn(PLAYER_1, 29, [dart(1, 'triple', 20)]),
      cricketTurn(PLAYER_2, 30, [dart(1, 'triple', 20)]),
    ],
  });

  assert.equal(evaluateTwoPlayerCricketGame(byCloseCount).winnerPlayerId, PLAYER_1);
  assert.deepEqual(evaluateTwoPlayerCricketGame(tied), {
    status: 'manual_winner_required',
    winnerPlayerId: null,
    loserPlayerId: null,
    completionReason: 'cricket_round_limit',
    manualWinnerRequired: true,
  });
});

test('MATCH result summary aggregates games, PPD, MPR, darts, and manual flag', () => {
  const summary = summarizeMatchResult({
    players: createMatchPlayers(),
    ratingCandidate: true,
    commonOutboxStatus: 'local_only',
    games: [
      createGame({
        gameNo: 1,
        winnerPlayerId: PLAYER_1,
        manualWinnerReason: 'tie break',
        turns: [
          zeroOneTurn(PLAYER_1, 1, { appliedScore: 60 }),
          zeroOneTurn(PLAYER_2, 2, { status: 'bust', appliedScore: 0, isBust: true }),
        ],
      }),
      createGame({
        gameNo: 2,
        mode: 'cricket',
        winnerPlayerId: PLAYER_2,
        turns: [cricketTurn(PLAYER_1, 1, [dart(1, 'triple', 20)])],
      }),
    ],
  });

  assert.equal(summary.gamesWon[PLAYER_1], 1);
  assert.equal(summary.gamesWon[PLAYER_2], 1);
  assert.equal(summary.zeroOnePpdMilli, 30000);
  assert.equal(summary.cricketMprMilli, 3000);
  assert.equal(summary.totalDarts, 3);
  assert.equal(summary.tripleCount, 3);
  assert.equal(summary.bustCount, 1);
  assert.equal(summary.manualWinner, true);
  assert.equal(summary.commonOutboxStatus, 'local_only');
});

function createMatchPlayers(): MatchPlayerState[] {
  return [
    {
      playerId: PLAYER_1,
      slotNo: 1,
      displayName: 'Player 1',
      playerType: 'owner',
      gamesWon: 0,
      result: 'pending',
    },
    {
      playerId: PLAYER_2,
      slotNo: 2,
      displayName: 'Player 2',
      playerType: 'guest',
      gamesWon: 0,
      result: 'pending',
    },
  ];
}

function createGame(input: Partial<MatchGameState> & { gameNo: MatchGameNo }): MatchGameState {
  const mode = input.mode ?? 'zero_one';
  return {
    gameId: `game-${input.gameNo}`,
    gameNo: input.gameNo,
    mode,
    status: input.status ?? (input.winnerPlayerId ? 'completed' : 'in_progress'),
    currentRoundNo: input.currentRoundNo ?? 1,
    currentTurnSequenceNo: input.currentTurnSequenceNo ?? 1,
    currentPlayerId: input.currentPlayerId ?? PLAYER_1,
    winnerPlayerId: input.winnerPlayerId ?? null,
    completionReason: input.completionReason ?? null,
    manualWinnerReason: input.manualWinnerReason ?? null,
    players: input.players ?? [
      createGamePlayer(PLAYER_1),
      createGamePlayer(PLAYER_2, { slotNo: 2, turnOrder: 2 }),
    ],
    turns: input.turns ?? [],
    currentTurn: input.currentTurn ?? null,
    cricketTargets: input.cricketTargets ?? [],
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
  };
}

function createGamePlayer(
  playerId: string,
  input: Partial<MatchGameState['players'][number]> = {},
): MatchGameState['players'][number] {
  return {
    playerId,
    slotNo: input.slotNo ?? 1,
    turnOrder: input.turnOrder ?? 1,
    displayName: input.displayName ?? playerId,
    startingScore: input.startingScore ?? 501,
    currentRemainingScore: input.currentRemainingScore ?? 501,
    currentCricketScore: input.currentCricketScore ?? 0,
    dartsThrown: input.dartsThrown ?? 0,
    turnsConfirmed: input.turnsConfirmed ?? 0,
    isWinner: input.isWinner ?? false,
    result: input.result ?? 'pending',
  };
}

function zeroOneTurn(
  playerId: string,
  turnSequenceNo: number,
  input: Partial<MatchTurn> = {},
): MatchTurn {
  const score = input.rawScore ?? input.appliedScore ?? 60;
  return {
    id: `turn-${turnSequenceNo}`,
    playerId,
    roundNo: input.roundNo ?? Math.ceil(turnSequenceNo / 2),
    turnSequenceNo,
    playerTurnOrder: playerId === PLAYER_1 ? 1 : 2,
    status: input.status ?? 'confirmed',
    startRemainingScore: input.startRemainingScore ?? 501,
    endRemainingScore: input.endRemainingScore ?? 501 - score,
    rawScore: input.rawScore ?? score,
    appliedScore: input.appliedScore ?? score,
    cricketMarksTotal: input.cricketMarksTotal ?? 0,
    cricketPointsScored: input.cricketPointsScored ?? 0,
    dartCount: input.dartCount ?? 1,
    isBust: input.isBust ?? false,
    isCheckout: input.isCheckout ?? false,
    darts: input.darts ?? [dart(1, 'triple', 20)],
  };
}

function cricketTurn(playerId: string, turnSequenceNo: number, darts: MatchDart[]): MatchTurn {
  return {
    id: `turn-${turnSequenceNo}`,
    playerId,
    roundNo: Math.ceil(turnSequenceNo / 2),
    turnSequenceNo,
    playerTurnOrder: playerId === PLAYER_1 ? 1 : 2,
    status: 'confirmed',
    startRemainingScore: null,
    endRemainingScore: null,
    rawScore: 0,
    appliedScore: 0,
    cricketMarksTotal: darts.reduce((sum, entry) => sum + entry.cricketMarks, 0),
    cricketPointsScored: 0,
    dartCount: darts.length,
    isBust: false,
    isCheckout: false,
    darts: darts.map((entry) => ({
      ...entry,
      roundNo: Math.ceil(turnSequenceNo / 2),
      turnSequenceNo,
    })),
  };
}

function cricketCloseAllTurns(playerId: string): MatchTurn[] {
  return [
    cricketTurn(playerId, 1, [dart(1, 'triple', 20), dart(2, 'triple', 19), dart(3, 'triple', 18)]),
    cricketTurn(playerId, 3, [dart(1, 'triple', 17), dart(2, 'triple', 16), dart(3, 'triple', 15)]),
    cricketTurn(playerId, 5, [dart(1, 'inner_bull', null), dart(2, 'outer_bull', null)]),
  ];
}

function dart(
  dartNo: number,
  area: MatchDart['area'],
  segmentNumber: MatchDart['segmentNumber'],
): MatchDart {
  const cricketMarks =
    area === 'triple'
      ? 3
      : area === 'double' || area === 'inner_bull'
        ? 2
        : area === 'miss'
          ? 0
          : 1;
  const multiplier =
    area === 'triple'
      ? 3
      : area === 'double' || area === 'inner_bull'
        ? 2
        : area === 'miss'
          ? 0
          : 1;
  return {
    id: `dart-${dartNo}-${area}-${segmentNumber ?? 'bull'}`,
    playerId: '',
    roundNo: 1,
    turnSequenceNo: 1,
    dartNo,
    area,
    segmentNumber,
    multiplier,
    score:
      area === 'outer_bull'
        ? 25
        : area === 'inner_bull'
          ? 50
          : area === 'miss'
            ? 0
            : (segmentNumber ?? 0) * multiplier,
    cricketMarks,
    status: 'active',
    inputSource: 'manual_segment',
    clientActionId: `action-${dartNo}-${area}-${segmentNumber ?? 'bull'}`,
    createdAt: new Date(0).toISOString(),
  };
}

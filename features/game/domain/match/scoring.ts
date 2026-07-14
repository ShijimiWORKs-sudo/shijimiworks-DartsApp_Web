import { CRICKET_TARGETS, type CricketTarget } from '../cricket';
import type {
  MatchChoiceInput,
  MatchGameNo,
  MatchGameOutcome,
  MatchGamePlayerState,
  MatchGameSetup,
  MatchGameState,
  MatchPhase,
  MatchPlayerState,
  MatchResultSummary,
  MatchState,
  MatchTurn,
  MatchZeroOneStartScore,
} from './types';
import { MATCH_GAME_MAX_ROUNDS } from './types';

export type MatchGamesWon = Record<string, number>;

export type MatchCompletionSummary = {
  gamesWon: MatchGamesWon;
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  completionReason: 'two_zero' | 'two_one' | null;
};

type CricketPlayerProgress = {
  playerId: string;
  score: number;
  closeCount: number;
  marksTotal: number;
  targetMarks: Record<CricketTarget, number>;
};

export function assertValidMatchPlayers(
  player1Id: string,
  player2Id: string,
  game1FirstThrowPlayerId: string,
): void {
  if (!player1Id || !player2Id) {
    throw new Error('MATCH requires two players.');
  }

  if (player1Id === player2Id) {
    throw new Error('MATCH players must be different.');
  }

  if (game1FirstThrowPlayerId !== player1Id && game1FirstThrowPlayerId !== player2Id) {
    throw new Error('GAME 1 first throw player must be one of the MATCH players.');
  }
}

export function countMatchGamesWon(games: Pick<MatchGameState, 'winnerPlayerId'>[]): MatchGamesWon {
  return games.reduce<MatchGamesWon>((wins, game) => {
    if (game.winnerPlayerId) {
      wins[game.winnerPlayerId] = (wins[game.winnerPlayerId] ?? 0) + 1;
    }
    return wins;
  }, {});
}

export function summarizeMatchCompletion(
  games: Pick<MatchGameState, 'winnerPlayerId'>[],
  players: Pick<MatchPlayerState, 'playerId'>[],
): MatchCompletionSummary {
  const gamesWon = countMatchGamesWon(games);
  const winnerPlayerId =
    players.find((player) => (gamesWon[player.playerId] ?? 0) >= 2)?.playerId ?? null;
  const loserPlayerId = winnerPlayerId
    ? (players.find((player) => player.playerId !== winnerPlayerId)?.playerId ?? null)
    : null;
  const completedGames = games.filter((game) => game.winnerPlayerId).length;

  return {
    gamesWon,
    winnerPlayerId,
    loserPlayerId,
    completionReason: winnerPlayerId ? (completedGames === 2 ? 'two_zero' : 'two_one') : null,
  };
}

export function deriveMatchPhase(
  match: Pick<MatchState, 'status' | 'games' | 'players'>,
): MatchPhase {
  if (match.status === 'completed') {
    return 'completed';
  }

  if (match.status === 'aborted') {
    return 'aborted';
  }

  if (match.status === 'invalid') {
    return 'invalid';
  }

  const activeGame = match.games.find((game) =>
    ['draft', 'ready', 'in_progress', 'paused'].includes(game.status),
  );
  if (activeGame) {
    return activeGame.status === 'draft' || activeGame.status === 'ready'
      ? 'next_game_available'
      : 'game_in_progress';
  }

  const completedGames = match.games.filter(
    (game) => game.status === 'completed' && game.winnerPlayerId,
  );
  const completion = summarizeMatchCompletion(completedGames, match.players);
  if (completion.winnerPlayerId) {
    return 'completed';
  }

  if (completedGames.length === 2) {
    return 'choice_required';
  }

  return 'next_game_available';
}

export function getMatchGameSetup(input: {
  gameNo: MatchGameNo;
  players: Pick<MatchPlayerState, 'playerId'>[];
  game1FirstThrowPlayerId: string;
  zeroOneStartScore: MatchZeroOneStartScore;
  choice?: MatchChoiceInput | null;
}): MatchGameSetup {
  const [player1, player2] = input.players;
  if (!player1 || !player2) {
    throw new Error('MATCH game setup requires two players.');
  }

  assertValidMatchPlayers(player1.playerId, player2.playerId, input.game1FirstThrowPlayerId);

  if (input.gameNo === 1) {
    return {
      gameNo: 1,
      mode: 'zero_one',
      firstThrowPlayerId: input.game1FirstThrowPlayerId,
      zeroOneStartScore: input.zeroOneStartScore,
      maxRounds: MATCH_GAME_MAX_ROUNDS,
    };
  }

  if (input.gameNo === 2) {
    return {
      gameNo: 2,
      mode: 'cricket',
      firstThrowPlayerId:
        input.game1FirstThrowPlayerId === player1.playerId ? player2.playerId : player1.playerId,
      zeroOneStartScore: null,
      maxRounds: MATCH_GAME_MAX_ROUNDS,
    };
  }

  if (!input.choice) {
    throw new Error('GAME 3 setup requires CHOICE input.');
  }

  if (![player1.playerId, player2.playerId].includes(input.choice.firstThrowPlayerId)) {
    throw new Error('GAME 3 first throw player must be one of the MATCH players.');
  }

  return {
    gameNo: 3,
    mode: input.choice.mode,
    firstThrowPlayerId: input.choice.firstThrowPlayerId,
    zeroOneStartScore: input.choice.mode === 'zero_one' ? input.zeroOneStartScore : null,
    maxRounds: MATCH_GAME_MAX_ROUNDS,
  };
}

export function evaluateTwoPlayerZeroOneGame(game: MatchGameState): MatchGameOutcome {
  const checkoutTurn = game.turns.find((turn) => turn.status === 'checkout' || turn.isCheckout);
  if (checkoutTurn) {
    return completedGame(checkoutTurn.playerId, game.players, 'checkout');
  }

  if (!hasReachedRoundLimit(game)) {
    return inProgressGame();
  }

  const ranked = game.players
    .map((player) => ({
      playerId: player.playerId,
      remaining: player.currentRemainingScore ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.remaining - b.remaining);

  if (!ranked[0] || !ranked[1] || ranked[0].remaining === ranked[1].remaining) {
    return manualWinnerRequiredGame('zero_one_round_limit');
  }

  return completedGame(ranked[0].playerId, game.players, 'zero_one_round_limit');
}

export function evaluateTwoPlayerCricketGame(game: MatchGameState): MatchGameOutcome {
  const progress = buildTwoPlayerCricketProgress(game);
  const naturalWinner = progress.find((player) => {
    const opponent = progress.find((entry) => entry.playerId !== player.playerId);
    return (
      player.closeCount === CRICKET_TARGETS.length &&
      player.score > 0 &&
      player.score >= (opponent?.score ?? 0)
    );
  });

  if (naturalWinner) {
    return completedGame(naturalWinner.playerId, game.players, 'cricket_all_closed_with_score');
  }

  if (!hasReachedRoundLimit(game)) {
    return inProgressGame();
  }

  const ranked = progress
    .slice()
    .sort(
      (a, b) => b.score - a.score || b.closeCount - a.closeCount || b.marksTotal - a.marksTotal,
    );

  if (
    !ranked[0] ||
    !ranked[1] ||
    (ranked[0].score === ranked[1].score &&
      ranked[0].closeCount === ranked[1].closeCount &&
      ranked[0].marksTotal === ranked[1].marksTotal)
  ) {
    return manualWinnerRequiredGame('cricket_round_limit');
  }

  return completedGame(ranked[0].playerId, game.players, 'cricket_round_limit');
}

export function buildTwoPlayerCricketProgress(game: MatchGameState): CricketPlayerProgress[] {
  const progress = new Map<string, CricketPlayerProgress>();
  for (const player of game.players) {
    progress.set(player.playerId, {
      playerId: player.playerId,
      score: 0,
      closeCount: 0,
      marksTotal: 0,
      targetMarks: createEmptyTargetMarks(),
    });
  }

  const orderedDarts = game.turns
    .filter((turn) => turn.status !== 'in_progress')
    .slice()
    .sort((a, b) => a.turnSequenceNo - b.turnSequenceNo)
    .flatMap((turn) =>
      turn.darts
        .filter((dart) => dart.status === 'active')
        .slice()
        .sort((a, b) => a.dartNo - b.dartNo)
        .map((dart) => ({ turn, dart })),
    );

  for (const { turn, dart } of orderedDarts) {
    const target = toCricketTarget(dart.segmentNumber, dart.area);
    if (!target || dart.cricketMarks <= 0) {
      continue;
    }

    const player = progress.get(turn.playerId);
    const opponent = Array.from(progress.values()).find(
      (entry) => entry.playerId !== turn.playerId,
    );
    if (!player || !opponent) {
      continue;
    }

    const previousMarks = player.targetMarks[target];
    const marksNeeded = Math.max(3 - previousMarks, 0);
    const scoringMarks = Math.max(dart.cricketMarks - marksNeeded, 0);
    player.targetMarks[target] = previousMarks + dart.cricketMarks;
    player.marksTotal += dart.cricketMarks;

    if (scoringMarks > 0 && opponent.targetMarks[target] < 3) {
      player.score += scoringMarks * getTargetPointValue(target);
    }
  }

  for (const player of progress.values()) {
    player.closeCount = CRICKET_TARGETS.filter((target) => player.targetMarks[target] >= 3).length;
  }

  return Array.from(progress.values());
}

export function summarizeMatchResult(input: {
  games: MatchGameState[];
  players: Pick<MatchPlayerState, 'playerId'>[];
  ratingCandidate: boolean;
  commonOutboxStatus?: MatchResultSummary['commonOutboxStatus'];
}): MatchResultSummary {
  const activeTurns = input.games.flatMap((game) =>
    game.turns.filter((turn) =>
      ['confirmed', 'bust', 'checkout', 'game_end'].includes(turn.status),
    ),
  );
  const activeDarts = activeTurns.flatMap((turn) =>
    turn.darts.filter((dart) => dart.status === 'active'),
  );
  const zeroOneTurns = input.games
    .filter((game) => game.mode === 'zero_one')
    .flatMap((game) =>
      game.turns.filter((turn) => ['confirmed', 'bust', 'checkout'].includes(turn.status)),
    );
  const zeroOneScore = zeroOneTurns.reduce((sum, turn) => sum + turn.appliedScore, 0);
  const zeroOneDarts = zeroOneTurns.flatMap((turn) =>
    turn.darts.filter((dart) => dart.status === 'active'),
  ).length;
  const cricketTurns = input.games
    .filter((game) => game.mode === 'cricket')
    .flatMap((game) =>
      game.turns.filter((turn) => ['confirmed', 'game_end'].includes(turn.status)),
    );
  const cricketMarks = cricketTurns.reduce((sum, turn) => sum + turn.cricketMarksTotal, 0);

  return {
    gamesWon: countMatchGamesWon(input.games),
    gameIds: input.games.map((game) => game.gameId),
    zeroOnePpdMilli: zeroOneDarts === 0 ? null : Math.round((zeroOneScore * 1000) / zeroOneDarts),
    cricketMprMilli:
      cricketTurns.length === 0 ? null : Math.round((cricketMarks * 1000) / cricketTurns.length),
    totalDarts: activeDarts.length,
    totalRounds: input.games.reduce(
      (sum, game) => sum + Math.max(0, ...game.turns.map((turn) => turn.roundNo)),
      0,
    ),
    bullCount: activeDarts.filter(
      (dart) => dart.area === 'outer_bull' || dart.area === 'inner_bull',
    ).length,
    tripleCount: activeDarts.filter((dart) => dart.area === 'triple').length,
    doubleCount: activeDarts.filter((dart) => dart.area === 'double').length,
    bustCount: activeTurns.filter((turn) => turn.isBust).length,
    manualWinner: input.games.some((game) => Boolean(game.manualWinnerReason)),
    ratingCandidate: input.ratingCandidate,
    commonOutboxStatus: input.commonOutboxStatus ?? null,
  };
}

function hasReachedRoundLimit(game: MatchGameState): boolean {
  const completedTurns = game.turns.filter((turn) =>
    ['confirmed', 'bust', 'checkout', 'game_end'].includes(turn.status),
  );
  const playerIds = new Set(game.players.map((player) => player.playerId));
  return Array.from(playerIds).every((playerId) =>
    completedTurns.some(
      (turn) => turn.playerId === playerId && turn.roundNo >= MATCH_GAME_MAX_ROUNDS,
    ),
  );
}

function completedGame(
  winnerPlayerId: string,
  players: MatchGamePlayerState[],
  completionReason: MatchGameOutcome['completionReason'],
): MatchGameOutcome {
  const loserPlayerId = players.find((player) => player.playerId !== winnerPlayerId)?.playerId;
  if (!loserPlayerId || !completionReason) {
    return inProgressGame();
  }

  return {
    status: 'completed',
    winnerPlayerId,
    loserPlayerId,
    completionReason,
    manualWinnerRequired: false,
  };
}

function manualWinnerRequiredGame(
  completionReason: Extract<
    MatchGameOutcome['completionReason'],
    'zero_one_round_limit' | 'cricket_round_limit'
  >,
): MatchGameOutcome {
  return {
    status: 'manual_winner_required',
    winnerPlayerId: null,
    loserPlayerId: null,
    completionReason,
    manualWinnerRequired: true,
  };
}

function inProgressGame(): MatchGameOutcome {
  return {
    status: 'in_progress',
    winnerPlayerId: null,
    loserPlayerId: null,
    completionReason: null,
    manualWinnerRequired: false,
  };
}

function createEmptyTargetMarks(): Record<CricketTarget, number> {
  return CRICKET_TARGETS.reduce(
    (marks, target) => ({
      ...marks,
      [target]: 0,
    }),
    {} as Record<CricketTarget, number>,
  );
}

function toCricketTarget(
  segmentNumber: MatchTurn['darts'][number]['segmentNumber'],
  area: MatchTurn['darts'][number]['area'],
): CricketTarget | null {
  if (area === 'outer_bull' || area === 'inner_bull') {
    return 'BULL';
  }

  if (
    (area === 'single' || area === 'double' || area === 'triple') &&
    segmentNumber !== null &&
    CRICKET_TARGETS.includes(String(segmentNumber) as CricketTarget)
  ) {
    return String(segmentNumber) as CricketTarget;
  }

  return null;
}

function getTargetPointValue(target: CricketTarget): number {
  return target === 'BULL' ? 25 : Number(target);
}

import type { BullRule, DartArea, GameStatus, InputSource, MatchStatus } from '../types';
import type { CricketTarget } from '../cricket';
import type { ZeroOneOutRule } from '../zeroOne';

export const MATCH_MAX_GAME_COUNT = 3;
export const MATCH_GAME_MAX_ROUNDS = 15;
export const MATCH_GAME_SEQUENCE = ['zero_one', 'cricket', 'choice'] as const;

export type MatchZeroOneStartScore = 501 | 701;
export type MatchGameMode = 'zero_one' | 'cricket';
export type MatchGameNo = 1 | 2 | 3;
export type MatchPlayerSlot = 1 | 2;
export type MatchCompletionReason = 'two_zero' | 'two_one' | 'aborted' | 'invalid';
export type MatchGameCompletionReason =
  | 'checkout'
  | 'zero_one_round_limit'
  | 'cricket_all_closed_with_score'
  | 'cricket_round_limit'
  | 'manual_winner';
export type MatchChoiceReason = 'manual_choice';
export type MatchPhase =
  | 'game_in_progress'
  | 'next_game_available'
  | 'choice_required'
  | 'completed'
  | 'aborted'
  | 'invalid';

export type MatchGameOutcome =
  | {
      status: 'completed';
      winnerPlayerId: string;
      loserPlayerId: string;
      completionReason: MatchGameCompletionReason;
      manualWinnerRequired: false;
    }
  | {
      status: 'manual_winner_required';
      winnerPlayerId: null;
      loserPlayerId: null;
      completionReason: Extract<
        MatchGameCompletionReason,
        'zero_one_round_limit' | 'cricket_round_limit'
      >;
      manualWinnerRequired: true;
    }
  | {
      status: 'in_progress';
      winnerPlayerId: null;
      loserPlayerId: null;
      completionReason: null;
      manualWinnerRequired: false;
    };

export type MatchGameSetup = {
  gameNo: MatchGameNo;
  mode: MatchGameMode;
  firstThrowPlayerId: string;
  zeroOneStartScore: MatchZeroOneStartScore | null;
  maxRounds: typeof MATCH_GAME_MAX_ROUNDS;
};

export type MatchStartInput = {
  zeroOneStartScore: MatchZeroOneStartScore;
  outRule: Exclude<ZeroOneOutRule, 'double_out'>;
  bullRule: BullRule;
  player1Id: string;
  player2Id: string;
  game1FirstThrowPlayerId: string;
};

export type MatchChoiceInput = {
  selectedByPlayerId: string;
  mode: MatchGameMode;
  firstThrowPlayerId: string;
};

export type MatchDartInput = {
  area: DartArea;
  segmentNumber: number | null;
  inputSource?: InputSource;
  clientActionId?: string;
};

export type MatchManualWinnerInput = {
  winnerPlayerId: string;
  reason: string;
};

export type MatchPlayerState = {
  playerId: string;
  slotNo: MatchPlayerSlot;
  displayName: string;
  playerType: 'owner' | 'guest';
  gamesWon: number;
  result: 'pending' | 'win' | 'loss' | 'no_result';
};

export type MatchDart = {
  id: string;
  playerId: string;
  roundNo: number;
  turnSequenceNo: number;
  dartNo: number;
  area: DartArea;
  segmentNumber: number | null;
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  cricketMarks: number;
  status: 'active' | 'voided' | 'invalidated';
  inputSource: InputSource;
  clientActionId: string;
  createdAt: string;
};

export type MatchTurn = {
  id: string;
  playerId: string;
  roundNo: number;
  turnSequenceNo: number;
  playerTurnOrder: MatchPlayerSlot;
  status: 'in_progress' | 'confirmed' | 'bust' | 'checkout' | 'game_end';
  startRemainingScore: number | null;
  endRemainingScore: number | null;
  rawScore: number;
  appliedScore: number;
  cricketMarksTotal: number;
  cricketPointsScored: number;
  dartCount: number;
  isBust: boolean;
  isCheckout: boolean;
  darts: MatchDart[];
};

export type MatchCricketTargetState = {
  playerId: string;
  target: CricketTarget;
  marksTotal: number;
  isClosed: boolean;
  pointsScored: number;
};

export type MatchGamePlayerState = {
  playerId: string;
  slotNo: MatchPlayerSlot;
  turnOrder: MatchPlayerSlot;
  displayName: string;
  startingScore: number | null;
  currentRemainingScore: number | null;
  currentCricketScore: number;
  dartsThrown: number;
  turnsConfirmed: number;
  isWinner: boolean;
  result: 'pending' | 'win' | 'loss' | 'completed' | 'no_result';
};

export type MatchGameState = {
  gameId: string;
  gameNo: MatchGameNo;
  mode: MatchGameMode;
  status: GameStatus;
  currentRoundNo: number;
  currentTurnSequenceNo: number;
  currentPlayerId: string | null;
  winnerPlayerId: string | null;
  completionReason: MatchGameCompletionReason | null;
  manualWinnerReason: string | null;
  players: MatchGamePlayerState[];
  turns: MatchTurn[];
  currentTurn: MatchTurn | null;
  cricketTargets: MatchCricketTargetState[];
  startedAt: string | null;
  completedAt: string | null;
};

export type MatchResultSummary = {
  gamesWon: Record<string, number>;
  gameIds: string[];
  zeroOnePpdMilli: number | null;
  zeroOneThreeDartAverageMilli: number | null;
  cricketMprMilli: number | null;
  totalDarts: number;
  totalRounds: number;
  bullCount: number;
  tripleCount: number;
  doubleCount: number;
  bustCount: number;
  manualWinner: boolean;
  ratingCandidate: boolean;
  commonOutboxStatus: 'local_only' | null;
};

export type MatchState = {
  matchId: string;
  status: MatchStatus;
  phase: MatchPhase;
  zeroOneStartScore: MatchZeroOneStartScore;
  outRule: Exclude<ZeroOneOutRule, 'double_out'>;
  bullRule: BullRule;
  currentGameNo: 0 | MatchGameNo;
  players: MatchPlayerState[];
  games: MatchGameState[];
  activeGame: MatchGameState | null;
  choice: {
    selectedByPlayerId: string;
    mode: MatchGameMode;
    reason: MatchChoiceReason;
    selectedAt: string;
  } | null;
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  completionReason: MatchCompletionReason | null;
  manualWinnerReason: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  result: MatchResultSummary | null;
};

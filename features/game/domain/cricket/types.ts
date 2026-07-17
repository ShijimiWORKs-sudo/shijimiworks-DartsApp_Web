import type { BullRule, DartArea, GameStatus, InputSource } from '../types';

export const CRICKET_MAX_ROUNDS = 15;
export const CRICKET_TARGETS = ['20', '19', '18', '17', '16', '15', 'BULL'] as const;

export type CricketTarget = (typeof CRICKET_TARGETS)[number];
export type CricketCompletionReason = 'all_closed_with_score' | 'round_limit' | 'aborted';
export type CricketTurnStatus = 'in_progress' | 'confirmed' | 'game_end';

export type CricketStartInput = {
  bullRule: BullRule;
  ownerName?: string;
};

export type CricketDartInput = {
  area: DartArea;
  segmentNumber: number | null;
  inputSource?: InputSource;
  clientActionId?: string;
};

export type CricketDart = {
  id: string;
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
  correctionCount: number;
  clientActionId: string;
  createdAt: string;
};

export type CricketTurn = {
  id: string;
  roundNo: number;
  turnSequenceNo: number;
  status: CricketTurnStatus;
  darts: CricketDart[];
  rawScore: number;
  appliedScore: number;
  cricketMarksTotal: number;
  cricketPointsScored: number;
  dartCount: number;
};

export type CricketTargetState = {
  target: CricketTarget;
  marksTotal: number;
  isClosed: boolean;
  closedAtTurnId: string | null;
  closedAtRoundNo: number | null;
  pointsScored: number;
};

export type CricketSummary = {
  finalCricketScore: number;
  marksTotal: number;
  mprMilli: number;
  closedTargetCount: number;
  allTargetsClosed: boolean;
  allClosedZeroScore: boolean;
  clearFlag: boolean;
  roundsPlayed: number;
  turnsPlayed: number;
  dartsThrown: number;
  bullCount: number;
  innerBullCount: number;
  outerBullCount: number;
  tripleCount: number;
  doubleCount: number;
  missCount: number;
  turns5MarksPlus: number;
  turns7MarksPlus: number;
  turns9Marks: number;
  fullyManualDarts: number;
  correctionCount: number;
  targetStates: CricketTargetState[];
};

export type CricketResult = CricketSummary & {
  completionReason: Exclude<CricketCompletionReason, 'aborted'>;
  outboxStatus: 'pending' | 'linked' | 'error' | null;
};

export type CricketGameState = {
  gameId: string;
  status: GameStatus;
  playerName: string;
  startedAt: string | null;
  bullRule: BullRule;
  currentRoundNo: number;
  currentTurnId: string | null;
  currentTurnMarks: number;
  currentTurnPoints: number;
  currentCricketScore: number;
  closedTargetCount: number;
  allClosedZeroScore: boolean;
  mprMilli: number;
  dartsThrown: number;
  turns: CricketTurn[];
  targetStates: CricketTargetState[];
  currentTurn: CricketTurn | null;
  result: CricketResult | null;
};

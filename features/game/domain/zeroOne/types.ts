import type { BullRule, DartArea, GameStatus, InputSource } from '../types';

export type ZeroOneStartScore = 301 | 501 | 701 | 901;
export type ZeroOneOutRule = 'single_out' | 'master_out';
export type ZeroOneCompletionReason = 'checkout' | 'round_limit' | 'aborted';
export type ZeroOneTurnStatus = 'in_progress' | 'confirmed' | 'bust' | 'checkout';

export type ZeroOneStartInput = {
  startScore: ZeroOneStartScore;
  outRule: ZeroOneOutRule;
  bullRule: BullRule;
  ownerName?: string;
};

export type ZeroOneDartInput = {
  area: DartArea;
  segmentNumber: number | null;
  inputSource?: InputSource;
  clientActionId?: string;
};

export type ZeroOneDart = {
  id: string;
  roundNo: number;
  turnSequenceNo: number;
  dartNo: number;
  area: DartArea;
  segmentNumber: number | null;
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  status: 'active' | 'voided' | 'invalidated';
  inputSource: InputSource;
  correctionCount: number;
  clientActionId: string;
  createdAt: string;
};

export type ZeroOneTurn = {
  id: string;
  roundNo: number;
  turnSequenceNo: number;
  status: ZeroOneTurnStatus;
  darts: ZeroOneDart[];
  rawScore: number;
  appliedScore: number;
  startRemainingScore: number;
  endRemainingScore: number;
  dartCount: number;
  isBust: boolean;
  isCheckout: boolean;
};

export type ZeroOneLastTurnResult = Pick<
  ZeroOneTurn,
  | 'id'
  | 'roundNo'
  | 'turnSequenceNo'
  | 'status'
  | 'rawScore'
  | 'appliedScore'
  | 'startRemainingScore'
  | 'endRemainingScore'
  | 'dartCount'
  | 'isBust'
  | 'isCheckout'
>;

export type ZeroOneResult = {
  startScore: ZeroOneStartScore;
  finalRemainingScore: number;
  effectiveScore: number;
  dartsThrown: number;
  roundsPlayed: number;
  turnsPlayed: number;
  bustCount: number;
  bullCount: number;
  innerBullCount: number;
  outerBullCount: number;
  tripleCount: number;
  doubleCount: number;
  missCount: number;
  turns100Plus: number;
  turns140Plus: number;
  turns180: number;
  ppdMilli: number;
  threeDartAverageMilli: number;
  completionReason: Exclude<ZeroOneCompletionReason, 'aborted'>;
  checkoutRoundNo: number | null;
  checkoutDarts: number | null;
  outboxStatus: 'pending' | 'linked' | 'error' | null;
};

export type ZeroOneGameState = {
  gameId: string;
  status: GameStatus;
  playerName: string;
  bullRule: BullRule;
  outRule: ZeroOneOutRule;
  startScore: ZeroOneStartScore;
  currentRoundNo: number;
  currentTurnId: string | null;
  currentTurnScore: number;
  currentRemainingScore: number;
  dartsThrown: number;
  turns: ZeroOneTurn[];
  currentTurn: ZeroOneTurn | null;
  lastTurnResult: ZeroOneLastTurnResult | null;
  result: ZeroOneResult | null;
};

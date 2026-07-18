import type { BullRule, DartArea, InputSource } from '../types';

export type CountUpDartInput = {
  area: DartArea;
  segmentNumber: number | null;
  inputSource?: InputSource;
  clientActionId?: string;
};

export type CountUpDart = {
  id: string;
  turnId: string;
  dartNo: 1 | 2 | 3;
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

export type CountUpTurn = {
  id: string;
  roundNo: number;
  status: string;
  darts: CountUpDart[];
  score: number;
};

export type CountUpGameState = {
  gameId: string;
  status: string;
  bullRule: BullRule;
  playerName: string;
  startedAt: string | null;
  currentRoundNo: number;
  currentTurnId: string | null;
  currentTurnScore: number;
  totalScore: number;
  dartsThrown: number;
  turns: CountUpTurn[];
  previousRoundScore: number | null;
  result: CountUpResult | null;
  outboxStatus: 'pending' | 'linked' | 'error' | null;
};

export type CountUpResult = {
  totalScore: number;
  roundAverageMilli: number;
  dartAverageMilli: number;
  bullCount: number;
  innerBullCount: number;
  outerBullCount: number;
  tripleCount: number;
  doubleCount: number;
  missCount: number;
  highRoundScore: number;
  lowRoundScore: number;
  roundScores: number[];
  dartsThrown: number;
  fullyManualDarts: number;
  correctionCount: number;
};

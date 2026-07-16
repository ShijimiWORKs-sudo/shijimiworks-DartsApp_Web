import type { MatchGameMode, MatchGameNo, MatchTurn } from '../../domain/match';

export type MatchDiagnosticSqliteValue = string | number | null;

export type MatchDiagnosticRawRow = Record<string, MatchDiagnosticSqliteValue>;

export type MatchDiagnosticTurnKind = 'normal' | 'bust' | 'checkout' | 'ignored';

export type MatchDiagnosticGame = {
  gameId: string;
  gameNo: MatchGameNo;
  mode: MatchGameMode;
  status: string;
  completionReason: string | null;
  winnerPlayerId: string | null;
  completedAt: string | null;
};

export type MatchDiagnosticTurn = {
  gameNo: MatchGameNo;
  mode: MatchGameMode;
  turnId: string;
  roundNo: number;
  turnSequenceNo: number;
  status: MatchTurn['status'] | 'voided' | 'invalid';
  appliedScore: number;
  rawScore: number;
  startRemainingScore: number | null;
  endRemainingScore: number | null;
  isCheckout: boolean;
  isBust: boolean;
  persistedDartCount: number;
  activeDartCount: number;
  voidedDartCount: number;
  invalidDartCount: number;
  resolvedRatingTurnKind: MatchDiagnosticTurnKind;
  canonicalRatingDarts: number;
  canonicalTotalDarts: number;
  canonicalEffectiveScore: number;
};

export type MatchDiagnosticDart = {
  turnId: string;
  dartNo: number;
  area: string;
  segment: number | null;
  multiplier: number;
  score: number;
  cricketMarks: number;
  status: string;
  clientActionId: string | null;
};

export type MatchDiagnosticSummary = {
  matchId: string;
  ownerPlayerId: string | null;
  ownerGamePlayerIds: string[];
  zeroOneRawEffectiveScore: number;
  zeroOneCanonicalRatingDarts: number;
  zeroOneCalculatedPpd: number | null;
  zeroOneCalculatedThreeDartAverage: number | null;
  zeroOnePpdMilli: number | null;
  zeroOneThreeDartAverageMilli: number | null;
  cricketMarks: number;
  cricketTurns: number;
  cricketMpr: number | null;
  cricketMprMilli: number | null;
  ownerCanonicalTotalDarts: number;
  savedPpdMilli: number | null;
  savedThreeDartAverageMilli: number | null;
  savedMprMilli: number | null;
  savedTotalDarts: number | null;
  latestEvaluationId: string | null;
  latestSourceRevision: number | null;
  latestEvaluationStatus: string | null;
  latestSnapshotId: string | null;
  latestProfileSnapshotId: string | null;
  mismatches: string[];
  expectedMismatches: string[];
  causeFindings: string[];
};

export type MatchDiagnosticSavedRows = {
  gamePlayerResults: MatchDiagnosticRawRow[];
  matchPlayerResults: MatchDiagnosticRawRow[];
  ratingEvaluations: MatchDiagnosticRawRow[];
  ratingEvaluationGames: MatchDiagnosticRawRow[];
  ratingSnapshots: MatchDiagnosticRawRow[];
  ratingProfiles: MatchDiagnosticRawRow[];
};

export type MatchDiagnosticReport = {
  generatedAt: string;
  match: MatchDiagnosticRawRow | null;
  players: MatchDiagnosticRawRow[];
  games: MatchDiagnosticGame[];
  ownerTurns: MatchDiagnosticTurn[];
  darts: MatchDiagnosticDart[];
  saved: MatchDiagnosticSavedRows;
  raw: {
    gameSessions: MatchDiagnosticRawRow[];
    gamePlayers: MatchDiagnosticRawRow[];
    turns: MatchDiagnosticRawRow[];
    darts: MatchDiagnosticRawRow[];
  };
  summary: MatchDiagnosticSummary;
  repairTarget: boolean;
  repairEligible: boolean;
  error: string | null;
};

export type MatchRepairResult = {
  repaired: boolean;
  recalculationRequired: boolean;
  evaluationId: string | null;
  before: MatchDiagnosticSummary;
  after: MatchDiagnosticSummary;
  mismatchesBefore: string[];
  mismatchesAfter: string[];
  error: string | null;
};

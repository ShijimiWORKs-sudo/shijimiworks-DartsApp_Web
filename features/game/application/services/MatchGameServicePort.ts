import type {
  MatchChoiceInput,
  MatchDartInput,
  MatchManualWinnerInput,
  MatchStartInput,
  MatchState,
} from '../../domain/match';

export type MatchLastSettings = {
  zeroOneStartScore: MatchStartInput['zeroOneStartScore'];
  outRule: MatchStartInput['outRule'];
  bullRule: MatchStartInput['bullRule'];
};

export type MatchGameServicePort = {
  getLastSettings(): Promise<MatchLastSettings>;
  getActiveMatch(): Promise<MatchState | null>;
  listRecentResults(limit?: number): Promise<MatchState[]>;
  startMatch(input: MatchStartInput): Promise<MatchState>;
  loadMatch(matchId: string): Promise<MatchState>;
  recordDart(matchId: string, input: MatchDartInput): Promise<MatchState>;
  undoDart(matchId: string): Promise<MatchState>;
  redoDart(matchId: string, dartId: string): Promise<MatchState>;
  confirmTurn(matchId: string): Promise<MatchState>;
  completeCurrentGameByManualWinner(
    matchId: string,
    input: MatchManualWinnerInput,
  ): Promise<MatchState>;
  startNextGame(matchId: string): Promise<MatchState>;
  chooseFinalGame(matchId: string, input: MatchChoiceInput): Promise<MatchState>;
  pauseMatch(matchId: string): Promise<MatchState>;
  resumeMatch(matchId: string): Promise<MatchState>;
  abortMatch(matchId: string): Promise<void>;
  ensureRatingEvaluationCurrent(matchId: string): Promise<{
    evaluationId: string | null;
    recalculationRequired: boolean;
  }>;
};

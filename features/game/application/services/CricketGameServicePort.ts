import type { CricketDartInput, CricketGameState, CricketStartInput } from '../../domain/cricket';
import type { BullRule } from '../../domain/types';

export type CricketLastSettings = {
  bullRule: BullRule;
};

export type CricketGameServicePort = {
  getLastSettings(): Promise<CricketLastSettings>;
  getActiveGame(): Promise<CricketGameState | null>;
  listRecentResults(limit?: number): Promise<CricketGameState[]>;
  startGame(input: CricketStartInput): Promise<CricketGameState>;
  loadGame(gameId: string): Promise<CricketGameState>;
  recordDart(gameId: string, input: CricketDartInput): Promise<CricketGameState>;
  undoDart(gameId: string): Promise<CricketGameState>;
  redoDart(gameId: string, dartId: string): Promise<CricketGameState>;
  confirmTurn(
    gameId: string,
    input?: {
      machineType?: string | null;
    },
  ): Promise<CricketGameState>;
  pauseGame(gameId: string): Promise<CricketGameState>;
  resumeGame(gameId: string): Promise<CricketGameState>;
  abortGame(gameId: string): Promise<void>;
};

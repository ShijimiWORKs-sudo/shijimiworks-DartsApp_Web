import type {
  ZeroOneDartInput,
  ZeroOneGameState,
  ZeroOneStartInput,
  ZeroOneStartScore,
} from '../../domain/zeroOne';
import type { BullRule } from '../../domain/types';

export type ZeroOneLastSettings = {
  startScore: ZeroOneStartScore;
  outRule: ZeroOneStartInput['outRule'];
  bullRule: BullRule;
};

export type ZeroOneGameServicePort = {
  getLastSettings(): Promise<ZeroOneLastSettings>;
  getActiveGame(): Promise<ZeroOneGameState | null>;
  listRecentResults(limit?: number): Promise<ZeroOneGameState[]>;
  startGame(input: ZeroOneStartInput): Promise<ZeroOneGameState>;
  loadGame(gameId: string): Promise<ZeroOneGameState>;
  recordDart(gameId: string, input: ZeroOneDartInput): Promise<ZeroOneGameState>;
  undoDart(gameId: string): Promise<ZeroOneGameState>;
  redoDart(gameId: string, dartId: string): Promise<ZeroOneGameState>;
  confirmTurn(
    gameId: string,
    input?: {
      machineType?: string | null;
    },
  ): Promise<ZeroOneGameState>;
  pauseGame(gameId: string): Promise<ZeroOneGameState>;
  resumeGame(gameId: string): Promise<ZeroOneGameState>;
  abortGame(gameId: string): Promise<void>;
};

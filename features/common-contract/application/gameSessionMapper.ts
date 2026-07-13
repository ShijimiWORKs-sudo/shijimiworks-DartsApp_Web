import type { CommonGameSessionJson } from '../domain/types';

export type CommonGameSessionSource = {
  id: string;
  accountId: string;
  mode: 'count_up' | 'zero_one' | 'cricket' | 'match';
  variant: string | null;
  status: 'completed' | 'aborted' | 'invalid';
  startedAt: string | null;
  completedAt: string | null;
  ratingEligible: boolean;
  score: number | null;
  ppdMilli: number | null;
  threeDartAverageMilli: number | null;
  mprMilli: number | null;
  bullCount: number;
  tripleCount: number;
  doubleCount: number;
  bustCount: number;
};

export function toCommonGameSessionJson(
  gameSession: CommonGameSessionSource,
): CommonGameSessionJson {
  return {
    session_id: gameSession.id,
    account_id: gameSession.accountId,
    game_type: mapGameType(gameSession.mode),
    game_variant: gameSession.variant,
    status: gameSession.status,
    started_at: gameSession.startedAt,
    completed_at: gameSession.completedAt,
    rating_eligible: gameSession.ratingEligible,
    summary: {
      score: gameSession.score,
      ppd: gameSession.ppdMilli === null ? null : gameSession.ppdMilli / 1000,
      three_dart_average:
        gameSession.threeDartAverageMilli === null
          ? null
          : gameSession.threeDartAverageMilli / 1000,
      mpr: gameSession.mprMilli === null ? null : gameSession.mprMilli / 1000,
      bull_count: gameSession.bullCount,
      triple_count: gameSession.tripleCount,
      double_count: gameSession.doubleCount,
      bust_count: gameSession.bustCount,
    },
    source_app: 'darts_app',
    source_record_id: gameSession.id,
  };
}

function mapGameType(mode: CommonGameSessionSource['mode']): CommonGameSessionJson['game_type'] {
  switch (mode) {
    case 'count_up':
      return 'COUNT_UP';
    case 'zero_one':
      return 'ZERO_ONE';
    case 'cricket':
      return 'CRICKET';
    case 'match':
      return 'MATCH';
  }
}

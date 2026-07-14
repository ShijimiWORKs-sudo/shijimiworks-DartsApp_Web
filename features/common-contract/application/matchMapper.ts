import type { CommonMatchJson } from '../domain/types';

export type CommonMatchSource = {
  matchId: string;
  accountId: string;
  status: 'completed' | 'aborted' | 'invalid';
  zeroOneStartScore: 501 | 701;
  outRule: 'single_out' | 'master_out';
  bullRule: 'fat_bull' | 'separate_bull';
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  gamesWon: Record<string, number>;
  gameIds: string[];
  completedAt: string | null;
  ratingCandidate: boolean;
};

export function toCommonMatchJson(match: CommonMatchSource): CommonMatchJson {
  return {
    match_id: match.matchId,
    account_id: match.accountId,
    status: match.status,
    zero_one_start_score: match.zeroOneStartScore,
    out_rule: match.outRule,
    bull_rule: match.bullRule,
    winner_player_id: match.winnerPlayerId,
    loser_player_id: match.loserPlayerId,
    games_won: match.gamesWon,
    game_ids: match.gameIds,
    completed_at: match.completedAt,
    rating_candidate: match.ratingCandidate,
    source_app: 'darts_app',
    source_record_id: match.matchId,
  };
}

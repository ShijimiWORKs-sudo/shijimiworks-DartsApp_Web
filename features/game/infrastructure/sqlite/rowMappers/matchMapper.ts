import type { Match } from '../../../domain/types';

export type MatchRow = {
  id: string;
  status: Match['status'];
  zero_one_start_score: Match['zeroOneStartScore'];
  out_rule: Match['outRule'];
  bull_rule: Match['bullRule'];
  current_game_no: number;
  winner_player_id: string | null;
  loser_player_id: string | null;
  row_version: number;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    status: row.status,
    zeroOneStartScore: row.zero_one_start_score,
    outRule: row.out_rule,
    bullRule: row.bull_rule,
    currentGameNo: row.current_game_no,
    winnerPlayerId: row.winner_player_id,
    loserPlayerId: row.loser_player_id,
    rowVersion: row.row_version,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

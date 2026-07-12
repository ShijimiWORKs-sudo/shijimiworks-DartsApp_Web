import type { GameSession } from '../../../domain/types';

export type GameSessionRow = {
  id: string;
  match_id: string | null;
  match_game_no: number | null;
  mode: GameSession['mode'];
  status: GameSession['status'];
  max_rounds: number;
  bull_rule: GameSession['bullRule'];
  out_rule: GameSession['outRule'];
  zero_one_start_score: GameSession['zeroOneStartScore'];
  player_count: 1 | 2;
  current_round_no: number;
  current_turn_sequence_no: number;
  current_player_id: string | null;
  winner_player_id: string | null;
  rating_candidate: number;
  row_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function mapGameSessionRow(row: GameSessionRow): GameSession {
  return {
    id: row.id,
    matchId: row.match_id,
    matchGameNo: row.match_game_no,
    mode: row.mode,
    status: row.status,
    maxRounds: row.max_rounds,
    bullRule: row.bull_rule,
    outRule: row.out_rule,
    zeroOneStartScore: row.zero_one_start_score,
    playerCount: row.player_count,
    currentRoundNo: row.current_round_no,
    currentTurnSequenceNo: row.current_turn_sequence_no,
    currentPlayerId: row.current_player_id,
    winnerPlayerId: row.winner_player_id,
    ratingCandidate: row.rating_candidate === 1,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

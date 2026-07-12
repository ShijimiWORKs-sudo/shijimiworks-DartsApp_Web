import type { GameRepository } from '../../../application/ports';
import type { GameSession } from '../../../domain/types';
import type { GameDatabaseConnection } from '../types';
import { mapGameSessionRow, type GameSessionRow } from '../rowMappers/gameMapper';

const GAME_COLUMNS = `
  id, match_id, match_game_no, mode, status, max_rounds, bull_rule, out_rule,
  zero_one_start_score, player_count, current_round_no, current_turn_sequence_no,
  current_player_id, winner_player_id, rating_candidate, row_version,
  created_at, updated_at, deleted_at
`;

export class SqliteGameRepository implements GameRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async findActive(): Promise<GameSession | null> {
    const row = await this.db.getFirstAsync<GameSessionRow>(
      `SELECT ${GAME_COLUMNS}
       FROM game_sessions
       WHERE status IN (?, ?) AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      'in_progress',
      'paused',
    );
    return row ? mapGameSessionRow(row) : null;
  }

  async findById(gameId: string): Promise<GameSession | null> {
    const row = await this.db.getFirstAsync<GameSessionRow>(
      `SELECT ${GAME_COLUMNS}
       FROM game_sessions
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      gameId,
    );
    return row ? mapGameSessionRow(row) : null;
  }
}

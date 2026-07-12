import type { MatchRepository } from '../../../application/ports';
import type { Match } from '../../../domain/types';
import type { GameDatabaseConnection } from '../types';
import { mapMatchRow, type MatchRow } from '../rowMappers/matchMapper';

const MATCH_COLUMNS = `
  id, status, zero_one_start_score, out_rule, bull_rule, current_game_no,
  winner_player_id, loser_player_id, row_version, started_at, paused_at,
  completed_at, created_at, updated_at, deleted_at
`;

export class SqliteMatchRepository implements MatchRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async findActive(): Promise<Match | null> {
    const row = await this.db.getFirstAsync<MatchRow>(
      `SELECT ${MATCH_COLUMNS}
       FROM matches
       WHERE status IN (?, ?) AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      'in_progress',
      'paused',
    );
    return row ? mapMatchRow(row) : null;
  }

  async findById(matchId: string): Promise<Match | null> {
    const row = await this.db.getFirstAsync<MatchRow>(
      `SELECT ${MATCH_COLUMNS}
       FROM matches
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      matchId,
    );
    return row ? mapMatchRow(row) : null;
  }
}

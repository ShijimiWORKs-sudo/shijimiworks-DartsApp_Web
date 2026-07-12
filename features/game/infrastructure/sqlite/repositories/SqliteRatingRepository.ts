import type { RatingRepository } from '../../../application/ports';
import type { RatingSnapshot } from '../../../domain/types';
import type { GameDatabaseConnection } from '../types';
import { mapRatingSnapshotRow, type RatingSnapshotRow } from '../rowMappers/ratingMapper';

export class SqliteRatingRepository implements RatingRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getLatestSnapshot(playerId: string): Promise<RatingSnapshot | null> {
    const row = await this.db.getFirstAsync<RatingSnapshotRow>(
      `SELECT
         id, player_id, evaluation_id, measurement_status, rating_tenths,
         confidence_bp, evaluated_match_count, created_at, invalidated_at
       FROM rating_snapshots
       WHERE player_id = ? AND invalidated_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      playerId,
    );
    return row ? mapRatingSnapshotRow(row) : null;
  }
}

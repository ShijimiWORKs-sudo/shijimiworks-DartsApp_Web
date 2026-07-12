import type { RatingSnapshot } from '../../../domain/types';

export type RatingSnapshotRow = {
  id: string;
  player_id: string;
  evaluation_id: string | null;
  measurement_status: RatingSnapshot['measurementStatus'];
  rating_tenths: number | null;
  confidence_bp: number;
  evaluated_match_count: number;
  created_at: string;
  invalidated_at: string | null;
};

export function mapRatingSnapshotRow(row: RatingSnapshotRow): RatingSnapshot {
  return {
    id: row.id,
    playerId: row.player_id,
    evaluationId: row.evaluation_id,
    measurementStatus: row.measurement_status,
    ratingTenths: row.rating_tenths,
    confidenceBp: row.confidence_bp,
    evaluatedMatchCount: row.evaluated_match_count,
    createdAt: row.created_at,
    invalidatedAt: row.invalidated_at,
  };
}

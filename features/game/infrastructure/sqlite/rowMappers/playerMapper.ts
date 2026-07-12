import type { Player } from '../../../domain/types';

export type PlayerRow = {
  id: string;
  player_type: Player['playerType'];
  display_name: string;
  throwing_hand: Player['throwingHand'];
  color_key: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  anonymized_at: string | null;
};

export function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    playerType: row.player_type,
    displayName: row.display_name,
    throwingHand: row.throwing_hand,
    colorKey: row.color_key,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    anonymizedAt: row.anonymized_at,
  };
}

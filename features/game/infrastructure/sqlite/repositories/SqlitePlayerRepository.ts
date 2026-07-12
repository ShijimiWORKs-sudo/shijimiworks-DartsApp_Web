import type { PlayerRepository } from '../../../application/ports';
import type { CreateGuestPlayerInput, CreateOwnerPlayerInput, Player } from '../../../domain/types';
import { createGameId } from '../../../domain/ids';
import type { GameDatabaseConnection, GameDatabaseExecutor } from '../types';
import { mapPlayerRow, type PlayerRow } from '../rowMappers/playerMapper';

const PLAYER_COLUMNS = `
  id, player_type, display_name, throwing_hand, color_key, is_archived,
  created_at, updated_at, last_used_at, anonymized_at
`;

export class SqlitePlayerRepository implements PlayerRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async getOrCreateOwner(
    input: CreateOwnerPlayerInput = { displayName: 'Owner' },
  ): Promise<Player> {
    let player: Player | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const existing = await transaction.getFirstAsync<PlayerRow>(
        `SELECT ${PLAYER_COLUMNS}
         FROM players
         WHERE player_type = ? AND is_archived = 0
         ORDER BY created_at ASC
         LIMIT 1`,
        'owner',
      );

      if (existing) {
        const now = new Date().toISOString();
        await transaction.runAsync(
          `UPDATE players
           SET last_used_at = ?, updated_at = ?
           WHERE id = ?`,
          now,
          now,
          existing.id,
        );
        player = { ...mapPlayerRow(existing), lastUsedAt: now, updatedAt: now };
        return;
      }

      player = await insertPlayer(transaction, {
        id: createGameId(),
        playerType: 'owner',
        displayName: input.displayName,
        throwingHand: input.throwingHand ?? 'unknown',
        colorKey: input.colorKey ?? null,
      });
    });

    if (!player) {
      throw new Error('Failed to create or load OWNER player.');
    }

    return player;
  }

  async createGuest(input: CreateGuestPlayerInput): Promise<Player> {
    let player: Player | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      player = await insertPlayer(transaction, {
        id: createGameId(),
        playerType: 'guest',
        displayName: input.displayName,
        throwingHand: input.throwingHand ?? 'unknown',
        colorKey: input.colorKey ?? null,
      });
    });

    if (!player) {
      throw new Error('Failed to create GUEST player.');
    }

    return player;
  }

  async listActiveGuests(): Promise<Player[]> {
    const rows = await this.db.getAllAsync<PlayerRow>(
      `SELECT ${PLAYER_COLUMNS}
       FROM players
       WHERE player_type = ? AND is_archived = 0
       ORDER BY last_used_at DESC, created_at DESC`,
      'guest',
    );
    return rows.map(mapPlayerRow);
  }

  async archive(playerId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE players
         SET is_archived = 1, updated_at = ?, anonymized_at = COALESCE(anonymized_at, ?)
         WHERE id = ? AND player_type = ?`,
        now,
        now,
        playerId,
        'guest',
      );
    });
  }

  async findById(playerId: string): Promise<Player | null> {
    const row = await this.db.getFirstAsync<PlayerRow>(
      `SELECT ${PLAYER_COLUMNS}
       FROM players
       WHERE id = ?
       LIMIT 1`,
      playerId,
    );
    return row ? mapPlayerRow(row) : null;
  }
}

async function insertPlayer(
  db: GameDatabaseExecutor,
  input: {
    id: string;
    playerType: Player['playerType'];
    displayName: string;
    throwingHand: Player['throwingHand'];
    colorKey: string | null;
  },
): Promise<Player> {
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO players(
       id, player_type, display_name, throwing_hand, color_key,
       is_archived, created_at, updated_at, last_used_at, anonymized_at
     )
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
    input.id,
    input.playerType,
    input.displayName.trim(),
    input.throwingHand,
    input.colorKey,
    now,
    now,
    now,
  );

  return {
    id: input.id,
    playerType: input.playerType,
    displayName: input.displayName.trim(),
    throwingHand: input.throwingHand,
    colorKey: input.colorKey,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    anonymizedAt: null,
  };
}

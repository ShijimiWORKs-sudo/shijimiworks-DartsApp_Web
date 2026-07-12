import type { IntegrationOutboxRepository } from '../../../application/ports';
import { createGameId } from '../../../domain/ids';
import type { EnqueueOutboxInput, IntegrationOutboxEvent } from '../../../domain/types';
import type { GameDatabaseConnection } from '../types';
import { mapOutboxRow, type OutboxRow } from '../rowMappers/outboxMapper';

const OUTBOX_COLUMNS = `
  id, event_type, aggregate_type, aggregate_id, idempotency_key, payload_json,
  status, attempt_count, available_at, last_error_code, last_error_message,
  created_at, updated_at, processed_at
`;

export class SqliteIntegrationOutboxRepository implements IntegrationOutboxRepository {
  constructor(private readonly db: GameDatabaseConnection) {}

  async enqueue(input: EnqueueOutboxInput): Promise<IntegrationOutboxEvent> {
    let event: IntegrationOutboxEvent | null = null;

    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      const existing = await transaction.getFirstAsync<OutboxRow>(
        `SELECT ${OUTBOX_COLUMNS}
         FROM integration_outbox
         WHERE idempotency_key = ?
         LIMIT 1`,
        input.idempotencyKey,
      );

      if (existing) {
        event = mapOutboxRow(existing);
        return;
      }

      const now = new Date().toISOString();
      const id = createGameId();
      const availableAt = input.availableAt ?? now;

      await transaction.runAsync(
        `INSERT INTO integration_outbox(
           id, event_type, aggregate_type, aggregate_id, idempotency_key,
           payload_json, status, attempt_count, available_at,
           last_error_code, last_error_message, created_at, updated_at, processed_at
         )
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?, NULL)`,
        id,
        input.eventType,
        input.aggregateType,
        input.aggregateId,
        input.idempotencyKey,
        input.payloadJson,
        availableAt,
        now,
        now,
      );

      event = {
        id,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        idempotencyKey: input.idempotencyKey,
        payloadJson: input.payloadJson,
        status: 'pending',
        attemptCount: 0,
        availableAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: now,
        updatedAt: now,
        processedAt: null,
      };
    });

    if (!event) {
      throw new Error('Failed to enqueue outbox event.');
    }

    return event;
  }

  async listPending(limit = 20, now = new Date().toISOString()): Promise<IntegrationOutboxEvent[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      `SELECT ${OUTBOX_COLUMNS}
       FROM integration_outbox
       WHERE status = ? AND available_at <= ?
       ORDER BY available_at ASC, created_at ASC
       LIMIT ?`,
      'pending',
      now,
      limit,
    );
    return rows.map(mapOutboxRow);
  }

  async markProcessed(id: string, processedAt = new Date().toISOString()): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE integration_outbox
         SET status = 'completed', processed_at = ?, updated_at = ?
         WHERE id = ?`,
        processedAt,
        processedAt,
        id,
      );
    });
  }

  async markFailed(
    id: string,
    error: { code: string; message: string },
    failedAt = new Date().toISOString(),
  ): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE integration_outbox
         SET status = 'failed',
             attempt_count = attempt_count + 1,
             last_error_code = ?,
             last_error_message = ?,
             updated_at = ?
         WHERE id = ?`,
        error.code,
        error.message,
        failedAt,
        id,
      );
    });
  }
}

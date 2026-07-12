import type { IntegrationOutboxEvent } from '../../../domain/types';

export type OutboxRow = {
  id: string;
  event_type: IntegrationOutboxEvent['eventType'];
  aggregate_type: IntegrationOutboxEvent['aggregateType'];
  aggregate_id: string;
  idempotency_key: string;
  payload_json: string;
  status: IntegrationOutboxEvent['status'];
  attempt_count: number;
  available_at: string;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

export function mapOutboxRow(row: OutboxRow): IntegrationOutboxEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    idempotencyKey: row.idempotency_key,
    payloadJson: row.payload_json,
    status: row.status,
    attemptCount: row.attempt_count,
    availableAt: row.available_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
  };
}

import { createGameId } from '../../game/domain/ids';
import type { CommonEvent, CommonEventType, CommonOutboxItem } from '../domain/types';

export type CommonEventInput = {
  eventType: CommonEventType;
  accountId: string;
  sourceRecordId?: string | null;
  occurredAt?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
};

export function createCommonEvent(input: CommonEventInput): CommonEvent {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    event_id: createGameId(),
    event_type: input.eventType,
    event_version: 1,
    account_id: input.accountId,
    source_app: 'darts_app',
    source_record_id: input.sourceRecordId ?? null,
    occurred_at: input.occurredAt ?? createdAt,
    created_at: createdAt,
    payload: input.payload ?? {},
  };
}

export function createCommonOutboxItem(
  event: CommonEvent,
  now = new Date().toISOString(),
): CommonOutboxItem {
  return {
    outbox_id: createGameId(),
    event,
    sync_status: 'local_only',
    retry_count: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  };
}

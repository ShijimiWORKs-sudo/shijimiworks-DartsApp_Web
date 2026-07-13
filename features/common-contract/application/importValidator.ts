import {
  DARTS_COMMON_CONTRACT_NAME,
  DARTS_COMMON_CONTRACT_VERSION,
  type CommonExportEnvelope,
  type CommonImportPreview,
  type CommonSourceApp,
} from '../domain/types';
import { assertUuidV4, isRecord } from './validators';

const SOURCE_APPS = new Set<CommonSourceApp>(['darts_app', 'darts_support_app']);

export function validateCommonImportEnvelope(value: unknown): CommonExportEnvelope {
  if (!isRecord(value)) {
    throw new Error('Import payload must be a JSON object.');
  }

  if (value.contract_name !== DARTS_COMMON_CONTRACT_NAME) {
    throw new Error('Unsupported common contract name.');
  }

  if (value.contract_version !== DARTS_COMMON_CONTRACT_VERSION) {
    throw new Error('Unsupported common contract version.');
  }

  if (!SOURCE_APPS.has(value.source_app as CommonSourceApp)) {
    throw new Error('Unsupported source_app.');
  }

  const accountId = assertUuidV4(value.account_id, 'account_id');
  const exportId = assertUuidV4(value.export_id, 'export_id');

  if (typeof value.source_app_version !== 'string' || value.source_app_version.length === 0) {
    throw new Error('source_app_version is required.');
  }
  const sourceAppVersion = value.source_app_version;

  if (typeof value.exported_at !== 'string' || Number.isNaN(Date.parse(value.exported_at))) {
    throw new Error('exported_at must be an ISO 8601 timestamp.');
  }
  const exportedAt = value.exported_at;

  if (!isRecord(value.payload)) {
    throw new Error('payload must be a JSON object.');
  }

  return {
    contract_name: DARTS_COMMON_CONTRACT_NAME,
    contract_version: DARTS_COMMON_CONTRACT_VERSION,
    export_id: exportId,
    exported_at: exportedAt,
    source_app: value.source_app as CommonSourceApp,
    source_app_version: sourceAppVersion,
    account_id: accountId,
    payload: value.payload,
  };
}

export function previewCommonImportEnvelope(value: unknown): CommonImportPreview {
  const envelope = validateCommonImportEnvelope(value);
  const events = envelope.payload.events;
  return {
    account_id: envelope.account_id,
    source_app: envelope.source_app,
    source_app_version: envelope.source_app_version,
    payload_keys: Object.keys(envelope.payload).sort(),
    event_count: Array.isArray(events) ? events.length : 0,
  };
}

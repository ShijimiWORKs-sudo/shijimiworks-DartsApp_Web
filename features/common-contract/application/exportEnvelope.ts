import { createGameId } from '../../game/domain/ids';
import {
  DARTS_COMMON_CONTRACT_NAME,
  DARTS_COMMON_CONTRACT_VERSION,
  DARTS_COMMON_SOURCE_APP,
  type CommonExportEnvelope,
} from '../domain/types';

export function createCommonExportEnvelope<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  accountId: string,
  appVersion: string,
  exportedAt = new Date().toISOString(),
): CommonExportEnvelope<TPayload> {
  return {
    contract_name: DARTS_COMMON_CONTRACT_NAME,
    contract_version: DARTS_COMMON_CONTRACT_VERSION,
    export_id: createGameId(),
    exported_at: exportedAt,
    source_app: DARTS_COMMON_SOURCE_APP,
    source_app_version: appVersion,
    account_id: accountId,
    payload,
  };
}

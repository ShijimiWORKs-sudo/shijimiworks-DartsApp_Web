export const DARTS_COMMON_CONTRACT_NAME = 'darts_common_data';
export const DARTS_COMMON_CONTRACT_VERSION = 1;
export const DARTS_COMMON_SOURCE_APP = 'darts_app';

export type CommonSourceApp = 'darts_app' | 'darts_support_app';

export type CommonAccountStatus =
  'local_active' | 'cloud_pending' | 'cloud_active' | 'suspended' | 'deleted';

export type CommonAuthMode = 'local_pin' | 'local_no_auth' | 'email_password' | 'apple' | 'google';

export type CommonPlayerType = 'owner' | 'guest';

export type CommonRatingStatus = 'unmeasured' | 'measuring' | 'provisional' | 'standard' | 'stable';

export type CommonSyncStatus =
  'local_only' | 'pending' | 'synced' | 'conflict' | 'failed' | 'deleted';

export type CommonEventType =
  | 'account_created'
  | 'account_profile_updated'
  | 'practice_session_completed'
  | 'game_session_completed'
  | 'match_completed'
  | 'rating_updated'
  | 'consultation_saved'
  | 'record_deleted';

export type CommonAccountJson = {
  schema_version: 1;
  account_id: string;
  legacy_account_id?: string | null;
  user_name: string | null;
  display_name: string;
  email: string | null;
  account_status: CommonAccountStatus;
  auth_mode: CommonAuthMode;
  cloud_auth_subject: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CommonPlayerProfileJson = {
  schema_version: 1;
  profile_id: string;
  account_id: string | null;
  player_type: CommonPlayerType;
  display_name: string;
  throwing_hand: 'right' | 'left' | 'unknown';
  main_machine: string | null;
  rating_system_preference: 'dartsapp';
  self_reported_rating: number | null;
  avatar_uri: string | null;
  created_at: string;
  updated_at: string;
};

export type CommonRatingJson = {
  schema_version: 1;
  rating_profile_id: string;
  account_id: string;
  rating_value: number | null;
  rating_status: CommonRatingStatus;
  confidence_percent: number;
  evaluated_match_count: number;
  calculation_version: number;
  updated_at: string;
};

export type CommonGameSessionJson = {
  session_id: string;
  game_id: string;
  account_id: string;
  mode: 'count_up' | 'zero_one' | 'cricket' | 'match';
  game_type: 'COUNT_UP' | 'ZERO_ONE' | 'CRICKET' | 'MATCH';
  game_variant: string | null;
  status: 'completed' | 'aborted' | 'invalid';
  started_at: string | null;
  completed_at: string | null;
  completion_reason: string | null;
  rating_eligible: boolean;
  rating_candidate: boolean;
  summary: {
    score: number | null;
    cricket_score: number | null;
    ppd: number | null;
    three_dart_average: number | null;
    mpr: number | null;
    mpr_milli: number | null;
    marks_total: number | null;
    closed_number_count: number | null;
    rounds_count: number | null;
    darts_thrown: number | null;
    bull_count: number;
    triple_count: number;
    double_count: number;
    bust_count: number;
  };
  source_app: 'darts_app';
  source_record_id: string;
};

export type CommonMatchJson = {
  match_id: string;
  account_id: string;
  status: 'completed' | 'aborted' | 'invalid';
  zero_one_start_score: 501 | 701;
  out_rule: 'single_out' | 'master_out';
  bull_rule: 'fat_bull' | 'separate_bull';
  winner_player_id: string | null;
  loser_player_id: string | null;
  games_won: Record<string, number>;
  game_ids: string[];
  completed_at: string | null;
  rating_candidate: boolean;
  source_app: 'darts_app';
  source_record_id: string;
};

export type CommonEvent = {
  event_id: string;
  event_type: CommonEventType;
  event_version: 1;
  account_id: string;
  source_app: 'darts_app';
  source_record_id: string | null;
  occurred_at: string;
  created_at: string;
  payload: Record<string, unknown>;
};

export type CommonOutboxItem = {
  outbox_id: string;
  event: CommonEvent;
  sync_status: CommonSyncStatus;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CommonExportEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
  contract_name: typeof DARTS_COMMON_CONTRACT_NAME;
  contract_version: typeof DARTS_COMMON_CONTRACT_VERSION;
  export_id: string;
  exported_at: string;
  source_app: CommonSourceApp;
  source_app_version: string;
  account_id: string;
  payload: TPayload;
};

export type CommonImportPreview = {
  account_id: string;
  source_app: CommonSourceApp;
  source_app_version: string;
  payload_keys: string[];
  event_count: number;
};

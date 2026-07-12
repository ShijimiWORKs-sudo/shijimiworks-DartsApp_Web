import type { GameDatabaseExecutor } from '../types';

export const INITIAL_GAME_DATABASE_VERSION = 1;
export const INITIAL_GAME_DATABASE_NAME = '001_initial_game_database';

// Synchronized with docs/specs/DartsApp_DB_v1_schema.sql for Game Database v1.
export const INITIAL_GAME_DATABASE_SQL = String.raw`
CREATE TABLE IF NOT EXISTS db_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY NOT NULL,
  player_type TEXT NOT NULL CHECK (player_type IN ('owner', 'guest')),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 30),
  throwing_hand TEXT NOT NULL DEFAULT 'unknown' CHECK (throwing_hand IN ('right', 'left', 'unknown')),
  color_key TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  anonymized_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_players_active_owner
ON players ((1))
WHERE player_type = 'owner' AND is_archived = 0;

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('configured', 'in_progress', 'paused', 'completed', 'aborted', 'invalid')),
  zero_one_start_score INTEGER NOT NULL CHECK (zero_one_start_score IN (501, 701)),
  out_rule TEXT NOT NULL CHECK (out_rule IN ('single_out', 'master_out', 'double_out')),
  bull_rule TEXT NOT NULL CHECK (bull_rule IN ('fat_bull', 'separate_bull')),
  first_throw_player_id TEXT REFERENCES players(id),
  current_game_no INTEGER NOT NULL DEFAULT 0 CHECK (current_game_no BETWEEN 0 AND 3),
  choice_game_mode TEXT CHECK (choice_game_mode IN ('zero_one', 'cricket')),
  choice_selected_by_player_id TEXT REFERENCES players(id),
  choice_reason TEXT,
  choice_selected_at TEXT,
  winner_player_id TEXT REFERENCES players(id),
  loser_player_id TEXT REFERENCES players(id),
  completion_reason TEXT,
  manual_winner_reason TEXT,
  aborted_by_player_id TEXT REFERENCES players(id),
  abort_reason TEXT,
  row_version INTEGER NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  started_at TEXT,
  paused_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_active
ON matches ((1))
WHERE status IN ('in_progress', 'paused')
  AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  slot_no INTEGER NOT NULL CHECK (slot_no IN (1, 2)),
  display_name_snapshot TEXT NOT NULL,
  player_type_snapshot TEXT NOT NULL CHECK (player_type_snapshot IN ('owner', 'guest')),
  games_won INTEGER NOT NULL DEFAULT 0 CHECK (games_won BETWEEN 0 AND 2),
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'win', 'loss', 'no_result')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (match_id, player_id),
  UNIQUE (match_id, slot_no)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  match_game_no INTEGER CHECK (match_game_no BETWEEN 1 AND 3),
  mode TEXT NOT NULL CHECK (mode IN ('count_up', 'zero_one', 'cricket', 'dojo', 'cricket_count_up')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'in_progress', 'paused', 'completed', 'aborted', 'invalid')),
  completion_reason TEXT,
  max_rounds INTEGER NOT NULL CHECK (max_rounds > 0),
  bull_rule TEXT NOT NULL CHECK (bull_rule IN ('fat_bull', 'separate_bull')),
  out_rule TEXT CHECK (out_rule IN ('single_out', 'master_out', 'double_out')),
  zero_one_start_score INTEGER CHECK (zero_one_start_score IN (301, 501, 701, 901)),
  player_count INTEGER NOT NULL CHECK (player_count IN (1, 2)),
  current_round_no INTEGER NOT NULL DEFAULT 1 CHECK (current_round_no >= 1),
  current_turn_sequence_no INTEGER NOT NULL DEFAULT 0 CHECK (current_turn_sequence_no >= 0),
  current_player_id TEXT REFERENCES players(id),
  winner_player_id TEXT REFERENCES players(id),
  manual_winner_reason TEXT,
  rating_candidate INTEGER NOT NULL DEFAULT 0 CHECK (rating_candidate IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  row_version INTEGER NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  started_at TEXT,
  paused_at TEXT,
  completed_at TEXT,
  aborted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK ((match_id IS NULL AND match_game_no IS NULL) OR (match_id IS NOT NULL AND match_game_no IS NOT NULL)),
  CHECK (
    (mode = 'zero_one' AND out_rule IS NOT NULL AND zero_one_start_score IS NOT NULL)
    OR (mode <> 'zero_one' AND out_rule IS NULL AND zero_one_start_score IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_game_sessions_match_game
ON game_sessions (match_id, match_game_no)
WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_game_sessions_single_active
ON game_sessions ((1))
WHERE status IN ('in_progress', 'paused') AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  slot_no INTEGER NOT NULL CHECK (slot_no IN (1, 2)),
  turn_order INTEGER NOT NULL CHECK (turn_order IN (1, 2)),
  display_name_snapshot TEXT NOT NULL,
  player_type_snapshot TEXT NOT NULL CHECK (player_type_snapshot IN ('owner', 'guest')),
  starting_score INTEGER,
  current_remaining_score INTEGER,
  current_total_score INTEGER NOT NULL DEFAULT 0,
  current_cricket_score INTEGER NOT NULL DEFAULT 0,
  darts_thrown INTEGER NOT NULL DEFAULT 0 CHECK (darts_thrown >= 0),
  turns_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (turns_confirmed >= 0),
  is_winner INTEGER NOT NULL DEFAULT 0 CHECK (is_winner IN (0, 1)),
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'win', 'loss', 'completed', 'no_result')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (game_id, slot_no),
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'terminated', 'voided')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (game_id, round_no)
);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  turn_sequence_no INTEGER NOT NULL CHECK (turn_sequence_no >= 1),
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  player_turn_order INTEGER NOT NULL CHECK (player_turn_order IN (1, 2)),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'confirmed', 'bust', 'checkout', 'game_end', 'voided', 'invalid')),
  start_remaining_score INTEGER,
  end_remaining_score INTEGER,
  raw_score INTEGER NOT NULL DEFAULT 0,
  applied_score INTEGER NOT NULL DEFAULT 0,
  cricket_marks_total INTEGER NOT NULL DEFAULT 0,
  cricket_points_scored INTEGER NOT NULL DEFAULT 0,
  is_bust INTEGER NOT NULL DEFAULT 0 CHECK (is_bust IN (0, 1)),
  is_checkout INTEGER NOT NULL DEFAULT 0 CHECK (is_checkout IN (0, 1)),
  dart_count INTEGER NOT NULL DEFAULT 0 CHECK (dart_count BETWEEN 0 AND 3),
  revision_no INTEGER NOT NULL DEFAULT 0 CHECK (revision_no >= 0),
  started_at TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (game_id, turn_sequence_no),
  UNIQUE (round_id, game_player_id)
);

CREATE TABLE IF NOT EXISTS darts (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  dart_no INTEGER NOT NULL CHECK (dart_no BETWEEN 1 AND 3),
  segment_number INTEGER CHECK (segment_number BETWEEN 1 AND 20),
  area TEXT NOT NULL CHECK (area IN ('single', 'double', 'triple', 'outer_bull', 'inner_bull', 'miss')),
  multiplier INTEGER NOT NULL CHECK (multiplier IN (0, 1, 2, 3)),
  score INTEGER NOT NULL CHECK (score >= 0),
  cricket_marks INTEGER NOT NULL DEFAULT 0 CHECK (cricket_marks BETWEEN 0 AND 3),
  input_source TEXT NOT NULL CHECK (input_source IN ('manual_segment', 'manual_board_point', 'photo_detected', 'photo_adjusted', 'imported', 'system_correction')),
  detection_confidence_bp INTEGER CHECK (detection_confidence_bp BETWEEN 0 AND 10000),
  candidate_id TEXT,
  normalized_x REAL CHECK (normalized_x BETWEEN 0.0 AND 1.0),
  normalized_y REAL CHECK (normalized_y BETWEEN 0.0 AND 1.0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided', 'invalidated')),
  is_rating_eligible INTEGER NOT NULL DEFAULT 1 CHECK (is_rating_eligible IN (0, 1)),
  correction_count INTEGER NOT NULL DEFAULT 0 CHECK (correction_count >= 0),
  client_action_id TEXT NOT NULL UNIQUE,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (turn_id, dart_no),
  CHECK (
    (area IN ('single', 'double', 'triple') AND segment_number IS NOT NULL)
    OR (area IN ('outer_bull', 'inner_bull', 'miss') AND segment_number IS NULL)
  ),
  CHECK (
    (area = 'single' AND multiplier = 1)
    OR (area = 'double' AND multiplier = 2)
    OR (area = 'triple' AND multiplier = 3)
    OR (area IN ('outer_bull', 'inner_bull') AND multiplier IN (1, 2))
    OR (area = 'miss' AND multiplier = 0 AND score = 0)
  )
);

CREATE TABLE IF NOT EXISTS cricket_number_states (
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('20', '19', '18', '17', '16', '15', 'BULL')),
  marks_total INTEGER NOT NULL DEFAULT 0 CHECK (marks_total >= 0),
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  closed_at_turn_id TEXT REFERENCES turns(id),
  closed_at_round_no INTEGER CHECK (closed_at_round_no >= 1),
  points_scored INTEGER NOT NULL DEFAULT 0 CHECK (points_scored >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, game_player_id, target)
);

CREATE TABLE IF NOT EXISTS domain_events (
  id TEXT PRIMARY KEY NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('match', 'game', 'rating')),
  scope_id TEXT NOT NULL,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  game_id TEXT REFERENCES game_sessions(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 1),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  client_action_id TEXT UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (scope_type, scope_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS game_player_results (
  game_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  game_player_id TEXT NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'completed', 'no_result')),
  rank_no INTEGER CHECK (rank_no >= 1),
  is_final INTEGER NOT NULL DEFAULT 1 CHECK (is_final IN (0, 1)),
  final_total_score INTEGER NOT NULL DEFAULT 0,
  final_remaining_score INTEGER,
  effective_score INTEGER NOT NULL DEFAULT 0,
  rounds_count INTEGER NOT NULL DEFAULT 0,
  turns_count INTEGER NOT NULL DEFAULT 0,
  darts_thrown INTEGER NOT NULL DEFAULT 0,
  bull_count INTEGER NOT NULL DEFAULT 0,
  inner_bull_count INTEGER NOT NULL DEFAULT 0,
  outer_bull_count INTEGER NOT NULL DEFAULT 0,
  triple_count INTEGER NOT NULL DEFAULT 0,
  double_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  bust_count INTEGER NOT NULL DEFAULT 0,
  checkout_flag INTEGER NOT NULL DEFAULT 0 CHECK (checkout_flag IN (0, 1)),
  checkout_round_no INTEGER,
  checkout_darts INTEGER,
  ppd_milli INTEGER,
  three_dart_average_milli INTEGER,
  cricket_marks_total INTEGER NOT NULL DEFAULT 0,
  mpr_milli INTEGER,
  closed_number_count INTEGER NOT NULL DEFAULT 0 CHECK (closed_number_count BETWEEN 0 AND 7),
  high_turn_score INTEGER,
  low_turn_score INTEGER,
  turns_100_plus INTEGER NOT NULL DEFAULT 0,
  turns_140_plus INTEGER NOT NULL DEFAULT 0,
  turns_180 INTEGER NOT NULL DEFAULT 0,
  turns_5_marks_plus INTEGER NOT NULL DEFAULT 0,
  turns_7_marks_plus INTEGER NOT NULL DEFAULT 0,
  turns_9_marks INTEGER NOT NULL DEFAULT 0,
  manual_correction_count INTEGER NOT NULL DEFAULT 0,
  auto_detected_darts INTEGER NOT NULL DEFAULT 0,
  adjusted_darts INTEGER NOT NULL DEFAULT 0,
  fully_manual_darts INTEGER NOT NULL DEFAULT 0,
  auto_adoption_rate_bp INTEGER CHECK (auto_adoption_rate_bp BETWEEN 0 AND 10000),
  extra_stats_json TEXT NOT NULL DEFAULT '{}',
  calculation_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (game_id, game_player_id)
);

CREATE TABLE IF NOT EXISTS match_player_results (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'no_result')),
  games_won INTEGER NOT NULL DEFAULT 0 CHECK (games_won BETWEEN 0 AND 2),
  games_lost INTEGER NOT NULL DEFAULT 0 CHECK (games_lost BETWEEN 0 AND 2),
  zero_one_game_count INTEGER NOT NULL DEFAULT 0,
  zero_one_ppd_milli INTEGER,
  zero_one_three_dart_average_milli INTEGER,
  cricket_game_count INTEGER NOT NULL DEFAULT 0,
  cricket_mpr_milli INTEGER,
  total_darts INTEGER NOT NULL DEFAULT 0,
  bull_count INTEGER NOT NULL DEFAULT 0,
  triple_count INTEGER NOT NULL DEFAULT 0,
  double_count INTEGER NOT NULL DEFAULT 0,
  bust_count INTEGER NOT NULL DEFAULT 0,
  manual_correction_count INTEGER NOT NULL DEFAULT 0,
  auto_detected_darts INTEGER NOT NULL DEFAULT 0,
  adjusted_darts INTEGER NOT NULL DEFAULT 0,
  fully_manual_darts INTEGER NOT NULL DEFAULT 0,
  auto_adoption_rate_bp INTEGER CHECK (auto_adoption_rate_bp BETWEEN 0 AND 10000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS rating_evaluations (
  id TEXT PRIMARY KEY NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'eligible', 'excluded', 'applied', 'invalidated')),
  candidate_flag INTEGER NOT NULL CHECK (candidate_flag IN (0, 1)),
  match_result TEXT NOT NULL CHECK (match_result IN ('win', 'loss')),
  zero_one_game_count INTEGER NOT NULL DEFAULT 0,
  zero_one_ppd_milli INTEGER,
  cricket_game_count INTEGER NOT NULL DEFAULT 0,
  cricket_mpr_milli INTEGER,
  total_darts INTEGER NOT NULL DEFAULT 0,
  auto_detected_darts INTEGER NOT NULL DEFAULT 0,
  adjusted_darts INTEGER NOT NULL DEFAULT 0,
  fully_manual_darts INTEGER NOT NULL DEFAULT 0,
  correction_count INTEGER NOT NULL DEFAULT 0,
  input_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  evaluated_at TEXT,
  applied_at TEXT,
  invalidated_at TEXT,
  UNIQUE (match_id, player_id, source_revision)
);

CREATE TABLE IF NOT EXISTS rating_evaluation_games (
  evaluation_id TEXT NOT NULL REFERENCES rating_evaluations(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES game_sessions(id),
  mode TEXT NOT NULL CHECK (mode IN ('zero_one', 'cricket')),
  game_no INTEGER NOT NULL CHECK (game_no BETWEEN 1 AND 3),
  ppd_milli INTEGER,
  three_dart_average_milli INTEGER,
  mpr_milli INTEGER,
  darts_thrown INTEGER NOT NULL DEFAULT 0,
  rounds_count INTEGER NOT NULL DEFAULT 0,
  checkout_flag INTEGER NOT NULL DEFAULT 0 CHECK (checkout_flag IN (0, 1)),
  bust_count INTEGER NOT NULL DEFAULT 0,
  marks_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (evaluation_id, game_id)
);

CREATE TABLE IF NOT EXISTS rating_evaluation_exclusions (
  evaluation_id TEXT NOT NULL REFERENCES rating_evaluations(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (evaluation_id, reason_code)
);

CREATE TABLE IF NOT EXISTS rating_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  evaluation_id TEXT UNIQUE REFERENCES rating_evaluations(id),
  previous_snapshot_id TEXT REFERENCES rating_snapshots(id),
  measurement_status TEXT NOT NULL CHECK (measurement_status IN ('unmeasured', 'provisional_1_of_3', 'provisional_2_of_3', 'provisional', 'standard', 'stable')),
  rating_tenths INTEGER CHECK (rating_tenths BETWEEN 10 AND 180),
  confidence_bp INTEGER NOT NULL CHECK (confidence_bp BETWEEN 0 AND 10000),
  evaluated_match_count INTEGER NOT NULL DEFAULT 0,
  window_match_count INTEGER NOT NULL DEFAULT 0,
  zero_one_index_milli INTEGER,
  cricket_index_milli INTEGER,
  match_index_milli INTEGER,
  stability_adjustment_milli INTEGER,
  continuity_bonus_milli INTEGER,
  calculation_version INTEGER NOT NULL,
  calculation_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  invalidated_at TEXT
);

CREATE TABLE IF NOT EXISTS integration_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('practice_record_upsert', 'practice_record_delete', 'rating_recalculate')),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('game', 'match', 'player')),
  aggregate_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TEXT NOT NULL,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_record_links (
  game_id TEXT PRIMARY KEY NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  practice_record_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'linked', 'error')),
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_last_used ON players (is_archived, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status_updated ON matches (status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_matches_completed ON matches (completed_at DESC) WHERE status = 'completed' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players (player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status_updated ON game_sessions (status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode_completed ON game_sessions (mode, completed_at DESC) WHERE status = 'completed' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_game_sessions_match ON game_sessions (match_id, match_game_no);
CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players (player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_rounds_game_round ON rounds (game_id, round_no);
CREATE INDEX IF NOT EXISTS idx_turns_game_sequence ON turns (game_id, turn_sequence_no);
CREATE INDEX IF NOT EXISTS idx_turns_game_player ON turns (game_player_id, turn_sequence_no);
CREATE INDEX IF NOT EXISTS idx_darts_game_turn ON darts (game_id, turn_id, dart_no);
CREATE INDEX IF NOT EXISTS idx_darts_game_player ON darts (game_player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_darts_rating_quality ON darts (game_id, is_rating_eligible, input_source, status);
CREATE INDEX IF NOT EXISTS idx_domain_events_game_sequence ON domain_events (game_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_domain_events_match_sequence ON domain_events (match_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_game_player_results_player ON game_player_results (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_player_results_player ON match_player_results (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_evaluations_player_status ON rating_evaluations (player_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_evaluations_match ON rating_evaluations (match_id, source_revision DESC);
CREATE INDEX IF NOT EXISTS idx_rating_snapshots_current ON rating_snapshots (player_id, created_at DESC) WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_dispatch ON integration_outbox (status, available_at, created_at);
`;

export const INITIAL_GAME_DATABASE_CHECKSUM = 'dartsapp-game-db-v1-2026-07-12-phase1';

export async function runInitialGameDatabaseMigration(db: GameDatabaseExecutor): Promise<void> {
  await db.execAsync(INITIAL_GAME_DATABASE_SQL);
}

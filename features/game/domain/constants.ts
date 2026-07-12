export const PLAYER_KINDS = ['owner', 'guest'] as const;

export const GAME_MODES = ['count_up', 'zero_one', 'cricket', 'dojo', 'cricket_count_up'] as const;

export const GAME_STATUSES = [
  'draft',
  'ready',
  'in_progress',
  'paused',
  'completed',
  'aborted',
  'invalid',
] as const;

export const MATCH_STATUSES = [
  'configured',
  'in_progress',
  'paused',
  'completed',
  'aborted',
  'invalid',
] as const;

export const OUT_RULES = ['single_out', 'master_out', 'double_out'] as const;
export const BULL_RULES = ['fat_bull', 'separate_bull'] as const;

export const INPUT_SOURCES = [
  'manual_segment',
  'manual_board_point',
  'photo_detected',
  'photo_adjusted',
  'imported',
  'system_correction',
] as const;

export const DART_AREAS = [
  'single',
  'double',
  'triple',
  'outer_bull',
  'inner_bull',
  'miss',
] as const;

export const TURN_RESULTS = [
  'in_progress',
  'confirmed',
  'bust',
  'checkout',
  'game_end',
  'voided',
  'invalid',
] as const;

export const RATING_ELIGIBILITY_STATUSES = [
  'pending',
  'eligible',
  'excluded',
  'applied',
  'invalidated',
] as const;

export const OUTBOX_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

export const OUTBOX_EVENT_TYPES = [
  'practice_record_upsert',
  'practice_record_delete',
  'rating_recalculate',
] as const;

export const ACTIVE_GAME_STATUSES = ['in_progress', 'paused'] as const;
export const ACTIVE_MATCH_STATUSES = ['in_progress', 'paused'] as const;

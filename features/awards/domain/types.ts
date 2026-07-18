import type { DartArea } from '../../game/domain/types';

export type AwardCode =
  | 'LOW_TON'
  | 'HIGH_TON'
  | 'TON_80'
  | 'HAT_TRICK'
  | 'THREE_IN_THE_BLACK'
  | 'WHITE_HORSE'
  | 'IN_BULL'
  | 'OUT_BULL'
  | 'NORMAL'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'CRICKET_DOUBLE'
  | 'CRICKET_TRIPLE';

export type AwardPlaybackOwner = 'camera_pc' | 'game_pc' | 'mirror_only';

export type AwardDart = {
  area: DartArea;
  segmentNumber: number | null;
  multiplier: 0 | 1 | 2 | 3;
  score: number;
  cricketMarks?: number;
  isCricketTarget?: boolean;
  status?: 'active' | 'voided' | 'invalidated';
};

export type AwardContext = {
  mode: 'count_up' | 'zero_one' | 'cricket' | 'match';
  playbackOwner: AwardPlaybackOwner;
  mirrorEnabled?: boolean;
};

export type AwardEvent = {
  awardId: string;
  code: AwardCode;
  label: string;
  priority: number;
  playbackOwner: AwardPlaybackOwner;
  createdAt: string;
};

export type AwardAsset = {
  code: AwardCode;
  label: string;
  videoUri: string | null;
  audioUri: string | null;
  fallbackAnimation: string;
};

import type { BoardType } from '../types';

export const boardTypeLabels: Record<BoardType, string> = {
  DARTSLIVE_ZERO: 'DARTSLIVE ZERO',
  QUIET_SOFT: '静音ソフトダーツボード',
  CORK: 'コルクボード',
  OTHER: 'その他練習ボード',
};

export const boardTypes = Object.keys(boardTypeLabels) as BoardType[];

export const dartHitAreaLabels = {
  single: 'シングル',
  double: 'ダブル',
  triple: 'トリプル',
  singleBull: 'シングルブル',
  doubleBull: 'ダブルブル',
  out: 'アウト',
} as const;

import type { Condition, DartMachine, PracticeGame } from '../types';

export const machineLabels: Record<DartMachine, string> = {
  DARTSLIVE: 'DARTSLIVE',
  PHOENIX: 'PHOENIX',
  BOTH: '両方',
};

export const gameLabels: Record<PracticeGame, string> = {
  'COUNT-UP': 'COUNT-UP',
  '01': '01',
  CRICKET: 'CRICKET',
  OTHER: 'その他',
};

export const conditionLabels: Record<Condition, string> = {
  good: '良い',
  normal: '普通',
  bad: '悪い',
};

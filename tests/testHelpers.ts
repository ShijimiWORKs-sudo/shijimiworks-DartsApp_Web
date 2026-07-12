import type { Condition, DartMachine, PracticeGame, PracticeRecord, UserProfile } from '../types';

export function buildRecord(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return {
    id: overrides.id ?? `record-${Math.random()}`,
    date: overrides.date ?? daysAgo(0),
    practiceMenuId: overrides.practiceMenuId ?? 'beginner-bull-count-up-12',
    practiceMenuName: overrides.practiceMenuName ?? 'ブル位置確認 COUNT-UP',
    machineType: overrides.machineType ?? 'DARTSLIVE',
    gameType: overrides.gameType ?? 'COUNT-UP',
    score: overrides.score ?? 500,
    bullCount: overrides.bullCount ?? 10,
    cricketMarks: overrides.cricketMarks ?? 20,
    condition: overrides.condition ?? 'normal',
    memo: overrides.memo ?? '',
  };
}

export function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    rating: overrides.rating ?? 7,
    level: overrides.level ?? 'intermediate',
    machineType: overrides.machineType ?? 'BOTH',
    mainProblems: overrides.mainProblems ?? ['ブル率が低い'],
  };
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function recordSet(
  values: {
    score: number;
    bullCount?: number;
    cricketMarks?: number;
    daysAgo?: number;
    gameType?: PracticeGame;
    condition?: Condition;
    machineType?: Exclude<DartMachine, 'BOTH'>;
  }[],
) {
  return values.map((value, index) =>
    buildRecord({
      id: `record-${index}`,
      date: daysAgo(value.daysAgo ?? index),
      score: value.score,
      bullCount: value.bullCount ?? 10,
      cricketMarks: value.cricketMarks ?? 20,
      gameType: value.gameType ?? 'COUNT-UP',
      condition: value.condition ?? 'normal',
      machineType: value.machineType ?? 'DARTSLIVE',
    }),
  );
}

import type {
  AnalysisPeriod,
  AnalysisSummary,
  Condition,
  DartMachine,
  GameTypeSummary,
  PracticeGame,
  PracticeRecord,
  TrendDirection,
  UserProfile,
  WeeklySummary,
} from '../types';

const gameTypes: PracticeGame[] = ['COUNT-UP', '01', 'CRICKET', 'OTHER'];
const conditions: Condition[] = ['good', 'normal', 'bad'];
const machineTypes: Exclude<DartMachine, 'BOTH'>[] = ['DARTSLIVE', 'PHOENIX'];

export function filterRecordsByPeriod(records: PracticeRecord[], period: AnalysisPeriod) {
  const sortedRecords = sortRecords(records);

  if (period === 'all') {
    return sortedRecords;
  }

  const startDate = new Date();
  const days = period === 'last7Days' ? 7 : period === 'last30Days' ? 30 : 90;
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  return sortedRecords.filter((record) => new Date(record.date) >= startDate);
}

export function calculateAnalysisSummary(
  records: PracticeRecord[],
  period: AnalysisPeriod,
  profile?: UserProfile | null,
): AnalysisSummary {
  const filteredRecords = filterRecordsByPeriod(records, period);
  const countUpRecords = filteredRecords.filter((record) => record.gameType === 'COUNT-UP');
  const latestRecord = filteredRecords[0] ?? null;
  const baseSummary: AnalysisSummary = {
    period,
    totalPracticeCount: filteredRecords.length,
    countUpAverage: averageOrNull(countUpRecords.map((record) => record.score)),
    bullAverage: averageOrNull(filteredRecords.map((record) => record.bullCount)),
    cricketMarksAverage: averageOrNull(filteredRecords.map((record) => record.cricketMarks)),
    bestScore: maxOrNull(filteredRecords.map((record) => record.score)),
    latestPracticeDate: latestRecord?.date ?? null,
    conditionCounts: countByValue(filteredRecords, conditions, (record) => record.condition),
    gameTypeCounts: countByValue(filteredRecords, gameTypes, (record) => record.gameType),
    machineTypeCounts: countByValue(filteredRecords, machineTypes, (record) => record.machineType),
    trendDirection: getTrendDirection(filteredRecords),
    improvementComments: [],
    recommendedPracticeMenuIds: [],
  };

  return {
    ...baseSummary,
    improvementComments: generateImprovementComments(baseSummary, profile),
    recommendedPracticeMenuIds: getRecommendedMenusFromAnalysis(baseSummary, profile),
  };
}

export function calculateGameTypeSummary(records: PracticeRecord[]): GameTypeSummary[] {
  return gameTypes.map((gameType) => {
    const gameRecords = records.filter((record) => record.gameType === gameType);

    return {
      gameType,
      count: gameRecords.length,
      averageScore: averageOrNull(gameRecords.map((record) => record.score)),
      averageBullCount: averageOrNull(gameRecords.map((record) => record.bullCount)),
      averageCricketMarks: averageOrNull(gameRecords.map((record) => record.cricketMarks)),
    };
  });
}

export function calculateWeeklySummary(records: PracticeRecord[]): WeeklySummary[] {
  const sortedAscending = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const summaries = new Map<string, PracticeRecord[]>();

  sortedAscending.forEach((record) => {
    const weekLabel = getWeekLabel(new Date(record.date));
    const weekRecords = summaries.get(weekLabel) ?? [];
    summaries.set(weekLabel, [...weekRecords, record]);
  });

  return Array.from(summaries.entries()).map(([weekLabel, weekRecords]) => ({
    weekLabel,
    practiceCount: weekRecords.length,
    averageScore: averageOrNull(weekRecords.map((record) => record.score)),
    averageBullCount: averageOrNull(weekRecords.map((record) => record.bullCount)),
  }));
}

export function getTrendDirection(records: PracticeRecord[]): TrendDirection {
  const sortedAscending = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (sortedAscending.length < 3) {
    return 'unknown';
  }

  const middleIndex = Math.floor(sortedAscending.length / 2);
  const previousAverage = averageOrNull(
    sortedAscending.slice(0, middleIndex).map((record) => record.score),
  );
  const recentAverage = averageOrNull(
    sortedAscending.slice(middleIndex).map((record) => record.score),
  );

  if (previousAverage === null || recentAverage === null) {
    return 'unknown';
  }

  const difference = recentAverage - previousAverage;

  if (Math.abs(difference) < 10) {
    return 'flat';
  }

  return difference > 0 ? 'up' : 'down';
}

export function generateImprovementComments(
  summary: AnalysisSummary,
  profile?: UserProfile | null,
) {
  const comments: string[] = [];
  const badConditionRate =
    summary.totalPracticeCount === 0 ? 0 : summary.conditionCounts.bad / summary.totalPracticeCount;

  if (summary.totalPracticeCount === 0) {
    return ['まだ記録がありません。まずは1回分の練習を保存して、傾向を見えるようにしましょう。'];
  }

  if (summary.period === 'last7Days' && summary.totalPracticeCount <= 1) {
    comments.push('まずは週3回の短時間練習を目標にして、練習量の土台を作りましょう。');
  }

  if (summary.countUpAverage !== null && summary.countUpAverage < 450) {
    comments.push('COUNT-UP平均が低めです。ブル練習とフォーム固定を優先しましょう。');
  }

  if (summary.bullAverage !== null && summary.bullAverage < 8) {
    comments.push('平均ブル数が少なめです。リリース安定とブル周辺へ集める練習を入れましょう。');
  }

  if (summary.gameTypeCounts.CRICKET <= 1) {
    comments.push('CRICKET記録が少なめです。15〜20のナンバー練習を追加すると弱点が見えます。');
  }

  if (badConditionRate >= 0.4) {
    comments.push('調子「悪い」が多めです。投げ込みよりも短いルーティン確認を優先しましょう。');
  }

  if (summary.trendDirection === 'up') {
    comments.push('スコア傾向は上向きです。現在の練習を継続し、メモも一緒に残しましょう。');
  }

  if (summary.trendDirection === 'down') {
    comments.push('スコア傾向は下向きです。練習内容を絞り、短時間で再現性を確認しましょう。');
  }

  if (profile?.mainProblems.includes('イップス気味')) {
    comments.push('イップス気味の悩みがあるため、違和感が強い日は低負荷メニューを選びましょう。');
  }

  return comments.length
    ? comments.slice(0, 5)
    : ['大きな偏りは少なめです。現在の練習を継続しながら記録を増やしましょう。'];
}

export function getRecommendedMenusFromAnalysis(
  summary: AnalysisSummary,
  profile?: UserProfile | null,
) {
  const recommendedIds: string[] = [];
  const add = (id: string) => {
    if (!recommendedIds.includes(id)) {
      recommendedIds.push(id);
    }
  };

  if (summary.totalPracticeCount <= 1) {
    add('beginner-routine-one-breath');
  }

  if ((summary.countUpAverage ?? 0) < 450 || (summary.bullAverage ?? 0) < 8) {
    add(
      profile?.level === 'advanced' ? 'advanced-bull-under-fatigue' : 'beginner-bull-count-up-12',
    );
    add('intermediate-release-line');
  }

  if (summary.gameTypeCounts.CRICKET <= 1) {
    add(
      profile?.level === 'advanced'
        ? 'advanced-number-pressure-20-19'
        : 'intermediate-cricket-count-up-map',
    );
  }

  if (summary.conditionCounts.bad >= Math.max(2, summary.conditionCounts.good)) {
    add('beginner-routine-one-breath');
    add('intermediate-mental-three-leg');
  }

  if (profile?.mainProblems.includes('01が苦手')) {
    add(profile.level === 'advanced' ? 'advanced-dartslive-01-arrange' : 'beginner-01-finish-note');
  }

  if (profile?.mainProblems.includes('イップス気味')) {
    add('intermediate-yips-low-load');
  }

  if (recommendedIds.length === 0) {
    add('advanced-form-reset-eight');
    add('intermediate-bull-01-switch');
  }

  return recommendedIds.slice(0, 3);
}

function countByValue<TRecord, TValue extends string>(
  records: TRecord[],
  values: TValue[],
  getValue: (record: TRecord) => TValue,
): Record<TValue, number> {
  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Record<TValue, number>;

  records.forEach((record) => {
    counts[getValue(record)] += 1;
  });

  return counts;
}

function averageOrNull(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maxOrNull(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function sortRecords(records: PracticeRecord[]) {
  return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getWeekLabel(date: Date) {
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(weekStart);
}

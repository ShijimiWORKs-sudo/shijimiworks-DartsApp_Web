import { matchesMachine, practiceMenus } from '../constants/practiceMenus';
import type { DartMachine, PracticeMenu, PracticeRecord, UserProfile } from '../types';

export type RecommendedPracticeMenu = {
  menu: PracticeMenu;
  reason: string;
};

export type PracticeRecommendation = {
  todayMenus: RecommendedPracticeMenu[];
  supportMenus: RecommendedPracticeMenu[];
  reasonText: string;
};

type RecommendationContext = {
  profile: UserProfile | null;
  machineType: DartMachine;
  weeklyCount: number;
  averageBullCount: number;
  hasFewCricketRecords: boolean;
  hasFewCountUpRecords: boolean;
};

export function recommendPracticeMenus(
  profile: UserProfile | null,
  records: PracticeRecord[],
): PracticeRecommendation {
  const context: RecommendationContext = {
    profile,
    machineType: profile?.machineType ?? 'BOTH',
    weeklyCount: getWeeklyPracticeCount(records),
    averageBullCount: average(records.map((record) => record.bullCount)),
    hasFewCricketRecords: records.filter((record) => record.gameType === 'CRICKET').length < 2,
    hasFewCountUpRecords: records.filter((record) => record.gameType === 'COUNT-UP').length < 2,
  };

  const scoredMenus = practiceMenus
    .map((menu) => ({
      menu,
      reason: buildMenuReason(menu, context),
      score: scorePracticeMenu(menu, context),
    }))
    .sort((a, b) => b.score - a.score || a.menu.durationMinutes - b.menu.durationMinutes);

  const todayMenus = uniqueRecommendations(scoredMenus.slice(0, 3));
  const supportMenus = uniqueRecommendations(
    scoredMenus
      .filter(
        (item) => !todayMenus.some((recommendation) => recommendation.menu.id === item.menu.id),
      )
      .slice(0, 3),
  );

  return {
    todayMenus,
    supportMenus,
    reasonText: buildReasonText(records, context),
  };
}

function scorePracticeMenu(menu: PracticeMenu, context: RecommendationContext) {
  let score = 0;

  if (context.profile?.level === menu.level) {
    score += 50;
  }

  if (matchesMachine(menu.machineTypes, context.machineType)) {
    score += 24;
  }

  const problemMatches =
    context.profile?.mainProblems.filter((problem) => menu.targetProblems.includes(problem))
      .length ?? 0;
  score += problemMatches * 18;

  if (
    context.averageBullCount > 0 &&
    context.averageBullCount < 8 &&
    menu.tags.includes('ブル練習')
  ) {
    score += 16;
  }

  if (context.hasFewCricketRecords && menu.gameTypes.includes('CRICKET')) {
    score += 12;
  }

  if (context.hasFewCountUpRecords && menu.gameTypes.includes('COUNT-UP')) {
    score += 8;
  }

  if (context.weeklyCount < 3 && menu.durationMinutes <= 12) {
    score += 12;
  }

  return score - menu.difficulty;
}

function buildMenuReason(menu: PracticeMenu, context: RecommendationContext) {
  const matchedProblem = context.profile?.mainProblems.find((problem) =>
    menu.targetProblems.includes(problem),
  );

  if (matchedProblem) {
    return `${matchedProblem}に対応するため、${menu.purpose}`;
  }

  if (
    context.averageBullCount > 0 &&
    context.averageBullCount < 8 &&
    menu.tags.includes('ブル練習')
  ) {
    return '直近のブル数が少ないため、COUNT-UPでブル率を確認します。';
  }

  if (context.hasFewCricketRecords && menu.gameTypes.includes('CRICKET')) {
    return 'CRICKETの記録が少ないため、ナンバー別の精度確認を優先します。';
  }

  if (context.weeklyCount < 3 && menu.durationMinutes <= 12) {
    return '今週の練習回数が少ないため、短時間で終えられるメニューです。';
  }

  if (context.profile?.level === menu.level) {
    return `${menu.title}は現在レベルに合った確認メニューです。`;
  }

  return '直近の記録バランスを補うための候補です。';
}

function buildReasonText(records: PracticeRecord[], context: RecommendationContext) {
  if (records.length === 0) {
    return 'まだ記録が少ないため、短時間で結果と感覚を残しやすい練習を優先します。';
  }

  if (context.averageBullCount < 8) {
    return 'ブル数が少なめなので、まずはCOUNT-UPでブル率を安定させる練習を優先します。';
  }

  if (context.hasFewCricketRecords) {
    return 'クリケット記録が少ないため、15〜20のナンバー練習を追加します。';
  }

  if (context.weeklyCount < 3) {
    return '今週の練習回数が少ないため、短時間で完了できるメニューを優先します。';
  }

  return '直近の記録バランスを見て、得点練習とフォーム確認を組み合わせます。';
}

function uniqueRecommendations(
  recommendations: { menu: PracticeMenu; reason: string }[],
): RecommendedPracticeMenu[] {
  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    if (seen.has(recommendation.menu.id)) {
      return false;
    }

    seen.add(recommendation.menu.id);
    return true;
  });
}

function getWeeklyPracticeCount(records: PracticeRecord[]) {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return records.filter((record) => new Date(record.date) >= start).length;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

import { consultAdvice } from '../constants/consultAdvice';
import { getKnowledgeArticlesByAdviceIds, knowledgeBase } from '../constants/knowledgeBase';
import { getPracticeMenuById } from '../constants/practiceMenus';
import type {
  ConsultAdvice,
  ConsultCategory,
  ConsultSeverity,
  KnowledgeArticle,
  PracticeMenu,
  PracticeRecord,
  UserProfile,
} from '../types';

export type ConsultAdviceResult = {
  mainAdvice: ConsultAdvice[];
  causes: string[];
  checkPoints: string[];
  recommendedPracticeMenus: PracticeMenu[];
  relatedArticles: KnowledgeArticle[];
  cautionText: string;
  nextAction: string;
};

export function generateConsultAdvice(input: {
  category: ConsultCategory;
  userText: string;
  severity: ConsultSeverity;
  profile: UserProfile | null;
  practiceRecords: PracticeRecord[];
}): ConsultAdviceResult {
  const normalizedText = input.userText.toLowerCase();
  const recordInsight = buildRecordInsight(input.practiceRecords);
  const scoredAdvice = consultAdvice
    .map((advice) => ({
      advice,
      score: scoreAdvice(advice, normalizedText, input.category, input.profile, input.severity),
    }))
    .sort((a, b) => b.score - a.score);
  const mainAdvice = scoredAdvice.slice(0, 3).map((item) => item.advice);
  const adviceIds = mainAdvice.map((advice) => advice.id);
  const recommendedPracticeMenus = uniquePracticeMenus(
    mainAdvice.flatMap((advice) =>
      advice.recommendedPracticeMenuIds
        .map((practiceMenuId) => getPracticeMenuById(practiceMenuId))
        .filter((menu): menu is PracticeMenu => Boolean(menu)),
    ),
  ).slice(0, 3);
  const relatedArticles = uniqueArticles([
    ...getKnowledgeArticlesByAdviceIds(adviceIds),
    ...knowledgeBase.filter((article) =>
      mainAdvice.some((advice) => advice.relatedKnowledgeIds.includes(article.id)),
    ),
  ]).slice(0, 3);
  const cautionText =
    mainAdvice.find((advice) => advice.cautionText)?.cautionText ??
    (input.category === 'yips'
      ? '違和感が強い場合は無理に投げ込まず、休養や専門家相談も選択肢にしてください。'
      : '痛みや強い不安がある場合は、練習量を下げて無理をしないでください。');

  return {
    mainAdvice,
    causes: uniqueStrings([
      ...mainAdvice.flatMap((advice) => advice.possibleCauses),
      ...recordInsight.causes,
    ]).slice(0, 6),
    checkPoints: uniqueStrings([
      ...mainAdvice.flatMap((advice) => advice.checkPoints),
      ...recordInsight.checkPoints,
    ]).slice(0, 6),
    recommendedPracticeMenus,
    relatedArticles,
    cautionText,
    nextAction: buildNextAction(input.category, recommendedPracticeMenus, recordInsight.comment),
  };
}

function scoreAdvice(
  advice: ConsultAdvice,
  normalizedText: string,
  category: ConsultCategory,
  profile: UserProfile | null,
  severity: ConsultSeverity,
) {
  let score = advice.category === category ? 40 : 0;
  const keywordMatches = advice.problemKeywords.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase()),
  ).length;
  score += keywordMatches * 18;
  const profileMatches =
    profile?.mainProblems.filter((problem) =>
      advice.problemKeywords.some(
        (keyword) => problem.includes(keyword) || keyword.includes(problem),
      ),
    ).length ?? 0;
  score += profileMatches * 10;

  if (advice.severity === severity) {
    score += 8;
  }

  if (category === 'other' && keywordMatches > 0) {
    score += 12;
  }

  return score;
}

function buildRecordInsight(records: PracticeRecord[]) {
  const recentRecords = records.slice(0, 5);
  const averageBull = average(recentRecords.map((record) => record.bullCount));
  const countUpRecords = records.filter((record) => record.gameType === 'COUNT-UP');
  const countUpAverage = average(countUpRecords.map((record) => record.score));
  const cricketCount = records.filter((record) => record.gameType === 'CRICKET').length;
  const badConditionStreak = recentRecords
    .slice(0, 3)
    .every((record) => record.condition === 'bad');
  const causes: string[] = [];
  const checkPoints: string[] = [];

  if (records.length < 3) {
    causes.push('練習記録が少なく、傾向がまだ見えにくい');
    checkPoints.push('週3回の短時間記録で傾向を増やす');
  }

  if (averageBull > 0 && averageBull < 8) {
    causes.push('直近のブル数が少なめ');
    checkPoints.push('COUNT-UPでブル数と外れ方を一緒に残す');
  }

  if (countUpAverage > 0 && countUpAverage < 450) {
    causes.push('COUNT-UP平均が低めで狙いが散っている可能性');
    checkPoints.push('スコアよりブル周辺への集まり方を見る');
  }

  if (cricketCount < 2) {
    causes.push('CRICKET記録が少なくナンバー別の傾向が不足');
    checkPoints.push('15〜20のマーク数を分けて記録する');
  }

  if (badConditionStreak) {
    causes.push('調子が悪い記録が続いている');
    checkPoints.push('投げ込み量を増やさず低負荷メニューへ切り替える');
  }

  return {
    causes,
    checkPoints,
    comment:
      causes[0] ?? '今日は回答に出た確認ポイントを一つだけ選び、短いメニューで記録しましょう。',
  };
}

function buildNextAction(
  category: ConsultCategory,
  recommendedPracticeMenus: PracticeMenu[],
  recordComment: string,
) {
  const firstMenu = recommendedPracticeMenus[0];

  if (category === 'yips') {
    return firstMenu
      ? `${firstMenu.title}を低負荷で行い、違和感が強い場合は中止してください。`
      : '低負荷で確認し、違和感が強い場合は休む選択を残してください。';
  }

  return firstMenu
    ? `${firstMenu.title}を1セット行い、確認ポイントをメモしてください。`
    : recordComment;
}

function uniquePracticeMenus(menus: PracticeMenu[]) {
  const seen = new Set<string>();
  return menus.filter((menu) => {
    if (seen.has(menu.id)) {
      return false;
    }

    seen.add(menu.id);
    return true;
  });
}

function uniqueArticles(articles: KnowledgeArticle[]) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.id)) {
      return false;
    }

    seen.add(article.id);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

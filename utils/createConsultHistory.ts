import type { ConsultCategory, ConsultHistory, ConsultSeverity } from '../types';
import type { ConsultAdviceResult } from './generateConsultAdvice';

type CreateConsultHistoryInput = {
  category: ConsultCategory;
  severity: ConsultSeverity;
  userText: string;
  result: ConsultAdviceResult;
  memo?: string;
};

export function createConsultHistory({
  category,
  severity,
  userText,
  result,
  memo,
}: CreateConsultHistoryInput): ConsultHistory {
  return {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    category,
    severity,
    userText: userText.trim(),
    mainAdvice: result.mainAdvice[0]?.title ?? '相談結果',
    causes: result.causes,
    checkPoints: result.checkPoints,
    recommendedPracticeMenuIds: result.recommendedPracticeMenus.map((menu) => menu.id),
    relatedKnowledgeIds: result.relatedArticles.map((article) => article.id),
    cautionText: result.cautionText,
    nextAction: result.nextAction,
    memo,
  };
}

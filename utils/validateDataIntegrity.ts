import { consultAdvice } from '../constants/consultAdvice';
import { knowledgeBase } from '../constants/knowledgeBase';
import { practiceMenus } from '../constants/practiceMenus';

export type DataIntegrityResult = {
  isValid: boolean;
  errors: string[];
};

export function validateDataIntegrity(): DataIntegrityResult {
  const errors: string[] = [];
  const practiceMenuIds = new Set(practiceMenus.map((menu) => menu.id));
  const adviceIds = new Set(consultAdvice.map((advice) => advice.id));
  const knowledgeIds = new Set(knowledgeBase.map((article) => article.id));

  errors.push(
    ...findDuplicateErrors(
      'practiceMenus',
      practiceMenus.map((menu) => menu.id),
    ),
  );
  errors.push(
    ...findDuplicateErrors(
      'consultAdvice',
      consultAdvice.map((advice) => advice.id),
    ),
  );
  errors.push(
    ...findDuplicateErrors(
      'knowledgeBase',
      knowledgeBase.map((article) => article.id),
    ),
  );

  consultAdvice.forEach((advice) => {
    advice.recommendedPracticeMenuIds.forEach((practiceMenuId) => {
      if (!practiceMenuIds.has(practiceMenuId)) {
        errors.push(`${advice.id} references missing practiceMenu ${practiceMenuId}`);
      }
    });

    advice.relatedKnowledgeIds.forEach((knowledgeId) => {
      if (!knowledgeIds.has(knowledgeId)) {
        errors.push(`${advice.id} references missing knowledgeBase ${knowledgeId}`);
      }
    });
  });

  knowledgeBase.forEach((article) => {
    article.relatedPracticeMenuIds.forEach((practiceMenuId) => {
      if (!practiceMenuIds.has(practiceMenuId)) {
        errors.push(`${article.id} references missing practiceMenu ${practiceMenuId}`);
      }
    });

    article.relatedAdviceIds.forEach((adviceId) => {
      if (!adviceIds.has(adviceId)) {
        errors.push(`${article.id} references missing consultAdvice ${adviceId}`);
      }
    });
  });

  practiceMenus.forEach((menu) => {
    menu.relatedKnowledgeIds?.forEach((knowledgeId) => {
      if (!knowledgeIds.has(knowledgeId)) {
        errors.push(`${menu.id} references missing knowledgeBase ${knowledgeId}`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function findDuplicateErrors(sourceName: string, ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  ids.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
    }

    seen.add(id);
  });

  return Array.from(duplicates).map((id) => `${sourceName} has duplicate id ${id}`);
}

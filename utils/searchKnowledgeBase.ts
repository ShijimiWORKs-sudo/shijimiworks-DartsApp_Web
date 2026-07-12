import { knowledgeBase } from '../constants/knowledgeBase';
import type { KnowledgeArticle } from '../types';

export type RelatedPracticeFilter = 'all' | 'withRelatedPractice' | 'withoutRelatedPractice';

export type KnowledgeSearchFilters = {
  query: string;
  category: string;
  tag: string | null;
  relatedPractice: RelatedPracticeFilter;
};

export const defaultKnowledgeSearchFilters: KnowledgeSearchFilters = {
  query: '',
  category: 'all',
  tag: null,
  relatedPractice: 'all',
};

export function searchKnowledgeBase(
  filters: KnowledgeSearchFilters,
  articles: KnowledgeArticle[] = knowledgeBase,
) {
  const query = filters.query.trim().toLowerCase();

  return articles.filter((article) => {
    const searchTarget = [
      article.title,
      article.summary,
      article.body,
      article.category,
      ...article.tags,
    ]
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || searchTarget.includes(query);
    const matchesCategory = filters.category === 'all' || article.category === filters.category;
    const matchesTag = !filters.tag || article.tags.includes(filters.tag);
    const hasRelatedPractice = article.relatedPracticeMenuIds.length > 0;
    const matchesRelatedPractice =
      filters.relatedPractice === 'all' ||
      (filters.relatedPractice === 'withRelatedPractice' && hasRelatedPractice) ||
      (filters.relatedPractice === 'withoutRelatedPractice' && !hasRelatedPractice);

    return matchesQuery && matchesCategory && matchesTag && matchesRelatedPractice;
  });
}

export function getKnowledgeTags(articles: KnowledgeArticle[] = knowledgeBase) {
  return Array.from(new Set(articles.flatMap((article) => article.tags))).sort();
}

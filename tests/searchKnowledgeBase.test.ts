import assert from 'node:assert/strict';
import test from 'node:test';

import { knowledgeBase } from '../constants/knowledgeBase';
import {
  defaultKnowledgeSearchFilters,
  getKnowledgeTags,
  searchKnowledgeBase,
} from '../utils/searchKnowledgeBase';

test('searchKnowledgeBase searches title, summary, body, tags and category', () => {
  const results = searchKnowledgeBase({
    ...defaultKnowledgeSearchFilters,
    query: 'リリース',
  });

  assert.ok(results.length > 0);
  assert.ok(
    results.some((article) =>
      [article.title, article.summary, article.body, article.category, ...article.tags]
        .join(' ')
        .includes('リリース'),
    ),
  );
});

test('searchKnowledgeBase filters by category', () => {
  const results = searchKnowledgeBase({
    ...defaultKnowledgeSearchFilters,
    category: 'yips',
  });

  assert.ok(results.length > 0);
  assert.ok(results.every((article) => article.category === 'yips'));
});

test('searchKnowledgeBase filters by tag', () => {
  const tag = getKnowledgeTags().find((item) => item === 'ブル練習') ?? 'ブル練習';
  const results = searchKnowledgeBase({
    ...defaultKnowledgeSearchFilters,
    tag,
  });

  assert.ok(results.length > 0);
  assert.ok(results.every((article) => article.tags.includes(tag)));
});

test('searchKnowledgeBase filters related practice existence', () => {
  const withRelatedPractice = searchKnowledgeBase({
    ...defaultKnowledgeSearchFilters,
    relatedPractice: 'withRelatedPractice',
  });
  const withoutRelatedPractice = searchKnowledgeBase({
    ...defaultKnowledgeSearchFilters,
    relatedPractice: 'withoutRelatedPractice',
  });

  assert.ok(withRelatedPractice.length > 0);
  assert.ok(withRelatedPractice.every((article) => article.relatedPracticeMenuIds.length > 0));
  assert.ok(withoutRelatedPractice.every((article) => article.relatedPracticeMenuIds.length === 0));
  assert.equal(withRelatedPractice.length + withoutRelatedPractice.length, knowledgeBase.length);
});

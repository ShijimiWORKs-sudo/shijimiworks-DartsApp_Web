import assert from 'node:assert/strict';
import test from 'node:test';

import { generateConsultAdvice } from '../utils/generateConsultAdvice';
import { buildProfile } from './testHelpers';

test('generateConsultAdvice prioritizes matching category', () => {
  const result = generateConsultAdvice({
    category: 'release',
    userText: '右に抜ける',
    severity: 'normal',
    profile: null,
    practiceRecords: [],
  });

  assert.equal(result.mainAdvice[0]?.category, 'release');
});

test('generateConsultAdvice changes candidates with keyword matches', () => {
  const result = generateConsultAdvice({
    category: 'other',
    userText: 'ブルに入らない',
    severity: 'normal',
    profile: null,
    practiceRecords: [],
  });

  assert.ok(result.mainAdvice.some((advice) => advice.id === 'aim-001'));
});

test('generateConsultAdvice reflects profile main problems', () => {
  const result = generateConsultAdvice({
    category: 'other',
    userText: '',
    severity: 'normal',
    profile: buildProfile({ mainProblems: ['クリケットが苦手'] }),
    practiceRecords: [],
  });

  assert.ok(result.mainAdvice.some((advice) => advice.problemKeywords.includes('クリケット')));
});

test('generateConsultAdvice returns up to three related practice menus', () => {
  const result = generateConsultAdvice({
    category: 'stance',
    userText: '足がずれる',
    severity: 'normal',
    profile: null,
    practiceRecords: [],
  });

  assert.ok(result.recommendedPracticeMenus.length > 0);
  assert.ok(result.recommendedPracticeMenus.length <= 3);
});

test('generateConsultAdvice returns up to three related articles', () => {
  const result = generateConsultAdvice({
    category: 'grip',
    userText: '指に引っかかる',
    severity: 'normal',
    profile: null,
    practiceRecords: [],
  });

  assert.ok(result.relatedArticles.length > 0);
  assert.ok(result.relatedArticles.length <= 3);
});

test('generateConsultAdvice returns caution text for yips category', () => {
  const result = generateConsultAdvice({
    category: 'yips',
    userText: '投げ出しが怖い',
    severity: 'serious',
    profile: null,
    practiceRecords: [],
  });

  assert.ok(result.cautionText.includes('無理') || result.cautionText.includes('休'));
});

test('generateConsultAdvice handles empty text without crashing', () => {
  const result = generateConsultAdvice({
    category: 'practicePlan',
    userText: '',
    severity: 'light',
    profile: null,
    practiceRecords: [],
  });

  assert.ok(result.mainAdvice.length > 0);
  assert.ok(result.causes.length > 0);
});

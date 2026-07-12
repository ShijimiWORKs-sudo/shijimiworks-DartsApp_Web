import assert from 'node:assert/strict';
import test from 'node:test';

import { matchesMachine } from '../constants/practiceMenus';
import { recommendPracticeMenus } from '../utils/recommendPracticeMenus';
import { buildProfile, buildRecord } from './testHelpers';

test('recommendPracticeMenus prioritizes profile level', () => {
  const profile = buildProfile({ level: 'advanced', mainProblems: ['フォームが安定しない'] });
  const result = recommendPracticeMenus(profile, []);

  assert.ok(result.todayMenus.some((recommendation) => recommendation.menu.level === 'advanced'));
});

test('recommendPracticeMenus prioritizes matching machine type', () => {
  const profile = buildProfile({ machineType: 'PHOENIX', mainProblems: ['クリケットが苦手'] });
  const result = recommendPracticeMenus(profile, []);

  assert.ok(
    result.todayMenus.every((recommendation) =>
      matchesMachine(recommendation.menu.machineTypes, profile.machineType),
    ),
  );
});

test('recommendPracticeMenus scores matching main problems', () => {
  const profile = buildProfile({ mainProblems: ['クリケットが苦手'] });
  const result = recommendPracticeMenus(profile, []);

  assert.ok(
    result.todayMenus.some((recommendation) =>
      recommendation.menu.targetProblems.includes('クリケットが苦手'),
    ),
  );
});

test('recommendPracticeMenus favors short menus when practice count is low', () => {
  const profile = buildProfile({ level: 'beginner', mainProblems: ['練習方法が分からない'] });
  const result = recommendPracticeMenus(profile, []);

  assert.ok(result.todayMenus.some((recommendation) => recommendation.menu.durationMinutes <= 12));
});

test('recommendPracticeMenus returns three today menus and three support menus', () => {
  const profile = buildProfile();
  const result = recommendPracticeMenus(profile, [
    buildRecord({ id: 'count-up', gameType: 'COUNT-UP' }),
    buildRecord({ id: 'cricket', gameType: 'CRICKET' }),
  ]);

  assert.equal(result.todayMenus.length, 3);
  assert.equal(result.supportMenus.length, 3);
});

test('recommendPracticeMenus returns non-empty reasons', () => {
  const result = recommendPracticeMenus(buildProfile(), []);

  assert.notEqual(result.reasonText.trim(), '');
  assert.ok(result.todayMenus.every((recommendation) => recommendation.reason.trim().length > 0));
});

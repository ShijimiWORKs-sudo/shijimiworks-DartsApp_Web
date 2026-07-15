import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath: string): string {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('desktop Web Home excludes Support-first content', () => {
  const desktopHome = readText('components/web/DartsAppDesktopHome.tsx');

  assert.doesNotMatch(desktopHome, /今日のおすすめ練習/);
  assert.doesNotMatch(desktopHome, /フォーム相談/);
  assert.doesNotMatch(desktopHome, /資料ライブラリ/);
  assert.doesNotMatch(desktopHome, /今週の練習回数/);
  assert.doesNotMatch(desktopHome, /現在レーティング|RT \${|machineType|DARTSLIVE|PHOENIX/);
  assert.doesNotMatch(desktopHome, /logo\.png|require\(.+logo/);
});

test('desktop Web Home prioritizes active game before Account', () => {
  const desktopHome = readText('components/web/DartsAppDesktopHome.tsx');

  assert.match(desktopHome, /新しいゲームを始める/);
  assert.match(desktopHome, /再開する/);
  assert.match(desktopHome, /DartsApp Rating状態/);
  assert.match(desktopHome, /最近のゲーム結果/);
  assert.ok(desktopHome.indexOf('activeGame') < desktopHome.indexOf('AccountOverviewCard'));
});

test('desktop Web Home keeps Account compact and DartsApp Rating scoped', () => {
  const desktopHome = readText('components/web/DartsAppDesktopHome.tsx');

  assert.match(desktopHome, /表示名/);
  assert.match(desktopHome, /状態/);
  assert.match(desktopHome, /Eligible MATCH/);
  assert.match(desktopHome, /単独Rating/);
  assert.doesNotMatch(desktopHome, /emailNormalized|Common Account ID|ユーザーID/);
});

test('mobile and Expo Go keep the legacy Support Home branch', () => {
  const home = readText('app/home.tsx');

  assert.match(home, /if \(isDesktopWeb\)/);
  assert.match(home, /DartsAppDesktopHome/);
  assert.match(home, /今日のおすすめ練習/);
  assert.match(home, /フォーム相談/);
  assert.match(home, /資料ライブラリ/);
  assert.match(home, /logo\.png/);
});

test('Support routes are retained for direct access', () => {
  for (const routeFile of [
    'app/practice.tsx',
    'app/records.tsx',
    'app/analysis.tsx',
    'app/consult.tsx',
    'app/library.tsx',
    'app/favorites.tsx',
  ]) {
    assert.equal(existsSync(path.join(rootDir, routeFile)), true, routeFile);
  }
});

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath: string): string {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('Rating detail and history routes are present', () => {
  assert.equal(existsSync(path.join(rootDir, 'app/account/rating/index.tsx')), true);
  assert.equal(existsSync(path.join(rootDir, 'app/account/rating/history.tsx')), true);
  assert.equal(existsSync(path.join(rootDir, 'hooks/useActiveAccountOverview.ts')), true);

  const detail = readText('app/account/rating/index.tsx');
  const history = readText('app/account/rating/history.tsx');

  assert.match(detail, /DartsApp Rating/);
  assert.match(detail, /Rating履歴を見る/);
  assert.match(detail, /getEligibleMatchProgress/);
  assert.match(detail, /未確定/);
  assert.match(history, /Rating履歴/);
  assert.match(history, /listSnapshots/);
  assert.match(history, /Rating履歴を読み込んでいます。/);
  assert.match(history, /Rating履歴はまだありません。/);
});

test('Rating detail links are available from Home, Game Hub and Account screens', () => {
  const desktopHome = readText('components/web/DartsAppDesktopHome.tsx');
  const ratingStatusCard = readText('components/account/RatingStatusCard.tsx');
  const profile = readText('app/account/profile.tsx');

  assert.match(desktopHome, /Rating詳細を見る/);
  assert.match(desktopHome, /\/account\/rating/);
  assert.match(ratingStatusCard, /Rating詳細を見る/);
  assert.match(ratingStatusCard, /Rating履歴を見る/);
  assert.match(profile, /RatingStatusCard/);
});

test('Home, Account profile and Rating routes share active Account resolution', () => {
  const hook = readText('hooks/useActiveAccountOverview.ts');
  assert.match(hook, /resolveAccountBootstrap/);
  assert.match(hook, /setActiveAccountId/);
  assert.match(hook, /processPendingRating/);

  for (const routeFile of [
    'app/home.tsx',
    'app/account/profile.tsx',
    'app/account/rating-status.tsx',
    'app/account/rating/index.tsx',
    'app/account/rating/history.tsx',
  ]) {
    const source = readText(routeFile);
    assert.match(source, /useActiveAccountOverview/, routeFile);
  }

  const ratingDetail = readText('app/account/rating/index.tsx');
  const ratingHistory = readText('app/account/rating/history.tsx');
  assert.doesNotMatch(ratingDetail, /getActiveAccount\(activeAccountId\)/);
  assert.doesNotMatch(ratingHistory, /getActiveAccount\(activeAccountId\)/);
});

test('game result screens use source Rating results instead of only profile state', () => {
  for (const routeFile of [
    'app/game/01/[gameId]/result.tsx',
    'app/game/cricket/[gameId]/result.tsx',
    'app/game/match/[matchId]/result.tsx',
  ]) {
    const source = readText(routeFile);
    assert.match(source, /RatingResultCard/, routeFile);
    assert.match(source, /getRatingResultForSource/, routeFile);
  }

  const countUp = readText('app/game/count-up/[gameId]/result.tsx');
  assert.match(countUp, /RatingResultCard/);
  assert.match(countUp, /countUp/);
  const matchResult = readText('app/game/match/[matchId]/result.tsx');
  assert.match(matchResult, /01 PPD/);
  assert.match(matchResult, /01 3DA/);
  assert.match(matchResult, /zeroOneThreeDartAverageMilli/);
  assert.match(matchResult, /ratingResult\.status === 'applied'/);
  assert.match(
    readText('components/game/RatingResultCard.tsx'),
    /COUNT-UPはRating計算には使用されません/,
  );
});

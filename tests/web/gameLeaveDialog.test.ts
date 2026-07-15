import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const playScreens = {
  countUp: readAppFile('app/game/count-up/[gameId]/index.tsx'),
  zeroOne: readAppFile('app/game/01/[gameId]/index.tsx'),
  cricket: readAppFile('app/game/cricket/[gameId]/index.tsx'),
  match: readAppFile('app/game/match/[matchId]/index.tsx'),
};
const leaveDialog = readAppFile('components/game/GameLeaveDialog.tsx');
const webHistoryGuard = readAppFile('components/game/useGameLeaveWebHistoryGuard.ts');
const gameHub = readAppFile('app/game/index.tsx');

test('GameLeaveDialog provides cross-platform leave and abort confirmation in one Modal', () => {
  assert.match(leaveDialog, /<Modal/);
  assert.match(leaveDialog, /onRequestClose=\{onContinue\}/);
  assert.match(leaveDialog, /ゲームを離れますか？/);
  assert.match(leaveDialog, /一時停止してゲームハブへ戻る/);
  assert.match(leaveDialog, /ゲームを続ける/);
  assert.match(leaveDialog, /途中終了する/);
  assert.match(leaveDialog, /ゲームを途中終了しますか？/);
  assert.match(leaveDialog, /途中終了を確定/);
  assert.match(leaveDialog, /戻る/);
  assert.match(leaveDialog, /disabled=\{isProcessing\}/);
});

test('play screens render GameLeaveDialog and no longer use Alert for leave or abort prompts', () => {
  Object.values(playScreens).forEach((source) => {
    assert.match(source, /<GameLeaveDialog/);
    assert.match(source, /useGameLeaveWebHistoryGuard/);
    assert.match(source, /promptLeave/);
    assert.match(source, /handleConfirmAbort/);
    assert.match(source, /openLeaveDialog\('leave'\)/);
    assert.match(source, /openLeaveDialog\('abort'\)/);
    assert.doesNotMatch(source, /Alert\.alert\([^)]*離れますか/s);
    assert.doesNotMatch(source, /Alert\.alert\([^)]*中断しますか/s);
    assert.doesNotMatch(source, /Alert\.alert\([^)]*途中終了しますか/s);
  });
});

test('web browser back uses a history guard and opens the same leave dialog', () => {
  assert.match(webHistoryGuard, /Platform\.OS !== 'web'/);
  assert.match(webHistoryGuard, /window\.history\.pushState/);
  assert.match(webHistoryGuard, /window\.addEventListener\('popstate', handlePopState\)/);
  assert.match(webHistoryGuard, /onRequestLeaveRef\.current\(\)/);
  Object.values(playScreens).forEach((source) => {
    assert.match(
      source,
      /useGameLeaveWebHistoryGuard\(\{\s*isActive: .*?\.status === 'in_progress',\s*allowNavigationRef,\s*onRequestLeave: promptLeave,\s*\}\);/s,
    );
  });
});

test('pause and abort handlers clear redo state, await persistence, and replace to game hub', () => {
  assert.match(
    playScreens.countUp,
    /clearRedoSession\(\);\s*await services\.countUp\.pauseGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.countUp,
    /clearRedoSession\(\);\s*await services\.countUp\.abortGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.zeroOne,
    /clearRedoSession\(\);\s*await services\.zeroOne\.pauseGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.zeroOne,
    /clearRedoSession\(\);\s*await services\.zeroOne\.abortGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.cricket,
    /clearRedoSession\(\);\s*await services\.cricket\.pauseGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.cricket,
    /clearRedoSession\(\);\s*await services\.cricket\.abortGame\(game\.gameId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.match,
    /clearRedoSession\(\);\s*await services\.match\.pauseMatch\(match\.matchId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
  assert.match(
    playScreens.match,
    /clearRedoSession\(\);\s*await services\.match\.abortMatch\(match\.matchId\);\s*allowNavigationRef\.current = true;\s*setLeaveDialogVisible\(false\);\s*router\.replace\('\/game'\);/s,
  );
});

test('leave dialog failures stay on the play screen and show a generic retryable message', () => {
  Object.values(playScreens).forEach((source) => {
    assert.match(source, /const genericLeaveError =/);
    assert.match(source, /setLeaveDialogError\(genericLeaveError\)/);
    assert.match(source, /console\.warn/);
    assert.match(source, /setLeaveDialogVisible\(false\)/);
    assert.doesNotMatch(source, /setLeaveDialogError\(getErrorMessage/);
  });
  assert.match(leaveDialog, /errorMessage/);
});

test('leave and abort actions are guarded against double execution and beforeRemove opens the dialog', () => {
  Object.values(playScreens).forEach((source) => {
    assert.match(source, /const leaveProcessingRef = useRef\(false\);/);
    assert.match(source, /leaveProcessingRef\.current/);
    assert.match(source, /disabled=\{isBusy \|\| isLeaveProcessing\}/);
    assert.match(source, /navigation\.addListener\('beforeRemove'/);
    assert.match(source, /event\.preventDefault\(\);\s*promptLeave\(\);/s);
  });
});

test('Game Hub active session card avoids nested web buttons', () => {
  assert.doesNotMatch(
    gameHub,
    /<Pressable[\s\S]*?\{activeGame[\s\S]*?<AppButton[\s\S]*?ゲームへ戻る/s,
  );
  assert.match(gameHub, /<Card muted>[\s\S]*?<AppButton/s);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const settingsFiles = {
  countUp: readAppFile('app/game/count-up/settings.tsx'),
  cricket: readAppFile('app/game/cricket/settings.tsx'),
  match: readAppFile('app/game/match/settings.tsx'),
  zeroOne: readAppFile('app/game/01/settings.tsx'),
};
const conflictDialog = readAppFile('components/game/ActiveSessionConflictDialog.tsx');

test('settings screens use the shared active session conflict dialog instead of Alert buttons', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /ActiveSessionConflictDialog/);
    assert.doesNotMatch(source, /Alert\.alert/);
    assert.match(source, /services\.activeSession\.findActiveSession\(\)/);
  });
});

test('paused COUNT-UP during 01 start shows conflict flow before creating the 01 game', () => {
  const source = settingsFiles.zeroOne;
  assert.match(
    source,
    /const activeSession = await services\.activeSession\.findActiveSession\(\);/,
  );
  assert.match(source, /setConflictSession\(activeSession\);/);
  assert.match(source, /await startZeroOne\(\);/);
  assert.match(source, /activeLabel=\{conflictSession\?\.label \?\? '01 GAME'\}/);
});

test('resume selection navigates to the active session route', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /router\.replace\(conflictSession\.route\)/);
  });
});

test('abort and start aborts the active session before starting the selected game', () => {
  assert.match(
    settingsFiles.countUp,
    /await services\.activeSession\.abortActiveSession\(conflictSession\);\s*setConflictSession\(null\);\s*await startCountUp\(\);/s,
  );
  assert.match(
    settingsFiles.zeroOne,
    /await services\.activeSession\.abortActiveSession\(conflictSession\);\s*setConflictSession\(null\);\s*await startZeroOne\(\);/s,
  );
  assert.match(
    settingsFiles.cricket,
    /await services\.activeSession\.abortActiveSession\(conflictSession\);\s*setConflictSession\(null\);\s*await startCricket\(\);/s,
  );
  assert.match(
    settingsFiles.match,
    /await services\.activeSession\.abortActiveSession\(conflictSession\);\s*setConflictSession\(null\);\s*await startMatch\(\);/s,
  );
});

test('cancel keeps the settings screen by only closing the conflict dialog', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /onCancel=\{\(\) => setConflictSession\(null\)\}/);
  });
});

test('generic start errors are rendered on settings screens without exposing raw errors', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /const genericStartError =/);
    assert.match(source, /setStartError\(genericStartError\)/);
    assert.match(source, /console\.warn/);
    assert.doesNotMatch(source, /getErrorMessage/);
  });
});

test('double-click protection disables start and conflict actions while processing', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /disabled=\{!isAvailable \|\| isStarting\}/);
    assert.match(source, /isProcessing=\{isConflictProcessing\}/);
  });
  assert.match(conflictDialog, /disabled=\{isProcessing\}/);
});

test('MATCH guest creation happens only after active session preflight passes', () => {
  const source = settingsFiles.match;
  const handleStartIndex = source.indexOf('const handleStart');
  const preflightIndex = source.indexOf('findActiveSession', handleStartIndex);
  const startMatchCallIndex = source.indexOf('await startMatch()', handleStartIndex);
  const createGuestIndex = source.indexOf('players.createGuest');

  assert(preflightIndex > handleStartIndex);
  assert(startMatchCallIndex > preflightIndex);
  assert(createGuestIndex > source.indexOf('const startMatch'));
});

test('abort failure path keeps settings values and does not start another game', () => {
  Object.values(settingsFiles).forEach((source) => {
    assert.match(source, /catch \(error\) \{/);
    assert.match(source, /setStartError\(genericStartError\)/);
    assert.match(
      source,
      /finally \{\s*setIsConflictProcessing\(false\);\s*setIsStarting\(false\);/s,
    );
  });
});

test('Expo Go uses the same modal component for conflict confirmation', () => {
  assert.match(conflictDialog, /<Modal/);
  assert.match(conflictDialog, /onRequestClose=\{onCancel\}/);
  assert.match(conflictDialog, /途中終了して新しいゲームを開始/);
});

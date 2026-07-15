import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readAppFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const zeroOneSettings = readAppFile('app/game/01/settings.tsx');
const cricketSettings = readAppFile('app/game/cricket/settings.tsx');
const matchSettings = readAppFile('app/game/match/settings.tsx');
const shell = readAppFile('components/web/WebGameSettingsShell.tsx');

test('WebGameSettingsShell exposes explicit settings and summary columns', () => {
  assert.match(shell, /testID="web-game-settings-shell"/);
  assert.match(shell, /testID="web-game-settings-column"/);
  assert.match(shell, /testID="web-game-summary-column"/);
  assert.match(shell, /styles\.desktopTwoColumn/);
  assert.match(shell, /styles\.desktopSettingsColumn/);
  assert.match(shell, /styles\.desktopSummaryColumn/);
});

test('01 desktop settings use a dedicated settings column and summary column', () => {
  assert.match(zeroOneSettings, /if \(isDesktopWeb\)/);
  assert.match(zeroOneSettings, /<WebGameSettingsShell/);
  assert.match(zeroOneSettings, /settings=\{/);
  assert.match(zeroOneSettings, /summary=\{/);
  assert.match(zeroOneSettings, /title="01 GAME"/);
  assert.match(zeroOneSettings, /label="開始点" value=\{`\$\{startScore\}`\}/);
  assert.match(zeroOneSettings, /label="Out" value=\{getOutRuleLabel\(outRule\)\}/);
  assert.match(zeroOneSettings, /label="Bull" value=\{getBullRuleLabel\(bullRule\)\}/);
});

test('CRICKET desktop settings use a dedicated settings column and summary column', () => {
  assert.match(cricketSettings, /if \(isDesktopWeb\)/);
  assert.match(cricketSettings, /<WebGameSettingsShell/);
  assert.match(cricketSettings, /settings=\{/);
  assert.match(cricketSettings, /summary=\{/);
  assert.match(cricketSettings, /title="STANDARD CRICKET"/);
  assert.match(cricketSettings, /label="対象" value="20 \/ 19 \/ 18 \/ 17 \/ 16 \/ 15 \/ BULL"/);
  assert.match(cricketSettings, /label="0点自然終了" value="なし"/);
});

test('MATCH desktop settings use a dedicated settings column and summary column', () => {
  assert.match(matchSettings, /if \(isDesktopWeb\)/);
  assert.match(matchSettings, /<WebGameSettingsShell/);
  assert.match(matchSettings, /settings=\{/);
  assert.match(matchSettings, /summary=\{/);
  assert.match(matchSettings, /title="MATCH"/);
  assert.match(matchSettings, /label="対戦" value=\{`PLAYER 1 vs \$\{guestDisplayName\}`\}/);
  assert.match(matchSettings, /label="GAME1" value=\{`\$\{zeroOneStartScore\}`\}/);
  assert.match(matchSettings, /label="GAME2" value="STANDARD CRICKET"/);
});

test('desktop settings summaries include start buttons in the summary column', () => {
  assert.match(zeroOneSettings, /label=\{isStarting \? '開始中\.\.\.' : '01 GAME開始'\}/);
  assert.match(cricketSettings, /label=\{isStarting \? '開始中\.\.\.' : 'STANDARD CRICKET開始'\}/);
  assert.match(matchSettings, /label=\{isStarting \? '開始中\.\.\.' : 'MATCH開始'\}/);
  assert.match(zeroOneSettings, /style=\{webGameSettingsStyles\.summaryButton\}/);
  assert.match(cricketSettings, /style=\{webGameSettingsStyles\.summaryButton\}/);
  assert.match(matchSettings, /style=\{webGameSettingsStyles\.summaryButton\}/);
});

test('desktop settings summaries update from selected state values', () => {
  assert.match(zeroOneSettings, /value=\{`\$\{startScore\}`\}/);
  assert.match(zeroOneSettings, /value=\{getOutRuleLabel\(outRule\)\}/);
  assert.match(zeroOneSettings, /value=\{getBullRuleLabel\(bullRule\)\}/);
  assert.match(cricketSettings, /value=\{getBullRuleLabel\(bullRule\)\}/);
  assert.match(matchSettings, /value=\{`PLAYER 1 vs \$\{guestDisplayName\}`\}/);
  assert.match(matchSettings, /value=\{game1FirstThrowLabel\}/);
});

test('mobile start payloads still use the same game setting state', () => {
  assert.match(
    zeroOneSettings,
    /services\.zeroOne\.startGame\(\{\s*startScore,\s*outRule,\s*bullRule,\s*ownerName/s,
  );
  assert.match(cricketSettings, /services\.cricket\.startGame\(\{\s*bullRule,\s*ownerName/s);
  assert.match(
    matchSettings,
    /services\.match\.startMatch\(\{\s*zeroOneStartScore,\s*outRule,\s*bullRule,\s*player1Id/s,
  );
});

test('desktop start buttons reuse the existing handleStart path', () => {
  assert.match(zeroOneSettings, /onPress=\{\(\) => void handleStart\(\)\}/);
  assert.match(cricketSettings, /onPress=\{\(\) => void handleStart\(\)\}/);
  assert.match(matchSettings, /onPress=\{\(\) => void handleStart\(\)\}/);
});

test('existing game logic services are not replaced by settings layout code', () => {
  assert.doesNotMatch(zeroOneSettings, /migration 004|user_version = 4/i);
  assert.doesNotMatch(cricketSettings, /migration 004|user_version = 4/i);
  assert.doesNotMatch(matchSettings, /migration 004|user_version = 4/i);
  assert.match(zeroOneSettings, /ZeroOneActiveGameExistsError/);
  assert.match(cricketSettings, /CricketActiveGameExistsError/);
  assert.match(matchSettings, /MatchActiveExistsError/);
});

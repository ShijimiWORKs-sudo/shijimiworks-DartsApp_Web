import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { resolveDartsAppRootBootstrapState } from '../../features/web/rootBootstrap';

const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath: string): string {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('root route is DartsApp bootstrap and does not render legacy Support onboarding copy', () => {
  const rootRoute = readText('app/index.tsx');

  assert.match(rootRoute, /DartsApp/);
  assert.doesNotMatch(rootRoute, /DartsSupportApp/);
  assert.doesNotMatch(rootRoute, /レーティング/);
  assert.doesNotMatch(rootRoute, /DARTSLIVE|PHOENIX/);
  assert.doesNotMatch(rootRoute, /主な悩み/);
  assert.doesNotMatch(rootRoute, /練習メニューを出すための初期設定/);
});

test('root route replaces to home after AppState and game database are ready', () => {
  const rootRoute = readText('app/index.tsx');

  assert.match(rootRoute, /router\.replace\('\/home'\)/);
  assert.equal(
    resolveDartsAppRootBootstrapState({
      isAppStateLoading: false,
      isDatabaseInitializing: false,
      isDatabaseAvailable: true,
      initializationError: null,
    }),
    'replace_home',
  );
});

test('root bootstrap does not require Account registration before home', () => {
  const rootRoute = readText('app/index.tsx');

  assert.doesNotMatch(rootRoute, /accountBootstrapStatus|activeAccountId|Account未登録/);
  assert.equal(
    resolveDartsAppRootBootstrapState({
      isAppStateLoading: false,
      isDatabaseInitializing: false,
      isDatabaseAvailable: true,
      initializationError: null,
    }),
    'replace_home',
  );
});

test('root bootstrap waits while AppState or database is loading and exposes database errors', () => {
  assert.equal(
    resolveDartsAppRootBootstrapState({
      isAppStateLoading: true,
      isDatabaseInitializing: false,
      isDatabaseAvailable: true,
      initializationError: null,
    }),
    'loading',
  );
  assert.equal(
    resolveDartsAppRootBootstrapState({
      isAppStateLoading: false,
      isDatabaseInitializing: true,
      isDatabaseAvailable: false,
      initializationError: null,
    }),
    'loading',
  );
  assert.equal(
    resolveDartsAppRootBootstrapState({
      isAppStateLoading: false,
      isDatabaseInitializing: false,
      isDatabaseAvailable: false,
      initializationError: new Error('database failed'),
    }),
    'database_error',
  );
});

test('legacy Support setup implementation is retained outside the root route', () => {
  const legacyRoute = readText('app/legacy/support-setup.tsx');

  assert.match(legacyRoute, /旧Support初期設定/);
  assert.match(legacyRoute, /saveProfile/);
  assert.match(legacyRoute, /getLevelFromRating/);
  assert.match(legacyRoute, /concerns/);
  assert.match(legacyRoute, /DARTSLIVE/);
  assert.match(legacyRoute, /PHOENIX/);
});

test('visible DartsApp shell surfaces use DartsApp naming', () => {
  assert.match(readText('components/web/WebTopNavigation.tsx'), /DartsApp/);
  assert.match(readText('app/home.tsx'), /DartsApp/);
});

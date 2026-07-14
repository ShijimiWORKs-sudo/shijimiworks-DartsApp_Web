import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = path.resolve(__dirname, '..', '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8')) as T;
}

test('product identity uses DartsApp while preserving native identifiers', () => {
  const appJson = readJson<{
    expo: {
      name: string;
      slug: string;
      scheme: string;
      orientation: string;
      owner: string;
      ios: { bundleIdentifier: string };
      extra: {
        eas: { projectId: string };
        router: { headers: Record<string, string> };
      };
      plugins: (string | [string, Record<string, unknown>])[];
    };
  }>('app.json');
  const packageJson = readJson<{
    name: string;
    dependencies: Record<string, string>;
  }>('package.json');

  assert.equal(packageJson.name, 'darts-app');
  assert.equal(appJson.expo.name, 'DartsApp');
  assert.equal(appJson.expo.slug, 'darts-app');
  assert.equal(appJson.expo.scheme, 'dartsapp');

  assert.equal(appJson.expo.orientation, 'portrait');
  assert.equal(appJson.expo.owner, 'shijimiworks');
  assert.equal(appJson.expo.ios.bundleIdentifier, 'com.shijimiworks.dartssupportapp');
  assert.equal(appJson.expo.extra.eas.projectId, '7beb2425-048c-4a04-83ee-59846a446108');
  assert.equal(packageJson.dependencies.expo, '~54.0.0');
  assert.equal(packageJson.dependencies['expo-sqlite'], '~16.0.10');
});

test('web router headers enable SQLite WASM shared memory prerequisites', () => {
  const appJson = readJson<{
    expo: {
      extra: { router: { headers: Record<string, string> } };
      plugins: (string | [string, { headers?: Record<string, string> }])[];
    };
  }>('app.json');

  const routerPlugin = appJson.expo.plugins.find(
    (plugin): plugin is [string, { headers?: Record<string, string> }] =>
      Array.isArray(plugin) && plugin[0] === 'expo-router',
  );

  assert.ok(routerPlugin);
  assert.equal(routerPlugin[1].headers?.['Cross-Origin-Embedder-Policy'], 'credentialless');
  assert.equal(routerPlugin[1].headers?.['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.deepEqual(appJson.expo.extra.router.headers, routerPlugin[1].headers);
});

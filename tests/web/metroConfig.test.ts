import assert from 'node:assert/strict';
import { test } from 'node:test';

declare function require(moduleName: string): unknown;

type MetroConfig = {
  resolver: {
    assetExts: string[];
    sourceExts: string[];
  };
};

const metroConfig = require('../../metro.config.js') as MetroConfig;

test('Metro config keeps default resolver extensions and resolves wasm as an asset', () => {
  assert.ok(metroConfig.resolver.assetExts.includes('png'));
  assert.ok(metroConfig.resolver.sourceExts.includes('js'));

  assert.equal(
    metroConfig.resolver.assetExts.filter((extension) => extension === 'wasm').length,
    1,
  );
  assert.equal(
    metroConfig.resolver.sourceExts.filter((extension) => extension === 'wasm').length,
    0,
  );
});

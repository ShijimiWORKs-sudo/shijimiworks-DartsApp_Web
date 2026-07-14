import assert from 'node:assert/strict';
import { test } from 'node:test';

declare function require(moduleName: string): {
  ISOLATION_HEADERS: Record<string, string>;
  applyIsolationHeaders: (headers?: Record<string, string>) => Record<string, string>;
  parseWebArgs: (argv: string[]) => { externalPort: number; expoArgs: string[] };
};

const {
  ISOLATION_HEADERS,
  applyIsolationHeaders,
  parseWebArgs,
} = require('../../scripts/start-web-with-headers.cjs');

test('web start script parses external port while preserving Expo args', () => {
  assert.deepEqual(parseWebArgs(['--port', '8104', '--clear']), {
    externalPort: 8104,
    expoArgs: ['--clear'],
  });

  assert.deepEqual(parseWebArgs(['--clear', '--port=8105']), {
    externalPort: 8105,
    expoArgs: ['--clear'],
  });
});

test('web start script applies COEP and COOP headers without dropping existing headers', () => {
  const headers = applyIsolationHeaders({ 'Content-Type': 'text/html' });

  assert.equal(headers['Content-Type'], 'text/html');
  assert.equal(headers['Cross-Origin-Embedder-Policy'], 'credentialless');
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.deepEqual(ISOLATION_HEADERS, {
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
});

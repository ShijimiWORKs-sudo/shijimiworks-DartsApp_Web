import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWebStartupErrorDetails } from '../../features/web/startupError';

test('web startup error details expose safe recovery guidance', () => {
  const details = buildWebStartupErrorDetails(
    new Error('Unable to resolve ./wa-sqlite/wa-sqlite.wasm'),
    'web_database_init',
  );

  assert.equal(details.title, 'DartsAppを起動できませんでした。');
  assert.equal(details.message, 'Webデータベースの初期化に失敗しました。');
  assert.equal(details.stage, 'web_database_init');
  assert.equal(details.developerName, 'Error');
  assert.match(details.developerMessage, /wa-sqlite/);
  assert.match(details.recoveryAction, /ブラウザを再読み込み/);
});

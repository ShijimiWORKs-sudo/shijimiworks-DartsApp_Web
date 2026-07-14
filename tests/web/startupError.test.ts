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

test('web startup error maps access handle conflicts to tab cleanup guidance', () => {
  const accessHandleError = new Error(
    "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or WritableStream associated with the same file.",
  );
  accessHandleError.name = 'NoModificationAllowedError';

  const wrappedError = new Error('Failed to initialize the game database.') as Error & {
    cause?: unknown;
  };
  wrappedError.cause = accessHandleError;

  const details = buildWebStartupErrorDetails(wrappedError, 'web_database_init');

  assert.equal(details.message, 'DartsAppのデータベースを開けませんでした。');
  assert.match(details.recoveryAction, /別のタブを閉じ/);
  assert.equal(details.developerName, 'Error');
});

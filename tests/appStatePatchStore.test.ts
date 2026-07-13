import assert from 'node:assert/strict';
import test from 'node:test';

import type { AppState } from '../types';
import { createAppStatePatchStore } from '../utils/appStatePatchStore';
import { defaultPracticeFilterState, schemaVersion } from '../utils/appStateMigration';

test('activeAccountId is preserved when uiTheme changes after account save', async () => {
  const writes: AppState[] = [];
  const store = createAppStatePatchStore(createState(), async (state) => {
    writes.push(state);
  });

  await store.persistPatch({ activeAccountId: 'account-1' });
  await store.persistPatch({ uiTheme: 'light' });

  assert.equal(store.getSnapshot().activeAccountId, 'account-1');
  assert.equal(store.getSnapshot().uiTheme, 'light');
  assert.equal(writes.at(-1)?.activeAccountId, 'account-1');
});

test('activeAccountId is preserved when backgroundTheme changes after account save', async () => {
  const writes: AppState[] = [];
  const store = createAppStatePatchStore(createState(), async (state) => {
    writes.push(state);
  });

  await store.persistPatch({ activeAccountId: 'account-1' });
  await store.persistPatch({ backgroundTheme: 'purple' });

  assert.equal(store.getSnapshot().activeAccountId, 'account-1');
  assert.equal(store.getSnapshot().backgroundTheme, 'purple');
  assert.equal(writes.at(-1)?.activeAccountId, 'account-1');
});

test('concurrent AppState writes merge patches without losing changes', async () => {
  const writes: AppState[] = [];
  const store = createAppStatePatchStore(createState(), async (state) => {
    writes.push(state);
  });

  await Promise.all([
    store.persistPatch({ activeAccountId: 'account-1' }),
    store.persistPatch({ uiTheme: 'light' }),
    store.persistPatch({ backgroundTheme: 'orange' }),
  ]);

  assert.equal(store.getSnapshot().activeAccountId, 'account-1');
  assert.equal(store.getSnapshot().uiTheme, 'light');
  assert.equal(store.getSnapshot().backgroundTheme, 'orange');
  assert.equal(writes.length, 3);
  assert.equal(writes[2]?.activeAccountId, 'account-1');
  assert.equal(writes[2]?.uiTheme, 'light');
  assert.equal(writes[2]?.backgroundTheme, 'orange');
});

function createState(): AppState {
  return {
    schemaVersion,
    activeAccountId: null,
    profile: null,
    records: [],
    favoritePracticeMenuIds: [],
    practiceFilterState: defaultPracticeFilterState,
    consultHistories: [],
    formPhotoAdviceResults: [],
    boardReferenceImages: [],
    uiTheme: 'gray',
    backgroundTheme: 'white',
  };
}

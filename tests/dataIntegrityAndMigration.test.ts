import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultPracticeFilterState, migrateAppState } from '../utils/appStateMigration';
import { createConsultHistory } from '../utils/createConsultHistory';
import { validateDataIntegrity } from '../utils/validateDataIntegrity';
import { buildProfile, buildRecord } from './testHelpers';

test('validateDataIntegrity passes for bundled constants', () => {
  const result = validateDataIntegrity();

  assert.equal(result.isValid, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
});

test('migrateAppState upgrades schemaVersion 1 data to schemaVersion 10', () => {
  const profile = buildProfile();
  const record = buildRecord();
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 1,
      profile,
      records: [record],
    }),
    {
      profile: null,
      records: [],
    },
  );

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.deepEqual(migrated.favoritePracticeMenuIds, []);
  assert.deepEqual(migrated.practiceFilterState, defaultPracticeFilterState);
  assert.deepEqual(migrated.consultHistories, []);
  assert.deepEqual(migrated.formPhotoAdviceResults, []);
  assert.deepEqual(migrated.boardReferenceImages, []);
  assert.equal(migrated.uiTheme, 'gray');
  assert.equal(migrated.backgroundTheme, 'white');
  assert.deepEqual(migrated.profile, profile);
  assert.equal(migrated.records.length, 1);
});

test('migrateAppState upgrades schemaVersion 2 data and preserves existing fields', () => {
  const profile = buildProfile();
  const record = buildRecord();
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 2,
      activeAccountId: 'account-existing',
      profile,
      records: [record],
      favoritePracticeMenuIds: ['beginner-bull-count-up-12'],
      practiceFilterState: {
        level: 'beginner',
        machineType: 'PHOENIX',
        gameType: 'COUNT-UP',
        problemTag: 'ブル練習',
      },
      uiTheme: 'light',
    }),
    {
      profile: null,
      records: [],
    },
  );

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, 'account-existing');
  assert.deepEqual(migrated.favoritePracticeMenuIds, ['beginner-bull-count-up-12']);
  assert.equal(migrated.practiceFilterState.level, 'beginner');
  assert.equal(migrated.practiceFilterState.machineType, 'PHOENIX');
  assert.deepEqual(migrated.profile, profile);
  assert.equal(migrated.records[0]?.id, record.id);
  assert.deepEqual(migrated.consultHistories, []);
  assert.deepEqual(migrated.formPhotoAdviceResults, []);
  assert.deepEqual(migrated.boardReferenceImages, []);
  assert.equal(migrated.uiTheme, 'light');
  assert.equal(migrated.backgroundTheme, 'white');
});

test('migrateAppState upgrades schemaVersion 3 data and adds gray theme', () => {
  const profile = buildProfile();
  const record = buildRecord();
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 3,
      profile,
      records: [record],
      favoritePracticeMenuIds: ['advanced-cricket-pressure'],
      practiceFilterState: defaultPracticeFilterState,
      consultHistories: [],
    }),
    {
      profile: null,
      records: [],
    },
  );

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.equal(migrated.uiTheme, 'gray');
  assert.equal(migrated.backgroundTheme, 'white');
  assert.deepEqual(migrated.profile, profile);
  assert.equal(migrated.records[0]?.id, record.id);
  assert.deepEqual(migrated.favoritePracticeMenuIds, ['advanced-cricket-pressure']);
  assert.deepEqual(migrated.formPhotoAdviceResults, []);
  assert.deepEqual(migrated.boardReferenceImages, []);
});

test('migrateAppState upgrades schemaVersion 6 data and preserves photo score fields', () => {
  const profile = buildProfile();
  const record = {
    ...buildRecord({ id: 'photo-record' }),
    inputMethod: 'photoTap',
    photoScore: {
      boardType: 'DARTSLIVE_ZERO',
      calibration: {
        boardType: 'DARTSLIVE_ZERO',
        center: { x: 0.5, y: 0.5 },
        topNumberPoint: { x: 0.5, y: 0.1 },
        outerRadius: 0.4,
        ringPreset: 'soft',
      },
      hits: [],
      totalScore: 60,
      bullCount: 1,
      tripleCount: 1,
      doubleCount: 0,
    },
  };
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 6,
      profile,
      records: [record],
      favoritePracticeMenuIds: [],
      practiceFilterState: defaultPracticeFilterState,
      consultHistories: [],
      uiTheme: 'gray',
      backgroundTheme: 'purple',
    }),
    {
      profile: null,
      records: [],
    },
  );

  const migratedRecord = migrated.records[0] as typeof record;

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.equal(migrated.backgroundTheme, 'purple');
  assert.equal(migratedRecord.inputMethod, 'photoTap');
  assert.equal(migratedRecord.photoScore.totalScore, 60);
});

test('migrateAppState upgrades schemaVersion 7 data and preserves form photo advice results', () => {
  const formPhotoResult = {
    id: 'form-photo-1',
    date: '2026-07-10T00:00:00.000Z',
    throwingHand: 'right',
    photos: [{ type: 'front', note: '正面' }],
    selfCheck: {
      stanceFeelsStable: 'no',
      shoulderLineFeelsAligned: 'unknown',
      elbowHeightFeelsStable: 'unknown',
      releaseFeelsClean: 'no',
      followThroughGoesToTarget: 'unknown',
      bodyOpensEarly: 'unknown',
      gripFeelsTooStrong: 'unknown',
      feelsRushed: 'unknown',
    },
    adviceCategories: ['stance', 'release'],
    summaryText: '確認します。',
    adviceTexts: ['足位置を確認します。'],
    checkPoints: ['同じ角度で撮影する'],
    recommendedPracticeMenuIds: ['beginner-stance-three-sets'],
  };
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 7,
      profile: buildProfile(),
      records: [buildRecord()],
      favoritePracticeMenuIds: [],
      practiceFilterState: defaultPracticeFilterState,
      consultHistories: [],
      formPhotoAdviceResults: [formPhotoResult],
      uiTheme: 'gray',
      backgroundTheme: 'white',
    }),
    {
      profile: null,
      records: [],
    },
  );

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.equal(migrated.formPhotoAdviceResults[0]?.id, 'form-photo-1');
  assert.equal(migrated.records.length, 1);
  assert.deepEqual(migrated.boardReferenceImages, []);
});

test('migrateAppState upgrades schemaVersion 8 data and preserves board reference images', () => {
  const referenceImage = {
    id: 'reference-1',
    boardType: 'DARTSLIVE_ZERO',
    imageUri: 'file://reference.jpg',
    createdAt: '2026-07-10T00:00:00.000Z',
    note: '同じ場所から撮影',
    calibration: {
      boardType: 'DARTSLIVE_ZERO',
      center: { x: 0.5, y: 0.5 },
      topNumberPoint: { x: 0.5, y: 0.1 },
      outerRadius: 0.4,
      ringPreset: 'soft',
    },
    imageWidth: 1200,
    imageHeight: 1600,
  };
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 8,
      profile: buildProfile(),
      records: [buildRecord()],
      favoritePracticeMenuIds: [],
      practiceFilterState: defaultPracticeFilterState,
      consultHistories: [],
      formPhotoAdviceResults: [],
      boardReferenceImages: [referenceImage],
      uiTheme: 'gray',
      backgroundTheme: 'white',
    }),
    {
      profile: null,
      records: [],
    },
  );

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.equal(migrated.boardReferenceImages[0]?.id, 'reference-1');
  assert.equal(migrated.boardReferenceImages[0]?.calibration.boardType, 'DARTSLIVE_ZERO');
  assert.equal(migrated.records.length, 1);
});

test('migrateAppState falls back for broken stored data without crashing', () => {
  const legacyProfile = buildProfile({ rating: 5, level: 'beginner' });
  const legacyRecord = buildRecord({ id: 'legacy' });
  const migrated = migrateAppState('{broken json', {
    profile: legacyProfile,
    records: [legacyRecord],
  });

  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.activeAccountId, null);
  assert.deepEqual(migrated.profile, legacyProfile);
  assert.equal(migrated.records[0]?.id, 'legacy');
  assert.deepEqual(migrated.practiceFilterState, defaultPracticeFilterState);
  assert.deepEqual(migrated.consultHistories, []);
  assert.deepEqual(migrated.formPhotoAdviceResults, []);
  assert.deepEqual(migrated.boardReferenceImages, []);
  assert.equal(migrated.uiTheme, 'gray');
  assert.equal(migrated.backgroundTheme, 'white');
});

test('migrateAppState fills missing fields from safe defaults', () => {
  const migrated = migrateAppState(
    JSON.stringify({
      schemaVersion: 2,
      records: 'not-records',
      favoritePracticeMenuIds: 'not-array',
    }),
    {
      profile: null,
      records: [buildRecord({ id: 'fallback-record' })],
    },
  );

  assert.equal(migrated.records[0]?.id, 'fallback-record');
  assert.equal(migrated.activeAccountId, null);
  assert.deepEqual(migrated.favoritePracticeMenuIds, []);
  assert.deepEqual(migrated.practiceFilterState, defaultPracticeFilterState);
  assert.deepEqual(migrated.consultHistories, []);
  assert.deepEqual(migrated.formPhotoAdviceResults, []);
  assert.deepEqual(migrated.boardReferenceImages, []);
  assert.equal(migrated.uiTheme, 'gray');
  assert.equal(migrated.backgroundTheme, 'white');
});

test('createConsultHistory builds a history with required fields', () => {
  const history = createConsultHistory({
    category: 'release',
    severity: 'normal',
    userText: 'リリースで指に引っかかる',
    result: {
      mainAdvice: [
        {
          id: 'release-003',
          category: 'release',
          title: '指離れがばらつく',
          problemKeywords: ['指'],
          symptoms: [],
          possibleCauses: [],
          adviceSummary: '確認します。',
          checkPoints: [],
          recommendedPracticeMenuIds: [],
          relatedKnowledgeIds: [],
        },
      ],
      causes: ['力み'],
      checkPoints: ['手の残り方を見る'],
      recommendedPracticeMenus: [
        {
          id: 'intermediate-release-line',
          title: 'リリースライン再現',
          level: 'intermediate',
          machineTypes: ['BOTH'],
          gameTypes: ['COUNT-UP'],
          targetProblems: ['リリースが抜ける'],
          durationMinutes: 12,
          purpose: '腕の出る方向をそろえる。',
          steps: [],
          recordItems: [],
          evaluationPoints: [],
          adviceText: '',
          difficulty: 3,
          tags: [],
        },
      ],
      relatedArticles: [
        {
          id: 'kb-release-line',
          category: 'release',
          title: 'リリースラインの見方',
          summary: '',
          body: '',
          tags: [],
          relatedPracticeMenuIds: [],
          relatedAdviceIds: [],
        },
      ],
      cautionText: '無理をしないでください。',
      nextAction: '短く確認する',
    },
  });

  assert.equal(history.category, 'release');
  assert.equal(history.severity, 'normal');
  assert.equal(history.mainAdvice, '指離れがばらつく');
  assert.deepEqual(history.recommendedPracticeMenuIds, ['intermediate-release-line']);
  assert.deepEqual(history.relatedKnowledgeIds, ['kb-release-line']);
});

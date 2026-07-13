import type {
  AppState,
  BackgroundTheme,
  BoardReferenceImage,
  ConsultHistory,
  FormPhotoAdviceResult,
  LegacyStoredState,
  PracticeFilterState,
  PracticeRecord,
  UiTheme,
} from '../types';
import { defaultBackgroundTheme, defaultUiTheme } from '../constants/theme';
import { sortFormPhotoAdviceHistories } from './formPhotoAdviceHistory';

export const schemaVersion = 10;

export const defaultPracticeFilterState: PracticeFilterState = {
  level: 'all',
  machineType: 'all',
  gameType: 'all',
  problemTag: null,
};

export function migrateAppState(
  storedAppState: string | null,
  legacyState: LegacyStoredState,
): AppState {
  const parsedState = parseStoredAppState(storedAppState);

  if (!parsedState) {
    return {
      schemaVersion,
      activeAccountId: null,
      profile: legacyState.profile,
      records: sortRecords(legacyState.records),
      favoritePracticeMenuIds: legacyState.favoritePracticeMenuIds ?? [],
      practiceFilterState: normalizePracticeFilterState(legacyState.practiceFilterState),
      consultHistories: sortConsultHistories(legacyState.consultHistories ?? []),
      formPhotoAdviceResults: sortFormPhotoAdviceHistories(
        legacyState.formPhotoAdviceResults ?? [],
      ),
      boardReferenceImages: sortBoardReferenceImages(legacyState.boardReferenceImages ?? []),
      uiTheme: safeUiTheme(legacyState.uiTheme),
      backgroundTheme: safeBackgroundTheme(legacyState.backgroundTheme),
    };
  }

  return {
    schemaVersion,
    activeAccountId: safeStringOrNull(parsedState.activeAccountId),
    profile: parsedState.profile ?? legacyState.profile,
    records: sortRecords(safeRecords(parsedState.records, legacyState.records)),
    favoritePracticeMenuIds: safeStringArray(parsedState.favoritePracticeMenuIds),
    practiceFilterState: normalizePracticeFilterState(parsedState.practiceFilterState),
    consultHistories: sortConsultHistories(safeConsultHistories(parsedState.consultHistories)),
    formPhotoAdviceResults: sortFormPhotoAdviceHistories(
      safeFormPhotoAdviceResults(parsedState.formPhotoAdviceResults),
    ),
    boardReferenceImages: sortBoardReferenceImages(
      safeBoardReferenceImages(parsedState.boardReferenceImages),
    ),
    uiTheme: safeUiTheme(parsedState.uiTheme),
    backgroundTheme: safeBackgroundTheme(parsedState.backgroundTheme),
  };
}

export function normalizePracticeFilterState(
  filterState?: PracticeFilterState,
): PracticeFilterState {
  return {
    level: filterState?.level ?? defaultPracticeFilterState.level,
    machineType: filterState?.machineType ?? defaultPracticeFilterState.machineType,
    gameType: filterState?.gameType ?? defaultPracticeFilterState.gameType,
    problemTag: filterState?.problemTag ?? defaultPracticeFilterState.problemTag,
  };
}

function parseStoredAppState(storedAppState: string | null) {
  if (!storedAppState) {
    return null;
  }

  try {
    return JSON.parse(storedAppState) as Partial<AppState> & {
      schemaVersion?: number;
    };
  } catch {
    return null;
  }
}

function safeRecords(
  records: PracticeRecord[] | undefined,
  fallbackRecords: PracticeRecord[],
): PracticeRecord[] {
  return Array.isArray(records) ? records : fallbackRecords;
}

function safeStringArray(value: string[] | undefined) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function safeStringOrNull(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function safeConsultHistories(value: ConsultHistory[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function safeFormPhotoAdviceResults(value: FormPhotoAdviceResult[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function safeBoardReferenceImages(value: BoardReferenceImage[] | undefined) {
  return Array.isArray(value) ? value.filter(isBoardReferenceImageLike) : [];
}

function safeUiTheme(value: unknown): UiTheme {
  return value === 'light' || value === 'gray' ? value : defaultUiTheme;
}

function safeBackgroundTheme(value: unknown): BackgroundTheme {
  return value === 'black' ||
    value === 'brown' ||
    value === 'purple' ||
    value === 'orange' ||
    value === 'white'
    ? value
    : defaultBackgroundTheme;
}

function sortRecords(records: PracticeRecord[]) {
  return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function sortConsultHistories(histories: ConsultHistory[]) {
  return [...histories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function sortBoardReferenceImages(images: BoardReferenceImage[]) {
  return [...images].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function isBoardReferenceImageLike(value: BoardReferenceImage) {
  return Boolean(
    value &&
    typeof value.id === 'string' &&
    typeof value.imageUri === 'string' &&
    typeof value.createdAt === 'string' &&
    value.calibration &&
    value.boardType === value.calibration.boardType,
  );
}

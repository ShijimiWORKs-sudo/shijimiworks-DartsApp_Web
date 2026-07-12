import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getLevelFromRating } from '../constants/levels';
import {
  backgroundThemeColors,
  defaultBackgroundTheme,
  getOnBackgroundMutedTextColor,
  getOnBackgroundTextColor,
  type ThemeColors,
  themes,
} from '../constants/theme';
import type {
  AnalysisSummary,
  AppState,
  BackgroundTheme,
  BoardReferenceImage,
  BoardType,
  ConsultHistory,
  FormPhotoAdviceResult,
  PracticeFilterState,
  PracticeRecord,
  PracticeRecordInput,
  UiTheme,
  UserProfile,
} from '../types';
import { calculateAnalysisSummary } from '../utils/analyzePracticeRecords';
import {
  defaultPracticeFilterState,
  migrateAppState,
  normalizePracticeFilterState,
  schemaVersion,
} from '../utils/appStateMigration';
import {
  addFormPhotoAdviceHistory,
  deleteFormPhotoAdviceHistory,
  sortFormPhotoAdviceHistories,
} from '../utils/formPhotoAdviceHistory';

const appStateStorageKey = 'DartsSupportApp:appState';
const profileStorageKey = 'DartsSupportApp:userProfile';
const recordsStorageKey = 'DartsSupportApp:practiceRecords';

type AppStateContextValue = {
  isLoading: boolean;
  profile: UserProfile | null;
  records: PracticeRecord[];
  favoritePracticeMenuIds: string[];
  practiceFilterState: PracticeFilterState;
  consultHistories: ConsultHistory[];
  formPhotoAdviceResults: FormPhotoAdviceResult[];
  boardReferenceImages: BoardReferenceImage[];
  uiTheme: UiTheme;
  backgroundTheme: BackgroundTheme;
  theme: ThemeColors;
  saveProfile: (profile: Omit<UserProfile, 'level'>) => Promise<void>;
  saveProfileAndUiTheme: (profile: Omit<UserProfile, 'level'>, uiTheme: UiTheme) => Promise<void>;
  saveProfileAndDisplaySettings: (
    profile: Omit<UserProfile, 'level'>,
    uiTheme: UiTheme,
    backgroundTheme: BackgroundTheme,
  ) => Promise<void>;
  saveUiTheme: (uiTheme: UiTheme) => Promise<void>;
  saveBackgroundTheme: (backgroundTheme: BackgroundTheme) => Promise<void>;
  addPracticeRecord: (record: PracticeRecordInput) => Promise<void>;
  updatePracticeRecord: (id: string, record: PracticeRecordInput) => Promise<void>;
  deletePracticeRecord: (id: string) => Promise<void>;
  addConsultHistory: (history: ConsultHistory) => Promise<void>;
  deleteConsultHistory: (id: string) => Promise<void>;
  addFormPhotoAdviceResult: (result: FormPhotoAdviceResult) => Promise<void>;
  deleteFormPhotoAdviceResult: (id: string) => Promise<void>;
  saveBoardReferenceImage: (referenceImage: BoardReferenceImage) => Promise<void>;
  deleteBoardReferenceImage: (id: string) => Promise<void>;
  toggleFavoritePracticeMenu: (id: string) => Promise<void>;
  isFavoritePracticeMenu: (id: string) => boolean;
  savePracticeFilterState: (filterState: PracticeFilterState) => Promise<void>;
  resetPracticeFilterState: () => Promise<void>;
  getRecordById: (id: string) => PracticeRecord | null;
  getRecordsByPracticeMenuId: (id: string) => PracticeRecord[];
  getWeeklyPracticeCount: () => number;
  getLatestRecord: () => PracticeRecord | null;
  getAnalysisSummary: () => AnalysisSummary;
  getConsultHistoryById: (id: string) => ConsultHistory | null;
  getFormPhotoAdviceResultById: (id: string) => FormPhotoAdviceResult | null;
  getBoardReferenceImageByBoardType: (boardType: BoardType) => BoardReferenceImage | null;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [favoritePracticeMenuIds, setFavoritePracticeMenuIds] = useState<string[]>([]);
  const [consultHistories, setConsultHistories] = useState<ConsultHistory[]>([]);
  const [formPhotoAdviceResults, setFormPhotoAdviceResults] = useState<FormPhotoAdviceResult[]>([]);
  const [boardReferenceImages, setBoardReferenceImages] = useState<BoardReferenceImage[]>([]);
  const [uiTheme, setUiTheme] = useState<UiTheme>('gray');
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>(defaultBackgroundTheme);
  const [practiceFilterState, setPracticeFilterState] = useState<PracticeFilterState>(
    defaultPracticeFilterState,
  );

  useEffect(() => {
    let mounted = true;

    async function loadStoredState() {
      try {
        const [storedAppState, storedProfile, storedRecords] = await Promise.all([
          AsyncStorage.getItem(appStateStorageKey),
          AsyncStorage.getItem(profileStorageKey),
          AsyncStorage.getItem(recordsStorageKey),
        ]);

        if (!mounted) {
          return;
        }

        const migratedState = migrateAppState(storedAppState, {
          profile: storedProfile ? (JSON.parse(storedProfile) as UserProfile) : null,
          records: storedRecords ? (JSON.parse(storedRecords) as PracticeRecord[]) : [],
        });

        setProfile(migratedState.profile);
        setRecords(sortRecords(migratedState.records));
        setFavoritePracticeMenuIds(migratedState.favoritePracticeMenuIds);
        setPracticeFilterState(migratedState.practiceFilterState);
        setConsultHistories(sortConsultHistories(migratedState.consultHistories));
        setFormPhotoAdviceResults(
          sortFormPhotoAdviceHistories(migratedState.formPhotoAdviceResults),
        );
        setBoardReferenceImages(sortBoardReferenceImages(migratedState.boardReferenceImages));
        setUiTheme(migratedState.uiTheme);
        setBackgroundTheme(migratedState.backgroundTheme);

        if (getStoredSchemaVersion(storedAppState) !== schemaVersion) {
          await persistAppState(migratedState);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStoredState();

    return () => {
      mounted = false;
    };
  }, []);

  const persistCurrentState = useCallback(
    async (overrides: Partial<Omit<AppState, 'schemaVersion'>>) => {
      const nextState: AppState = {
        schemaVersion,
        profile,
        records,
        favoritePracticeMenuIds,
        practiceFilterState,
        consultHistories,
        formPhotoAdviceResults,
        boardReferenceImages,
        uiTheme,
        backgroundTheme,
        ...overrides,
      };

      await persistAppState(nextState);
    },
    [
      backgroundTheme,
      boardReferenceImages,
      consultHistories,
      favoritePracticeMenuIds,
      formPhotoAdviceResults,
      practiceFilterState,
      profile,
      records,
      uiTheme,
    ],
  );

  const saveProfile = useCallback(
    async (profileInput: Omit<UserProfile, 'level'>) => {
      const nextProfile: UserProfile = {
        ...profileInput,
        level: getLevelFromRating(profileInput.rating),
      };

      setProfile(nextProfile);
      await persistCurrentState({ profile: nextProfile });
    },
    [persistCurrentState],
  );

  const saveProfileAndUiTheme = useCallback(
    async (profileInput: Omit<UserProfile, 'level'>, nextUiTheme: UiTheme) => {
      const nextProfile: UserProfile = {
        ...profileInput,
        level: getLevelFromRating(profileInput.rating),
      };

      setProfile(nextProfile);
      setUiTheme(nextUiTheme);
      await persistCurrentState({ profile: nextProfile, uiTheme: nextUiTheme });
    },
    [persistCurrentState],
  );

  const saveProfileAndDisplaySettings = useCallback(
    async (
      profileInput: Omit<UserProfile, 'level'>,
      nextUiTheme: UiTheme,
      nextBackgroundTheme: BackgroundTheme,
    ) => {
      const nextProfile: UserProfile = {
        ...profileInput,
        level: getLevelFromRating(profileInput.rating),
      };

      setProfile(nextProfile);
      setUiTheme(nextUiTheme);
      setBackgroundTheme(nextBackgroundTheme);
      await persistCurrentState({
        profile: nextProfile,
        uiTheme: nextUiTheme,
        backgroundTheme: nextBackgroundTheme,
      });
    },
    [persistCurrentState],
  );

  const saveUiTheme = useCallback(
    async (nextUiTheme: UiTheme) => {
      setUiTheme(nextUiTheme);
      await persistCurrentState({ uiTheme: nextUiTheme });
    },
    [persistCurrentState],
  );

  const saveBackgroundTheme = useCallback(
    async (nextBackgroundTheme: BackgroundTheme) => {
      setBackgroundTheme(nextBackgroundTheme);
      await persistCurrentState({ backgroundTheme: nextBackgroundTheme });
    },
    [persistCurrentState],
  );

  const addPracticeRecord = useCallback(
    async (recordInput: PracticeRecordInput) => {
      const nextRecord: PracticeRecord = {
        ...recordInput,
        id: `${Date.now()}`,
        date: new Date().toISOString(),
      };

      const nextRecords = sortRecords([nextRecord, ...records]);
      setRecords(nextRecords);
      await persistCurrentState({ records: nextRecords });
    },
    [persistCurrentState, records],
  );

  const updatePracticeRecord = useCallback(
    async (id: string, recordInput: PracticeRecordInput) => {
      const currentRecord = records.find((record) => record.id === id);

      if (!currentRecord) {
        return;
      }

      const nextRecords = sortRecords(
        records.map((record) =>
          record.id === id
            ? {
                ...recordInput,
                id,
                date: currentRecord.date,
              }
            : record,
        ),
      );

      setRecords(nextRecords);
      await persistCurrentState({ records: nextRecords });
    },
    [persistCurrentState, records],
  );

  const deletePracticeRecord = useCallback(
    async (id: string) => {
      const nextRecords = records.filter((record) => record.id !== id);
      setRecords(nextRecords);
      await persistCurrentState({ records: nextRecords });
    },
    [persistCurrentState, records],
  );

  const addConsultHistory = useCallback(
    async (history: ConsultHistory) => {
      const nextHistories = sortConsultHistories([history, ...consultHistories]);
      setConsultHistories(nextHistories);
      await persistCurrentState({ consultHistories: nextHistories });
    },
    [consultHistories, persistCurrentState],
  );

  const deleteConsultHistory = useCallback(
    async (id: string) => {
      const nextHistories = consultHistories.filter((history) => history.id !== id);
      setConsultHistories(nextHistories);
      await persistCurrentState({ consultHistories: nextHistories });
    },
    [consultHistories, persistCurrentState],
  );

  const addFormPhotoAdviceResult = useCallback(
    async (result: FormPhotoAdviceResult) => {
      const nextResults = addFormPhotoAdviceHistory(formPhotoAdviceResults, result);
      setFormPhotoAdviceResults(nextResults);
      await persistCurrentState({ formPhotoAdviceResults: nextResults });
    },
    [formPhotoAdviceResults, persistCurrentState],
  );

  const deleteFormPhotoAdviceResult = useCallback(
    async (id: string) => {
      const nextResults = deleteFormPhotoAdviceHistory(formPhotoAdviceResults, id);
      setFormPhotoAdviceResults(nextResults);
      await persistCurrentState({ formPhotoAdviceResults: nextResults });
    },
    [formPhotoAdviceResults, persistCurrentState],
  );

  const saveBoardReferenceImage = useCallback(
    async (referenceImage: BoardReferenceImage) => {
      const nextReferenceImages = sortBoardReferenceImages([
        referenceImage,
        ...boardReferenceImages.filter(
          (item) => item.id !== referenceImage.id && item.boardType !== referenceImage.boardType,
        ),
      ]);

      setBoardReferenceImages(nextReferenceImages);
      await persistCurrentState({ boardReferenceImages: nextReferenceImages });
    },
    [boardReferenceImages, persistCurrentState],
  );

  const deleteBoardReferenceImage = useCallback(
    async (id: string) => {
      const nextReferenceImages = boardReferenceImages.filter((item) => item.id !== id);
      setBoardReferenceImages(nextReferenceImages);
      await persistCurrentState({ boardReferenceImages: nextReferenceImages });
    },
    [boardReferenceImages, persistCurrentState],
  );

  const toggleFavoritePracticeMenu = useCallback(
    async (id: string) => {
      const nextIds = isFavoritePracticeMenuId(favoritePracticeMenuIds, id)
        ? favoritePracticeMenuIds.filter((favoriteId) => favoriteId !== id)
        : [...favoritePracticeMenuIds, id];

      setFavoritePracticeMenuIds(nextIds);
      await persistCurrentState({ favoritePracticeMenuIds: nextIds });
    },
    [favoritePracticeMenuIds, persistCurrentState],
  );

  const isFavoritePracticeMenu = useCallback(
    (id: string) => isFavoritePracticeMenuId(favoritePracticeMenuIds, id),
    [favoritePracticeMenuIds],
  );

  const savePracticeFilterState = useCallback(
    async (filterState: PracticeFilterState) => {
      const nextFilterState = normalizePracticeFilterState(filterState);
      setPracticeFilterState(nextFilterState);
      await persistCurrentState({ practiceFilterState: nextFilterState });
    },
    [persistCurrentState],
  );

  const resetPracticeFilterState = useCallback(async () => {
    setPracticeFilterState(defaultPracticeFilterState);
    await persistCurrentState({ practiceFilterState: defaultPracticeFilterState });
  }, [persistCurrentState]);

  const getRecordById = useCallback(
    (id: string) => records.find((record) => record.id === id) ?? null,
    [records],
  );

  const getRecordsByPracticeMenuId = useCallback(
    (id: string) => records.filter((record) => record.practiceMenuId === id),
    [records],
  );

  const getWeeklyPracticeCount = useCallback(() => {
    const weekStart = getStartOfWeek(new Date());

    return records.filter((record) => new Date(record.date) >= weekStart).length;
  }, [records]);

  const getLatestRecord = useCallback(() => records[0] ?? null, [records]);

  const getAnalysisSummary = useCallback(
    () => calculateAnalysisSummary(records, 'all', profile),
    [profile, records],
  );

  const getConsultHistoryById = useCallback(
    (id: string) => consultHistories.find((history) => history.id === id) ?? null,
    [consultHistories],
  );

  const getFormPhotoAdviceResultById = useCallback(
    (id: string) => formPhotoAdviceResults.find((result) => result.id === id) ?? null,
    [formPhotoAdviceResults],
  );

  const getBoardReferenceImageByBoardType = useCallback(
    (boardType: BoardType) =>
      boardReferenceImages.find((referenceImage) => referenceImage.boardType === boardType) ?? null,
    [boardReferenceImages],
  );

  const theme = useMemo(
    () => ({
      ...themes[uiTheme],
      background: backgroundThemeColors[backgroundTheme],
      onBackground: getOnBackgroundTextColor(backgroundTheme),
      onBackgroundMuted: getOnBackgroundMutedTextColor(backgroundTheme),
    }),
    [backgroundTheme, uiTheme],
  );

  const value = useMemo(
    () => ({
      isLoading,
      profile,
      records,
      favoritePracticeMenuIds,
      practiceFilterState,
      consultHistories,
      formPhotoAdviceResults,
      boardReferenceImages,
      uiTheme,
      backgroundTheme,
      theme,
      saveProfile,
      saveProfileAndUiTheme,
      saveProfileAndDisplaySettings,
      saveUiTheme,
      saveBackgroundTheme,
      addPracticeRecord,
      updatePracticeRecord,
      deletePracticeRecord,
      addConsultHistory,
      deleteConsultHistory,
      addFormPhotoAdviceResult,
      deleteFormPhotoAdviceResult,
      saveBoardReferenceImage,
      deleteBoardReferenceImage,
      toggleFavoritePracticeMenu,
      isFavoritePracticeMenu,
      savePracticeFilterState,
      resetPracticeFilterState,
      getRecordById,
      getRecordsByPracticeMenuId,
      getWeeklyPracticeCount,
      getLatestRecord,
      getAnalysisSummary,
      getConsultHistoryById,
      getFormPhotoAdviceResultById,
      getBoardReferenceImageByBoardType,
    }),
    [
      isLoading,
      profile,
      records,
      favoritePracticeMenuIds,
      practiceFilterState,
      consultHistories,
      formPhotoAdviceResults,
      boardReferenceImages,
      uiTheme,
      backgroundTheme,
      theme,
      saveProfile,
      saveProfileAndUiTheme,
      saveProfileAndDisplaySettings,
      saveUiTheme,
      saveBackgroundTheme,
      addPracticeRecord,
      updatePracticeRecord,
      deletePracticeRecord,
      addConsultHistory,
      deleteConsultHistory,
      addFormPhotoAdviceResult,
      deleteFormPhotoAdviceResult,
      saveBoardReferenceImage,
      deleteBoardReferenceImage,
      toggleFavoritePracticeMenu,
      isFavoritePracticeMenu,
      savePracticeFilterState,
      resetPracticeFilterState,
      getRecordById,
      getRecordsByPracticeMenuId,
      getWeeklyPracticeCount,
      getLatestRecord,
      getAnalysisSummary,
      getConsultHistoryById,
      getFormPhotoAdviceResultById,
      getBoardReferenceImageByBoardType,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}

async function persistAppState(appState: AppState) {
  await AsyncStorage.setItem(
    appStateStorageKey,
    JSON.stringify({
      ...appState,
      records: sortRecords(appState.records),
      consultHistories: sortConsultHistories(appState.consultHistories),
      formPhotoAdviceResults: sortFormPhotoAdviceHistories(appState.formPhotoAdviceResults),
      boardReferenceImages: sortBoardReferenceImages(appState.boardReferenceImages),
      practiceFilterState: normalizePracticeFilterState(appState.practiceFilterState),
    }),
  );
}

function getStoredSchemaVersion(storedAppState: string | null) {
  if (!storedAppState) {
    return null;
  }

  try {
    return (JSON.parse(storedAppState) as Partial<AppState>).schemaVersion ?? null;
  } catch {
    return null;
  }
}

function isFavoritePracticeMenuId(favoritePracticeMenuIds: string[], id: string) {
  return favoritePracticeMenuIds.includes(id);
}

function sortRecords(records: PracticeRecord[]) {
  return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function sortConsultHistories(histories: ConsultHistory[]) {
  return [...histories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function sortBoardReferenceImages(referenceImages: BoardReferenceImage[]) {
  return [...referenceImages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

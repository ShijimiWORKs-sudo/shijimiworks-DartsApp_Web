import type { AppState } from '../types';
import { schemaVersion } from './appStateMigration';

export type AppStatePatch = Partial<Omit<AppState, 'schemaVersion'>>;

export type AppStatePatchStore = {
  getSnapshot: () => AppState;
  setSnapshot: (state: AppState) => void;
  persistPatch: (patch: AppStatePatch) => Promise<AppState>;
  persistSnapshot: (state: AppState) => Promise<AppState>;
};

export function createAppStatePatchStore(
  initialState: AppState,
  writeState: (state: AppState) => Promise<void>,
): AppStatePatchStore {
  let currentState: AppState = { ...initialState, schemaVersion };
  let writeQueue: Promise<void> = Promise.resolve();

  function enqueueWrite(state: AppState) {
    const writeTask = writeQueue.then(() => writeState(state));
    writeQueue = writeTask.catch(() => undefined);
    return writeTask;
  }

  return {
    getSnapshot: () => currentState,
    setSnapshot: (state) => {
      currentState = { ...state, schemaVersion };
    },
    persistPatch: async (patch) => {
      const nextState: AppState = {
        ...currentState,
        ...patch,
        schemaVersion,
      };
      currentState = nextState;
      await enqueueWrite(nextState);
      return nextState;
    },
    persistSnapshot: async (state) => {
      currentState = { ...state, schemaVersion };
      await enqueueWrite(currentState);
      return currentState;
    },
  };
}

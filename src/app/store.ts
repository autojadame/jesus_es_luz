import { configureStore, combineReducers } from "@reduxjs/toolkit";
import settingsReducer from "@/features/settings/settingsSlice";
import llmReducer from "@/features/llm/llmSlice";
import historyReducer from "@/features/history/historySlice";

const LS_KEY = "jesus-es-luz-state-v2";

const rootReducer = combineReducers({
  settings: settingsReducer,
  llm: llmReducer,
  history: historyReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

const defaultSettings = {
  items: [],
  startIndex: 0,
  discardedIds: [],
};

const defaultLlm = {
  summariesById: {},
  summariesLoading: false,
  summariesError: undefined,
  songsById: {},
  songsStatusById: {},
  songsErrorById: {},
  processBatchIds: [],
};

const defaultHistory = {
  entries: [],
};

function loadState(): Partial<RootState> | undefined {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    const loaded = JSON.parse(raw) as any;

    return {
      settings: { ...defaultSettings, ...(loaded.settings ?? {}) },
      llm: { ...defaultLlm, ...(loaded.llm ?? {}) },
      history: { ...defaultHistory, ...(loaded.history ?? {}) },
    };
  } catch {
    return undefined;
  }
}

function saveState(state: RootState) {
  try {
    // ... dentro de saveState(state)
    const minimal = {
      settings: state.settings,
      llm: {
        summariesById: state.llm.summariesById,      // cache estable
        processBatchIds: state.llm.processBatchIds,  // ✅ para “seguir en process”
        songsById: state.llm.songsById,              // ✅ para no perder lo generado en process
        songsStatusById: state.llm.songsStatusById,  // ✅ estados
        songsErrorById: state.llm.songsErrorById,
      },
      history: {
        entries: state.history.entries,
      },
    };
    localStorage.setItem(LS_KEY, JSON.stringify(minimal));
  } catch {}
}

export const store = configureStore({
  reducer: rootReducer,
  preloadedState: loadState(),
});

store.subscribe(() => saveState(store.getState()));

export type AppDispatch = typeof store.dispatch;
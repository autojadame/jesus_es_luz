import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { PassageSummary, SongResult } from "@/types/llm";

type LlmState = {
  summariesById: Record<number, PassageSummary>;
  summariesLoading: boolean;
  summariesError?: string;

  songsById: Record<number, SongResult>;
  songsStatusById: Record<number, "idle" | "loading" | "done" | "error">;
  songsErrorById: Record<number, string | undefined>;

  // ✅ ids del lote que se va a procesar en /process
  processBatchIds: number[];
};

const initialState: LlmState = {
  summariesById: {},
  summariesLoading: false,

  songsById: {},
  songsStatusById: {},
  songsErrorById: {},

  processBatchIds: [],
};

const llmSlice = createSlice({
  name: "llm",
  initialState,
  reducers: {
    summariesStart(state) {
      state.summariesLoading = true;
      state.summariesError = undefined;
    },
    summariesSuccess(state, action: PayloadAction<PassageSummary[]>) {
      state.summariesLoading = false;
      for (const s of action.payload) state.summariesById[s.id] = s;
    },
    summariesError(state, action: PayloadAction<string>) {
      state.summariesLoading = false;
      state.summariesError = action.payload;
    },

    songStart(state, action: PayloadAction<number>) {
      const id = action.payload;
      state.songsStatusById[id] = "loading";
      state.songsErrorById[id] = undefined;
    },
    songSuccess(state, action: PayloadAction<SongResult>) {
      const id = action.payload.id;
      state.songsById[id] = action.payload;
      state.songsStatusById[id] = "done";
    },
    songError(state, action: PayloadAction<{ id: number; error: string }>) {
      state.songsStatusById[action.payload.id] = "error";
      state.songsErrorById[action.payload.id] = action.payload.error;
    },
    resetSongs(state) {
      state.songsById = {};
      state.songsStatusById = {};
      state.songsErrorById = {};
    },

    setProcessBatch(state, action: PayloadAction<number[]>) {
      state.processBatchIds = action.payload;
    },
    clearProcessBatch(state) {
      state.processBatchIds = [];
    },
  },
});

export const {
  summariesStart,
  summariesSuccess,
  summariesError,
  songStart,
  songSuccess,
  songError,
  resetSongs,
  setProcessBatch,
  clearProcessBatch,
} = llmSlice.actions;

export default llmSlice.reducer;
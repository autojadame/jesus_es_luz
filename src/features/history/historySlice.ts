import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { HistoryEntry } from "@/types/history";

type HistoryState = {
  entries: HistoryEntry[]; // newest first
};

const initialState: HistoryState = {
  entries: [],
};

const MAX_ENTRIES = 1000;

const historySlice = createSlice({
  name: "history",
  initialState,
  reducers: {
    addHistoryEntry(state, action: PayloadAction<HistoryEntry>) {
      state.entries.unshift(action.payload);
      if (state.entries.length > MAX_ENTRIES) state.entries.length = MAX_ENTRIES;
    },

    clearHistory(state) {
      state.entries = [];
    },

    // ✅ para Process (si quieres seguir usando "latest por pasaje")
    setSavedFileForLatestByPassage(
      state,
      action: PayloadAction<{
        passageId: number;
        kind: "mp3" | "srt";
        file: { path: string; savedAt: number };
      }>
    ) {
      const e = state.entries.find((x) => x.passageId === action.payload.passageId);
      if (!e) return;
      if (!e.saved) e.saved = {};
      e.saved[action.payload.kind] = action.payload.file;
    },

    // ✅ para History: GUARDA EN LA ENTRADA EXACTA (no en la latest)
    setSavedFileForEntryId(
      state,
      action: PayloadAction<{
        entryId: string;
        kind: "mp3" | "srt";
        file: { path: string; savedAt: number };
      }>
    ) {
      const e = state.entries.find((x) => x.entryId === action.payload.entryId);
      if (!e) return;
      if (!e.saved) e.saved = {};
      e.saved[action.payload.kind] = action.payload.file;
    },
  },
});

export const {
  addHistoryEntry,
  clearHistory,
  setSavedFileForLatestByPassage,
  setSavedFileForEntryId,
} = historySlice.actions;

export default historySlice.reducer;
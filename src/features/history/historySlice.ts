import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { HistoryEntry } from "@/types/history";

type VersionKey = "v1" | "v2";
type FileKind = "mp3" | "srt";
type SavedFile = { path: string; savedAt: number };

type HistoryState = {
  entries: HistoryEntry[]; // newest first
};

const initialState: HistoryState = {
  entries: [],
};

const MAX_ENTRIES = 1000;

function ensureSavedShape(e: any) {
  if (!e.saved) e.saved = {};
  if (!e.saved.v1) e.saved.v1 = {};
  if (!e.saved.v2) e.saved.v2 = {};

  // ✅ compat: si venía del formato antiguo (saved.mp3/srt), lo migramos a v1
  if ((e.saved.mp3 || e.saved.srt) && !e.saved.__migratedV) {
    if (e.saved.mp3 && !e.saved.v1.mp3) e.saved.v1.mp3 = e.saved.mp3;
    if (e.saved.srt && !e.saved.v1.srt) e.saved.v1.srt = e.saved.srt;
    e.saved.__migratedV = true;
  }
}

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

    updateSongTitleForLatestByPassage(
      state,
      action: PayloadAction<{ passageId: number; version?: VersionKey; songTitulo: string }>
    ) {
      const v: VersionKey = action.payload.version ?? "v1";
      const e = state.entries.find((x) => x.passageId === action.payload.passageId);
      if (!e) return;

      if (v === "v1") {
        (e as any).songTituloV1 = action.payload.songTitulo;
        (e as any).songTitulo = action.payload.songTitulo; // compat
      } else {
        (e as any).songTituloV2 = action.payload.songTitulo;
      }
    },

    updateSongTitleForEntryId(
      state,
      action: PayloadAction<{ entryId: string; version?: VersionKey; songTitulo: string }>
    ) {
      const v: VersionKey = action.payload.version ?? "v1";
      const e = state.entries.find((x) => x.entryId === action.payload.entryId);
      if (!e) return;

      if (v === "v1") {
        (e as any).songTituloV1 = action.payload.songTitulo;
        (e as any).songTitulo = action.payload.songTitulo; // compat
      } else {
        (e as any).songTituloV2 = action.payload.songTitulo;
      }
    },

    // ✅ para Process (latest por pasaje)
    setSavedFileForLatestByPassage(
      state,
      action: PayloadAction<{
        passageId: number;
        version?: VersionKey;
        kind: FileKind;
        file: SavedFile;
      }>
    ) {
      const v: VersionKey = action.payload.version ?? "v1";
      const e = state.entries.find((x) => x.passageId === action.payload.passageId);
      if (!e) return;

      ensureSavedShape(e as any);
      (e as any).saved[v][action.payload.kind] = action.payload.file;

      // compat: si es v1, también en raíz
      if (v === "v1") (e as any).saved[action.payload.kind] = action.payload.file;
    },

    // ✅ para History: GUARDA EN LA ENTRADA EXACTA (no en la latest)
    setSavedFileForEntryId(
      state,
      action: PayloadAction<{
        entryId: string;
        version?: VersionKey;
        kind: FileKind;
        file: SavedFile;
      }>
    ) {
      const v: VersionKey = action.payload.version ?? "v1";
      const e = state.entries.find((x) => x.entryId === action.payload.entryId);
      if (!e) return;

      ensureSavedShape(e as any);
      (e as any).saved[v][action.payload.kind] = action.payload.file;

      // compat: si es v1, también en raíz
      if (v === "v1") (e as any).saved[action.payload.kind] = action.payload.file;
    },

    clearSavedFilesForEntryId(state, action: PayloadAction<{ entryId: string }>) {
      const e = state.entries.find((x) => x.entryId === action.payload.entryId);
      if (!e) return;
      (e as any).saved = undefined;
    },

    clearSavedFilesForLatestByPassage(state, action: PayloadAction<{ passageId: number }>) {
      const e = state.entries.find((x) => x.passageId === action.payload.passageId);
      if (!e) return;
      (e as any).saved = undefined;
    },
  },
});

export const {
  addHistoryEntry,
  clearHistory,
  updateSongTitleForLatestByPassage,
  updateSongTitleForEntryId,
  setSavedFileForLatestByPassage,
  setSavedFileForEntryId,
  clearSavedFilesForEntryId,
  clearSavedFilesForLatestByPassage,
} = historySlice.actions;

export default historySlice.reducer;

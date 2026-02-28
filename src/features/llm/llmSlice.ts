import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { PassageSummary, SongResult } from "@/types/llm";

type SongResult2 = SongResult & {
  /**
   * ✅ V2 title (compat: mantenemos `titulo` como V1)
   */
  tituloV2?: string;
};

type VersionKey = "v1" | "v2";

type LlmState = {
  summariesById: Record<number, PassageSummary>;
  summariesLoading: boolean;
  summariesError?: string;

  songsById: Record<number, SongResult2>;
  songsStatusById: Record<number, "idle" | "loading" | "done" | "error">;
  songsErrorById: Record<number, string | undefined>;

  // ✅ ids del lote que se va a procesar en /process
  processBatchIds: number[];


  // ✅ estado opcional para regenerar títulos (por versión)
  songTitleStatusById: Record<string, "idle" | "loading" | "done" | "error">;
  songTitleErrorById: Record<string, string | undefined>;
  usedTitlesGlobal: string[]; // cache global (normalizado)
  usedTitlesByPassage: Record<number, string[]>; // cache por pasaje (normalizado)
};

const initialState: LlmState = {
  summariesById: {},
  summariesLoading: false,

  songsById: {},
  songsStatusById: {},
  songsErrorById: {},

  processBatchIds: [],


  songTitleStatusById: {},
  songTitleErrorById: {},
  usedTitlesGlobal: [],
  usedTitlesByPassage: {},
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
    songSuccess(state, action: PayloadAction<SongResult2>) {
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
    songTitleStart(state, action: PayloadAction<{ passageId: number; version: VersionKey }>) {
      const k = `${action.payload.passageId}:${action.payload.version}`;
      state.songTitleStatusById[k] = "loading";
      state.songTitleErrorById[k] = undefined;
    },
    songTitleSuccess(
      state,
      action: PayloadAction<{ passageId: number; version: VersionKey; title: string; norm: string }>
    ) {
      const { passageId, version, title, norm } = action.payload;
      const k = `${passageId}:${version}`;
      state.songTitleStatusById[k] = "done";
      state.songTitleErrorById[k] = undefined;

      // ✅ actualiza solo el título en songsById (si existe)
      const cur = state.songsById?.[passageId];
      if (!cur) return; // ✅ no inventes una canción incompleta
      if (version === "v1") cur.titulo = title as any;
      else (cur as any).tituloV2 = title;

      // ✅ cache global
      if (!state.usedTitlesGlobal.includes(norm)) state.usedTitlesGlobal.push(norm);

      // ✅ cache por pasaje
      state.usedTitlesByPassage[passageId] = state.usedTitlesByPassage[passageId] || [];
      if (!state.usedTitlesByPassage[passageId].includes(norm)) {
        state.usedTitlesByPassage[passageId].push(norm);
      }
    },
    songTitleError(state, action: PayloadAction<{ passageId: number; version: VersionKey; error: string }>) {
      const k = `${action.payload.passageId}:${action.payload.version}`;
      state.songTitleStatusById[k] = "error";
      state.songTitleErrorById[k] = action.payload.error;
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
  songTitleStart,
  songTitleSuccess,
  songTitleError,
} = llmSlice.actions;

export default llmSlice.reducer;
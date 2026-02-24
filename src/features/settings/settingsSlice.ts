import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { BibleItem } from "@/types/bible";
import { DEFAULT_BIBLE_ITEMS } from "./default.items";

type SettingsState = {
  items: BibleItem[];
  startIndex: number;
  discardedIds: number[];
};

const initialState: SettingsState = {
  items: DEFAULT_BIBLE_ITEMS,
  startIndex: 0,
  discardedIds: [],
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<BibleItem[]>) {
      state.items = action.payload;
      if (state.startIndex >= state.items.length) state.startIndex = Math.max(0, state.items.length - 1);
      // limpia descartados que ya no existan
      const set = new Set(state.items.map((x) => x.id));
      state.discardedIds = state.discardedIds.filter((id) => set.has(id));
    },
    setStartIndex(state, action: PayloadAction<number>) {
      state.startIndex = Math.max(0, action.payload);
    },
    discardId(state, action: PayloadAction<number>) {
      const id = action.payload;
      if (!state.discardedIds.includes(id)) state.discardedIds.push(id);
    },
    restoreId(state, action: PayloadAction<number>) {
      state.discardedIds = state.discardedIds.filter((x) => x !== action.payload);
    },
    updateText(state, action: PayloadAction<{ id: number; texto: string }>) {
      const it = state.items.find((x) => x.id === action.payload.id);
      if (it) it.texto = action.payload.texto;
    },
  },
});

export const { setItems, setStartIndex, discardId, restoreId, updateText } = settingsSlice.actions;
export default settingsSlice.reducer;
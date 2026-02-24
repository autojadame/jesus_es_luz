import type { RootState } from "@/app/store";
import type { BibleItem } from "@/types/bible";

export const selectItems = (s: RootState) => s.settings.items;
export const selectStartIndex = (s: RootState) => s.settings.startIndex;
export const selectDiscardedIds = (s: RootState) => s.settings.discardedIds;

export function selectBatch(s: RootState, size = 5): BibleItem[] {
  const items = selectItems(s);
  const start = selectStartIndex(s);
  const discarded = new Set(selectDiscardedIds(s));

  const out: BibleItem[] = [];
  for (let i = start; i < items.length && out.length < size; i++) {
    const it = items[i];
    if (!discarded.has(it.id)) out.push(it);
  }
  return out;
}
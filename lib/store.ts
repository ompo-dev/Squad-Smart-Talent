import { create } from "zustand";
type Store = { range: "24h" | "7d" | "14d"; setRange: (range: Store["range"]) => void; query: string; setQuery: (query: string) => void };
export const useDashboardStore = create<Store>((set) => ({ range: "14d", setRange: (range) => set({ range }), query: "", setQuery: (query) => set({ query }) }));

import { create } from 'zustand';

export type TabKey = 'overview' | 'team' | 'player' | 'opponent';

interface TimeRange {
  start: number; // seconds
  end: number;   // seconds
}

interface FilterState {
  currentTab: TabKey;
  selectedPlayerId?: string;
  timeRange?: TimeRange;
  setTab: (key: TabKey) => void;
  setPlayer: (id?: string) => void;
  setTimeRange: (range?: TimeRange) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  currentTab: 'overview',
  setTab: (key) => set({ currentTab: key }),
  setPlayer: (id) => set({ selectedPlayerId: id }),
  setTimeRange: (range) => set({ timeRange: range }),
}));

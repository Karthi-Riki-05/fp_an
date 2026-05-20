import { create } from 'zustand';
import type { ColumnFilter, MyResultTab } from '../api/myresult';

interface TabState {
  page: number;
  perPage: number;
  showMyEntries: boolean;
  // Stop tab only
  excludeType: boolean;
  // per-column filters
  filters: ColumnFilter[];
  order: { col?: string; dir?: 'asc' | 'desc' };
  search: string;
  // hidden columns (by key)
  hiddenCols: string[];
  // chosen group-by column key (one for now; matches legacy single-group behaviour)
  groupBy: string | null;
  // selected summary mode (None = null; otherwise 1..7)
  summaryType: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
}

interface RangeState {
  startDate: string | null;   // YYYY-MM-DD
  endDate: string | null;     // YYYY-MM-DD
  preset: string;             // 'all'|'today'|'yesterday'|'thisWeek'|... or 'custom'
}

interface MyResultStore {
  range: RangeState;
  setRange: (r: Partial<RangeState>) => void;
  tabs: Record<MyResultTab, TabState>;
  setTab: (tab: MyResultTab, p: Partial<TabState>) => void;
  reset: () => void;
}

function defaultTabState(tab: MyResultTab): TabState {
  return {
    page: 1,
    perPage: tab === 'production' || tab === 'stop' ? 50 : 50,
    showMyEntries: false,
    excludeType: false,
    filters: [],
    order: { col: undefined, dir: 'desc' },
    search: '',
    hiddenCols: [],
    groupBy: null,
    summaryType: null,
  };
}

const initialTabs: Record<MyResultTab, TabState> = {
  production: defaultTabState('production'),
  scrap: defaultTabState('scrap'),
  stop: defaultTabState('stop'),
  warning: defaultTabState('warning'),
  unregistered: defaultTabState('unregistered'),
};

export const useMyResultStore = create<MyResultStore>((set) => ({
  range: { startDate: null, endDate: null, preset: 'all' },
  setRange: (r) => set((s) => ({ range: { ...s.range, ...r } })),
  tabs: initialTabs,
  setTab: (tab, p) =>
    set((s) => ({ tabs: { ...s.tabs, [tab]: { ...s.tabs[tab], ...p } } })),
  reset: () => set({
    range: { startDate: null, endDate: null, preset: 'all' },
    tabs: initialTabs,
  }),
}));

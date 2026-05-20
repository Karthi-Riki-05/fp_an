import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

// ─── shared types ──────────────────────────────────────────────────────────

export type MyResultTab = 'production' | 'scrap' | 'stop' | 'warning' | 'unregistered';

export interface TabInfo { id: number; slug: MyResultTab; visible: boolean }
export interface TabsResponse { tabs: TabInfo[] }

export interface ColumnFilter { column: string; op: number; value: string }

export interface ListQuery {
  page?: number;
  perPage?: number;
  start_date?: string;
  end_date?: string;
  date?: string;
  flow_id?: number;
  equip_id?: number;
  type_name?: string;
  prod_group?: 'part' | 'equipment' | 'work_shift' | string;
  show_my_entries?: '0' | '1';
  exclude_type?: '0' | '1';
  save_exclude_option?: '0' | '1';
  filter?: Record<string, string | undefined>;
  filters?: ColumnFilter[];
  order?: { col?: string; dir?: 'asc' | 'desc' };
}

export interface ListResponse<T> { data: T[]; total: number; page: number; perPage: number }

export interface BaseRow {
  id: number;
  flowName: string | null;
  equipmentId: number;
  equipmentName: string | null;
  partId: number;
  partNumber: string | null;
  partName: string | null;
  workShiftId: number;
  shiftName: string | null;
  orderNo: string | null;
  comment: string | null;
  selectedDate: string;
  createdAt: string;
  createdByUserId: number;
  createdBy: string | null;
  canEdit: boolean;
}

export interface ProductionRow extends BaseRow {
  workedHours: string | null;
  okPartsQty: number | null;
  plannedQty: number | null;
}

export interface ScrapRow extends BaseRow {
  quantity: number;
  scrapTypeId: number | null;
  scrapType: string | null;
  reasonId: number | null;
  scrapReason: string | null;
  attachment: string | null;
}

export interface StopRow extends BaseRow {
  quantity: number;
  time: string | null;
  sumOfTime: string;
  sumOfTimeSec: number;
  hours: number;
  minutes: number;
  stopTypeId: number | null;
  lossCategory: string | null;
  lossCategoryKey: string | null;
  stopType: string | null;
  reasonId: number | null;
  stopReason: string | null;
  stopTimestamp: string | null;
  restartTimestamp: string | null;
  attachment: string | null;
}

export interface WarningRow {
  id: number;
  equipmentId: number;
  equipmentName: string | null;
  notificationText: string;
  fromTime: string | null;
  toTime: string | null;
  durationSec: number;
  duration: string;
  createdByUserId: number;
  createdBy: string | null;
  canEdit: boolean;
}

export interface UnregisteredRow {
  id: number;
  unitName: string | null;
  equipmentId: number;
  equipmentName: string | null;
  startTime: string;
  endTime: string | null;
  productionTime: string | null;
}

// ─── hooks ────────────────────────────────────────────────────────────────

export function useMyResultTabs() {
  return useQuery({
    queryKey: ['myresult', 'tabs'] as const,
    queryFn: async () => (await apiClient.get<TabsResponse>('/myresult/tabs')).data,
    staleTime: 60_000,
  });
}

function listParams(q: ListQuery): Record<string, unknown> {
  const params: Record<string, unknown> = {
    page: q.page ?? 1,
    perPage: q.perPage ?? 25,
  };
  if (q.start_date) params.start_date = q.start_date;
  if (q.end_date)   params.end_date = q.end_date;
  if (q.date)       params.date = q.date;
  if (q.flow_id)    params.flow_id = q.flow_id;
  if (q.equip_id)   params.equip_id = q.equip_id;
  if (q.type_name)  params.type_name = q.type_name;
  if (q.prod_group) params.prod_group = q.prod_group;
  if (q.show_my_entries) params.show_my_entries = q.show_my_entries;
  if (q.exclude_type) params.exclude_type = q.exclude_type;
  if (q.save_exclude_option) params.save_exclude_option = q.save_exclude_option;
  if (q.filter) params.filter = q.filter;
  if (q.filters && q.filters.length > 0) {
    params.filterColumn = q.filters.map((f) => f.column);
    params.filterType   = q.filters.map((f) => String(f.op));
    params.filterVal    = q.filters.map((f) => f.value);
  }
  if (q.order?.col) {
    params['order[col]'] = q.order.col;
    if (q.order.dir) params['order[dir]'] = q.order.dir;
  }
  return params;
}

export function useProductionList(q: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ['myresult', 'production', q] as const,
    queryFn: async () =>
      (await apiClient.get<ListResponse<ProductionRow>>('/myresult/production', { params: listParams(q) })).data,
    enabled,
  });
}

export function useScrapList(q: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ['myresult', 'scrap', q] as const,
    queryFn: async () =>
      (await apiClient.get<ListResponse<ScrapRow>>('/myresult/scrap', { params: listParams(q) })).data,
    enabled,
  });
}

export function useStopList(q: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ['myresult', 'stop', q] as const,
    queryFn: async () =>
      (await apiClient.get<ListResponse<StopRow>>('/myresult/stop', { params: listParams(q) })).data,
    enabled,
  });
}

export function useWarningList(q: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ['myresult', 'warning', q] as const,
    queryFn: async () =>
      (await apiClient.get<ListResponse<WarningRow>>('/myresult/warning', { params: listParams(q) })).data,
    enabled,
  });
}

export function useUnregisteredList(q: ListQuery, enabled = true) {
  return useQuery({
    queryKey: ['myresult', 'unregistered', q] as const,
    queryFn: async () =>
      (await apiClient.get<ListResponse<UnregisteredRow>>('/myresult/unregistered', { params: listParams(q) })).data,
    enabled,
  });
}

// ─── summary ───────────────────────────────────────────────────────────────

export type SummaryType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const SUMMARY_LABELS: Record<SummaryType, string> = {
  1: 'Empty', 2: 'Non-empty', 3: 'Distinct', 4: 'Sum', 5: 'Max', 6: 'Min', 7: 'Avg',
};

export interface SummaryResponse { type: SummaryType; label: string; row: Record<string, unknown> }

export function useSummary(tab: 'production' | 'scrap' | 'stop', type: SummaryType | null) {
  return useQuery({
    queryKey: ['myresult', 'summary', tab, type] as const,
    queryFn: async () =>
      (await apiClient.get<SummaryResponse>(`/myresult/${tab}/summary`, { params: { type } })).data,
    enabled: type !== null,
  });
}

// ─── edit row + upsert + delete ────────────────────────────────────────────

export interface EditRowResponse {
  row: Record<string, unknown>;
  parts: { id: number; partNo: string | null; name: string | null }[];
  shifts: { id: number; name: string | null }[];
  types: { id: number; name: string | null; type: string | null; excludeType?: boolean }[] | null;
  reasons: { id: number; name: string | null; typeId: number }[] | null;
  scheduleTitles: string[] | null;
}

export function useEditRow(tab: 'production' | 'scrap' | 'stop' | 'warning', id: number | null) {
  return useQuery({
    queryKey: ['myresult', tab, 'edit', id] as const,
    queryFn: async () => (await apiClient.get<EditRowResponse>(`/myresult/${tab}/${id}`)).data,
    enabled: id !== null,
  });
}

export function useUpsertJson(tab: 'production' | 'warning') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await apiClient.post(`/myresult/${tab}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myresult', tab] });
      qc.invalidateQueries({ queryKey: ['myresult', 'summary', tab] });
    },
  });
}

export function useUpsertMultipart(tab: 'scrap' | 'stop') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: Record<string, unknown>; picture?: File | null }) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(input.body)) {
        if (v == null) continue;
        fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      if (input.picture) fd.append('picture', input.picture);
      const { data } = await apiClient.post(`/myresult/${tab}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myresult', tab] });
      qc.invalidateQueries({ queryKey: ['myresult', 'summary', tab] });
    },
  });
}

export function useDeleteRow(tab: 'production' | 'scrap' | 'stop' | 'warning') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.delete(`/myresult/${tab}/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myresult', tab] });
    },
  });
}

// ─── user table-settings JSON merge ────────────────────────────────────────

export interface SaveTableSettingsInput {
  key: string;
  subKey?: string | null;
  data: unknown;
}

export function useSaveTableSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveTableSettingsInput) =>
      (await apiClient.post('/me/settings/table', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['myresult', 'tabs'] });
    },
  });
}

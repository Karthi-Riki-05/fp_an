import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

function tenantHeaders(tenantId: number | null, isAdmin: boolean) {
  if (!isAdmin || !tenantId) return undefined;
  return { 'X-Tenant-Id': String(tenantId) };
}

export interface FlowDesignRow {
  id: number;
  name: string;
  status: number;
  flowData?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlowMonitorStatus {
  equipmentId: number;
  machineId: number;
  runningStatus: string;
  unitConnected: string;
  lastOnline: string | null;
  signalType: string;
  latestData: { machineDataId: number; startTime: string | null; isRegistered: string } | null;
}

export interface FlowAnalyzerData {
  startDate: string;
  endDate: string;
  flowKey: number | null;
  production: Array<{ equipmentId: number; okQty: number; plannedQty: number; workedHoursMin: number }>;
  stops: Array<{ equipmentId: number; stopReasonId: number | null; stopReasonName: string | null; count: number; totalMinutes: number }>;
  scraps: Array<{ equipmentId: number; scrapReasonId: number | null; scrapReasonName: string | null; totalQty: number; count: number }>;
}

export interface FlowLineChartPoint {
  date?: string;
  d?: string;
  quantity?: number;
  hours?: number;
  minutes?: number;
  okQty?: number;
  plannedQty?: number;
}

export interface FlowQuantTime {
  stopByReason: Array<{ reasonId: number | null; name: string | null; quantity: number; hours: number; minutes: number }>;
  stopByDate:   Array<{ d: string; name: string | null; quantity: number; hours: number; minutes: number }>;
}

// ─── List ─────────────────────────────────────────────────────────────────

export function useFlowDesignsList(scope: { tenantId: number | null; isAdmin: boolean }) {
  return useQuery({
    queryKey: ['flow-designs', 'list-with-data', scope.tenantId] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowDesignRow[]>('/admin/flow-designs/list-with-data', {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    staleTime: 30_000,
  });
}

/** Paginated admin list — the /admin/flow-designs page uses this. */
export function useFlowDesignsAdminList(
  scope: { tenantId: number | null; isAdmin: boolean },
  params: { page?: number; perPage?: number; search?: string } = {},
) {
  return useQuery({
    queryKey: ['flow-designs', 'admin-list', scope.tenantId, params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FlowDesignRow[]; total: number; page: number; perPage: number }>(
        '/admin/flow-designs',
        { params, headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export function useFlowDesign(scope: { tenantId: number | null; isAdmin: boolean }, id: number | null) {
  return useQuery({
    queryKey: ['flow-designs', 'detail', scope.tenantId, id] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowDesignRow>(`/admin/flow-designs/${id}`, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    enabled: id !== null,
  });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export function useCreateFlowDesign(scope: { tenantId: number | null; isAdmin: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await apiClient.post<FlowDesignRow>('/admin/flow-designs', input, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flow-designs'] }),
  });
}

export function useUpdateFlowDesign(scope: { tenantId: number | null; isAdmin: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; input: Partial<{ name: string; status: number }> }) => {
      const { data } = await apiClient.patch<FlowDesignRow>(`/admin/flow-designs/${args.id}`, args.input, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flow-designs'] }),
  });
}

export function useToggleFlowDesignStatus(scope: { tenantId: number | null; isAdmin: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.patch<{ id: number; status: number }>(
        `/admin/flow-designs/${id}/status`,
        {},
        { headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flow-designs'] }),
  });
}

export function useDeleteFlowDesign(scope: { tenantId: number | null; isAdmin: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/flow-designs/${id}`, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flow-designs'] }),
  });
}

// ─── Monitor / Analyzer reads ─────────────────────────────────────────────

/** Live status polled every 10s. ETag-cached server-side → 304 short-circuits. */
export function useFlowMonitorStatus(scope: { tenantId: number | null; isAdmin: boolean }, id: number | null) {
  return useQuery({
    queryKey: ['flow-monitor-status', scope.tenantId, id] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowMonitorStatus[]>(
        `/admin/flow-designs/${id}/monitor-status`,
        { headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    enabled: id !== null,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useFlowAnalyzerData(
  scope: { tenantId: number | null; isAdmin: boolean },
  id: number | null,
  range: { startDate: string; endDate: string },
  flowKey?: number,
) {
  return useQuery({
    queryKey: ['flow-analyzer-data', scope.tenantId, id, range, flowKey] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowAnalyzerData>(
        `/admin/flow-designs/${id}/analyzer-data`,
        { params: { ...range, flowKey }, headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useFlowLineChart(
  scope: { tenantId: number | null; isAdmin: boolean },
  id: number | null,
  params: { type: 'production' | 'stop' | 'scrap'; startDate: string; endDate: string; name?: string; flowKey?: number; prodGroup?: string },
) {
  return useQuery({
    queryKey: ['flow-line-chart', scope.tenantId, id, params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowLineChartPoint[]>(
        `/admin/flow-designs/${id}/line-chart`,
        { params, headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useFlowQuantTime(
  scope: { tenantId: number | null; isAdmin: boolean },
  id: number | null,
  range: { startDate: string; endDate: string },
  flowKey?: number,
) {
  return useQuery({
    queryKey: ['flow-quant-time', scope.tenantId, id, range, flowKey] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<FlowQuantTime>(
        `/admin/flow-designs/${id}/quant-time`,
        { params: { ...range, flowKey }, headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    enabled: id !== null,
    staleTime: 30_000,
  });
}

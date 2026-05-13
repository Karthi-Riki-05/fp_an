import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface BaseListParams {
  page?: number;
  perPage?: number;
  from?: string;
  to?: string;
}

// ---------------------------------------------------------------------------
// Production data
// ---------------------------------------------------------------------------

export interface ProductionRow {
  id: number;
  flowName: string | null;
  equipmentName: string | null;
  partNumber: string | null;
  partName: string | null;
  shiftName: string | null;
  orderNo: string | null;
  workedHours: number | null;
  okPartsQty: number | null;
  plannedQty: number | null;
  comment: string | null;
  selectedDate: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export function useProductionList(tenantId: number | null | undefined, params: BaseListParams) {
  return useQuery({
    queryKey: ['admin', 'results', 'production', tenantId, params],
    queryFn: async () =>
      (
        await apiClient.get<PagedResponse<ProductionRow>>('/admin/results/production', {
          params,
          headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
        })
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Scrap data
// ---------------------------------------------------------------------------

export interface ScrapRow {
  id: number;
  flowName: string | null;
  equipmentName: string | null;
  partNumber: string | null;
  partName: string | null;
  shiftName: string | null;
  orderNo: string | null;
  quantity: number | null;
  scrapType: string | null;
  scrapReason: string | null;
  comment: string | null;
  selectedDate: string | null;
  createdAt: string | null;
  createdBy: string | null;
  attachment: string | null;
}

export function useScrapList(tenantId: number | null | undefined, params: BaseListParams) {
  return useQuery({
    queryKey: ['admin', 'results', 'scrap', tenantId, params],
    queryFn: async () =>
      (
        await apiClient.get<PagedResponse<ScrapRow>>('/admin/results/scrap', {
          params,
          headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
        })
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Stop data
// ---------------------------------------------------------------------------

export interface StopRow {
  id: number;
  flowName: string | null;
  equipmentName: string | null;
  partNumber: string | null;
  partName: string | null;
  shiftName: string | null;
  orderNo: string | null;
  quantity: number | null;
  time: number | null;
  sumOfTime: number | null;
  lossCategory: string | null;
  stopType: string | null;
  stopReason: string | null;
  comment: string | null;
  selectedDate: string | null;
  stopTimestamp: string | null;
  restartTimestamp: string | null;
  createdAt: string | null;
  createdBy: string | null;
  attachment: string | null;
}

export interface StopListParams extends BaseListParams {
  include_excluded?: '1' | '0';
}

export function useStopList(tenantId: number | null | undefined, params: StopListParams) {
  return useQuery({
    queryKey: ['admin', 'results', 'stop', tenantId, params],
    queryFn: async () =>
      (
        await apiClient.get<PagedResponse<StopRow>>('/admin/results/stop', {
          params,
          headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
        })
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// Warning data
// ---------------------------------------------------------------------------

export interface WarningRow {
  id: number;
  equipmentId: number | null;
  equipmentName: string | null;
  duration: number | null;
  notificationText: string | null;
  fromTimestamp: string | null;
  toTimestamp: string | null;
  createdAt: string | null;
}

export interface UpdateWarningInput {
  /**
   * Per DROPDOWN_AUDIT RESOLVED v, the editable warning_data fields are:
   *   equipmentId  (Number, FK to equipment)
   *   fromTime     (ISO timestamp)
   *   toTime       (ISO timestamp)
   *   notificationText
   * `duration` is recomputed server-side as (toTime - fromTime) in seconds
   * and is not accepted in the PATCH body.
   */
  equipmentId?: number;
  fromTime?: string;
  toTime?: string;
  notificationText?: string;
}

export function useWarningList(tenantId: number | null | undefined, params: BaseListParams) {
  return useQuery({
    queryKey: ['admin', 'results', 'warning', tenantId, params],
    queryFn: async () =>
      (
        await apiClient.get<PagedResponse<WarningRow>>('/admin/results/warning', {
          params,
          headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
        })
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateWarning(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateWarningInput }) =>
      (
        await apiClient.patch<WarningRow>(`/admin/results/warning/${id}`, input, {
          headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'results', 'warning', tenantId] }),
  });
}

export function useDeleteWarning(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/results/warning/${id}`, {
        headers: tenantId ? { 'X-Tenant-Id': String(tenantId) } : {},
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'results', 'warning', tenantId] }),
  });
}

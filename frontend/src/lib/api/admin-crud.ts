import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

/**
 * Generic CRUD hook factory for tenant-scoped admin endpoints.
 *
 * Each entity (salary-groups, types, stop-reasons, scrap-reasons, parts,
 * work-shifts, feedback) exposes the same five operations on
 * /api/v1/admin/<resource>. Composing these by hand seven times produced
 * 350-odd lines of boilerplate; this factory yields one hook per op per
 * entity with the right query keys for cache invalidation.
 */

export interface TenantScope {
  tenantId: number | null;
  isAdmin: boolean;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
}

function tenantHeaders(scope: TenantScope) {
  if (!scope.isAdmin || !scope.tenantId) return undefined;
  return { 'X-Tenant-Id': String(scope.tenantId) };
}

export function makeAdminCrud<TRow, TCreate, TUpdate, TList = Record<string, unknown>>(
  resource: string,
) {
  const path = `/admin/${resource}`;
  const KEY = (scope: TenantScope) => ['admin-crud', resource, scope.tenantId] as const;

  function useList(scope: TenantScope, params: TList) {
    return useQuery({
      queryKey: [...KEY(scope), 'list', params] as const,
      queryFn: async () => {
        const { data } = await apiClient.get<ListResponse<TRow>>(path, {
          params,
          headers: tenantHeaders(scope),
        });
        return data;
      },
      placeholderData: (prev) => prev,
      staleTime: 5_000,
    });
  }

  function useOne(scope: TenantScope, id: number | null) {
    return useQuery({
      queryKey: id ? ([...KEY(scope), 'one', id] as const) : (['admin-crud', resource, 'idle'] as const),
      queryFn: async () => {
        const { data } = await apiClient.get<TRow>(`${path}/${id}`, {
          headers: tenantHeaders(scope),
        });
        return data;
      },
      enabled: id !== null,
    });
  }

  function useCreate(scope: TenantScope) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (input: TCreate) => {
        const { data } = await apiClient.post<TRow>(path, input, {
          headers: tenantHeaders(scope),
        });
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope) }),
    });
  }

  function useUpdate(scope: TenantScope) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (args: { id: number; input: TUpdate }) => {
        const { data } = await apiClient.patch<TRow>(`${path}/${args.id}`, args.input, {
          headers: tenantHeaders(scope),
        });
        return data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope) }),
    });
  }

  function useRemove(scope: TenantScope) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: number) => {
        await apiClient.delete(`${path}/${id}`, { headers: tenantHeaders(scope) });
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope) }),
    });
  }

  return { useList, useOne, useCreate, useUpdate, useRemove };
}

// ---- entity row shapes ---------------------------------------------------
export interface SalaryGroupRow { id: number; name: string | null; hourlyRate: string; info: string; createdAt: string }
export interface StopReasonRow { id: number; name: string | null; typeId: number; description: string; sortOrder: number; createdAt: string }
export interface ScrapReasonRow extends StopReasonRow {}
export interface AdminTypeRow {
  id: number; name: string | null; kind: string; entity: string;
  description: string | null; icon: string | null; sortOrder: number; isActive: boolean; createdAt: string;
}
export interface PartRow {
  id: number; name: string; partNo: string; description: string | null;
  typeId: number; purchasePrice: string; salesPrice: string; sortOrder: number; createdAt: string;
}
export interface WorkShiftRow {
  id: number; name: string | null; startTime: string | null; endTime: string | null;
  breakStartTime: string | null; breakEndTime: string | null; workingDays: string | null; status: number; createdAt: string;
}
// Feedback was moved to public schema in Phase 4b — its hooks now live at
// lib/api/feedback.ts (use useFeedbackList, useUpdateFeedback, etc.). The
// old generic CRUD shape no longer matches the new model.

// ---- entity-specific input shapes ---------------------------------------
export type SalaryGroupCreate = { name: string; hourlyRate: number; info?: string };
export type SalaryGroupUpdate = Partial<SalaryGroupCreate>;
export type StopReasonCreate = { name: string; typeId: number; description?: string; sortOrder?: number };
export type StopReasonUpdate = Partial<StopReasonCreate>;
export type ScrapReasonCreate = StopReasonCreate;
export type ScrapReasonUpdate = StopReasonUpdate;
export type AdminTypeCreate = { name: string; kind?: string; entity?: string; description?: string; icon?: string; sortOrder?: number; isActive?: boolean };
export type AdminTypeUpdate = Partial<AdminTypeCreate>;
export type PartCreate = { name: string; partNo?: string; description?: string; typeId?: number; purchasePrice?: number; salesPrice?: number; sortOrder?: number };
export type PartUpdate = Partial<PartCreate>;
export type WorkShiftCreate = { name: string; startTime?: string; endTime?: string; breakStartTime?: string; breakEndTime?: string; workingDays?: string };
export type WorkShiftUpdate = Partial<WorkShiftCreate>;
export interface BaseListParams {
  page?: number;
  perPage?: number;
  search?: string;
  name?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Pre-bound CRUD bundles for each entity.
export const salaryGroupsApi = makeAdminCrud<SalaryGroupRow, SalaryGroupCreate, SalaryGroupUpdate, BaseListParams>('salary-groups');
export const stopReasonsApi  = makeAdminCrud<StopReasonRow,  StopReasonCreate,  StopReasonUpdate,  BaseListParams>('stop-reasons');
export const scrapReasonsApi = makeAdminCrud<ScrapReasonRow, ScrapReasonCreate, ScrapReasonUpdate, BaseListParams>('scrap-reasons');
export const typesApi        = makeAdminCrud<AdminTypeRow,   AdminTypeCreate,   AdminTypeUpdate,   BaseListParams & { entity?: string }>('types');
export const partsApi        = makeAdminCrud<PartRow,        PartCreate,        PartUpdate,        BaseListParams & { partNo?: string }>('parts');
export const workShiftsApi   = makeAdminCrud<WorkShiftRow,   WorkShiftCreate,   WorkShiftUpdate,   BaseListParams>('work-shifts');
// feedbackApi removed in Phase 4b — see lib/api/feedback.ts.

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

/**
 * Shared queries used by the admin Result-edit modals. Each modal needs:
 *   - parts list                              → /admin/parts
 *   - work shifts list                        → /admin/work-shifts
 *   - shift-schedule titles (fallback)        → /admin/shift-schedules/titles
 *   - reason types (Scrap or Stop entity)     → /admin/types?entity=
 *   - reasons filtered by typeId (cascade)    → /admin/{scrap,stop}-reasons?typeId=
 *
 * Hooks live here rather than inlined in each page so the queryKey shape
 * and tenant-header pattern stay consistent.
 */

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

interface IdName { id: number; name: string | null }
interface ListResp<T> { data: T[]; total: number; page: number; perPage: number }

export interface PartOption { id: number; name: string; partNo: string }

export function usePartsForSelect(tenantId: number | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'parts', 'select', tenantId],
    queryFn: async () =>
      (
        await apiClient.get<ListResp<PartOption>>('/admin/parts', {
          params: { perPage: 500, sort: 'sortOrder', order: 'asc' },
          headers: headersFor(tenantId),
        })
      ).data.data,
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export interface WorkShiftOption { id: number; name: string | null }

export function useWorkShiftsForSelect(tenantId: number | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'work-shifts', 'select', tenantId],
    queryFn: async () =>
      (
        await apiClient.get<ListResp<WorkShiftOption>>('/admin/work-shifts', {
          params: { perPage: 200 },
          headers: headersFor(tenantId),
        })
      ).data.data,
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export interface ShiftTitle { id: number; title: string; scheduleId: number }

export function useShiftScheduleTitles(
  tenantId: number | null | undefined,
  date: string | null | undefined,
  equipmentId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['admin', 'shift-schedules', 'titles', tenantId, date, equipmentId],
    queryFn: async () =>
      (
        await apiClient.get<ShiftTitle[]>('/admin/shift-schedules/titles', {
          params: { date, equipmentId },
          headers: headersFor(tenantId),
        })
      ).data,
    enabled: !!tenantId && !!date && !!equipmentId,
    staleTime: 30_000,
  });
}

export function useReasonTypes(
  tenantId: number | null | undefined,
  entity: 'ScrapReason' | 'StopReason',
) {
  return useQuery({
    queryKey: ['admin', 'types', 'select', entity, tenantId],
    queryFn: async () =>
      (
        await apiClient.get<ListResp<IdName>>('/admin/types', {
          params: { entity, isActive: true, perPage: 200, sort: 'sortOrder', order: 'asc' },
          headers: headersFor(tenantId),
        })
      ).data.data,
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}

export function useReasonsForType(
  tenantId: number | null | undefined,
  resource: 'scrap-reasons' | 'stop-reasons',
  typeId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['admin', resource, 'by-type', tenantId, typeId],
    queryFn: async () =>
      (
        await apiClient.get<ListResp<IdName>>(`/admin/${resource}`, {
          params: { typeId, perPage: 500 },
          headers: headersFor(tenantId),
        })
      ).data.data,
    enabled: !!tenantId && !!typeId,
    staleTime: 30_000,
  });
}

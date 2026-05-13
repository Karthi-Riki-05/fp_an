'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface OrderRow {
  id: number;
  status: number;
  typeId: number;
  typeName: string | null;
  orderNr: string;
  description: string;
  flowId: number;
  flowName: string | null;
  equipmentId: number;
  equipmentName: string | null;
  partId: number;
  partName: string | null;
  partNo: string | null;
  startDate: string | null;
  endDate: string | null;
  plannedQty: number;
  okQty: number;
  scrapQty: number;
  plannedHrs: number;
  workedHrs: number;
  remainingQty: number;
  remainingHrs: number;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OrderListParams {
  page?: number;
  perPage?: number;
  search?: string;
  equipmentId?: number;
  flowId?: number;
  typeId?: number;
  partId?: number;
  status?: number;
  order?: 'asc' | 'desc';
}

export interface OrderInput {
  typeId: number;
  orderNr: string;
  description?: string;
  flowId: number;
  equipmentId: number;
  partId: number;
  startDate?: string | null;
  endDate?: string | null;
  plannedQty?: number;
  okQty?: number;
  scrapQty?: number;
  plannedHrs?: number;
  workedHrs?: number;
  remainingQty?: number;
  remainingHrs?: number;
  sortOrder?: number;
  status?: number;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const ROOT_KEY = (tenantId: number | null | undefined) => ['admin', 'orders', tenantId] as const;

export function useOrderList(tenantId: number | null | undefined, params: OrderListParams) {
  return useQuery({
    queryKey: [...ROOT_KEY(tenantId), 'list', params] as const,
    queryFn: async () =>
      (
        await apiClient.get<{ data: OrderRow[]; total: number; page: number; perPage: number }>(
          '/admin/orders',
          { params, headers: headersFor(tenantId) },
        )
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useOrderOne(tenantId: number | null | undefined, id: number | null) {
  return useQuery({
    queryKey: [...ROOT_KEY(tenantId), 'one', id] as const,
    queryFn: async () =>
      (await apiClient.get<OrderRow>(`/admin/orders/${id}`, { headers: headersFor(tenantId) })).data,
    enabled: !!tenantId && id !== null,
  });
}

export function useCreateOrder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrderInput) =>
      (await apiClient.post<OrderRow>('/admin/orders', input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT_KEY(tenantId) }),
  });
}

export function useUpdateOrder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<OrderInput> }) =>
      (
        await apiClient.patch<OrderRow>(`/admin/orders/${id}`, input, {
          headers: headersFor(tenantId),
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT_KEY(tenantId) }),
  });
}

export function useDeleteOrder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/orders/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT_KEY(tenantId) }),
  });
}

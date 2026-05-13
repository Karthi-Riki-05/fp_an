'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface WorkstationRow {
  id: number;
  name: string;
  machineId: number | null;
  machineName: string | null;
  status: number;
  createdAt: string | null;
}

export interface WorkstationInput {
  name: string;
  machineId?: number;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const KEY = (tenantId: number | null | undefined) => ['admin', 'workstations', tenantId] as const;

export interface WorkstationListParams { page?: number; perPage?: number; search?: string; machineId?: number }

export function useWorkstationList(tenantId: number | null | undefined, params: WorkstationListParams) {
  return useQuery({
    queryKey: [...KEY(tenantId), 'list', params] as const,
    queryFn: async () =>
      (
        await apiClient.get<{ data: WorkstationRow[]; total: number; page: number; perPage: number }>(
          '/admin/workstations',
          { params, headers: headersFor(tenantId) },
        )
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useCreateWorkstation(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkstationInput) =>
      (await apiClient.post<WorkstationRow>('/admin/workstations', input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useUpdateWorkstation(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<WorkstationInput> }) =>
      (await apiClient.patch<WorkstationRow>(`/admin/workstations/${id}`, input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useDeleteWorkstation(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/workstations/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useToggleWorkstationStatus(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.patch<{ id: number; status: number }>(`/admin/workstations/${id}/status`, {}, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

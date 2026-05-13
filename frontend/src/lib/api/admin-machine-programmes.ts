'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface MachineProgrammeRow {
  id: number;
  name: string;
  description: string | null;
  machineId: number | null;
  machineName: string | null;
  isLink: boolean;
  isLocked: boolean;
  status: number;
  createdAt: string | null;
}

export interface MachineProgrammeInput {
  name: string;
  machineId: number;
  isLink?: boolean;
  isLocked?: boolean;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const KEY = (tenantId: number | null | undefined) => ['admin', 'machine-programmes', tenantId] as const;

export interface MachineProgrammeListParams {
  page?: number;
  perPage?: number;
  search?: string;
  machineId?: number;
}

export function useMachineProgrammeList(tenantId: number | null | undefined, params: MachineProgrammeListParams) {
  return useQuery({
    queryKey: [...KEY(tenantId), 'list', params] as const,
    queryFn: async () =>
      (
        await apiClient.get<{ data: MachineProgrammeRow[]; total: number; page: number; perPage: number }>(
          '/admin/machine-programmes',
          { params, headers: headersFor(tenantId) },
        )
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useCreateMachineProgramme(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MachineProgrammeInput) =>
      (await apiClient.post<MachineProgrammeRow>('/admin/machine-programmes', input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useUpdateMachineProgramme(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<MachineProgrammeInput> }) =>
      (await apiClient.patch<MachineProgrammeRow>(`/admin/machine-programmes/${id}`, input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useDeleteMachineProgramme(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/machine-programmes/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useToggleMachineProgrammeStatus(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.patch<{ id: number; status: number }>(`/admin/machine-programmes/${id}/status`, {}, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

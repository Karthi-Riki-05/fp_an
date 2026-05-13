'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface MachineRow {
  id: number;
  machineName: string | null;
  equipmentId: number;
  equipmentName: string | null;
  folderId: number;
  folderName: string | null;
  isMain: boolean;
  isLocked: boolean;
  createdAt: string | null;
}

export interface MachineInput {
  name: string;
  equipmentId: number;
  folderId: number;
  isLocked?: boolean;
}

export interface MachineFileRow {
  id: number;
  machineDocId: number;
  filename: string;
  filetype: string;
  isMain: boolean;
  isLocked: boolean;
  uploadedAt: string | null;
  uploadedByUserId: number;
  uploadedByEmail: string;
  uploadedByName: string;
  notes: string;
  isActive: boolean;
  createdAt: string | null;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const KEY = (tenantId: number | null | undefined) => ['admin', 'machines', tenantId] as const;
const FILES_KEY = (tenantId: number | null | undefined, machineId: number | null | undefined) =>
  ['admin', 'machine-files', tenantId, machineId] as const;

export interface MachineListParams {
  page?: number;
  perPage?: number;
  search?: string;
  equipmentId?: number;
  folderId?: number;
}

export function useMachineList(tenantId: number | null | undefined, params: MachineListParams) {
  return useQuery({
    queryKey: [...KEY(tenantId), 'list', params] as const,
    queryFn: async () =>
      (
        await apiClient.get<{ data: MachineRow[]; total: number; page: number; perPage: number }>(
          '/admin/machines',
          { params, headers: headersFor(tenantId) },
        )
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useCreateMachine(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MachineInput) =>
      (await apiClient.post<MachineRow>('/admin/machines', input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useUpdateMachine(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<MachineInput> }) =>
      (await apiClient.patch<MachineRow>(`/admin/machines/${id}`, input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

/**
 * Plain `[{id, name}]` machine list for Select dropdowns. Used by:
 *   - D3 machine-programmes form (machineId Select)
 *   - D4 workstations form (machineId Select)
 * Pulls the same /admin/machines endpoint at perPage=500 (single page is
 * fine until tenants approach the soft cap — same TODO as on the
 * scrap/stop-reasons services).
 */
export function useMachinesForSelect(tenantId: number | null | undefined) {
  return useQuery({
    queryKey: ['admin', 'machines', 'select', tenantId],
    queryFn: async () =>
      (
        await apiClient.get<{ data: MachineRow[]; total: number }>('/admin/machines', {
          params: { perPage: 500 },
          headers: headersFor(tenantId),
        })
      ).data.data,
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useDeleteMachine(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/machines/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useToggleMachineLock(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await apiClient.patch<{ id: number; isLocked: boolean }>(`/admin/machines/${id}/status`, {}, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

// ── Machine files ──────────────────────────────────────────────────────────

export function useMachineFileList(tenantId: number | null | undefined, machineId: number | null | undefined) {
  return useQuery({
    queryKey: FILES_KEY(tenantId, machineId),
    queryFn: async () =>
      (await apiClient.get<MachineFileRow[]>('/admin/machine-files', {
        params: { machineId },
        headers: headersFor(tenantId),
      })).data,
    enabled: !!tenantId && !!machineId,
    staleTime: 5_000,
  });
}

export function useUploadMachineFile(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ machineId, file, isLocked }: { machineId: number; file: File; isLocked?: boolean }) => {
      const fd = new FormData();
      fd.append('machineId', String(machineId));
      fd.append('file', file);
      if (isLocked !== undefined) fd.append('isLocked', String(Boolean(isLocked)));
      const { data } = await apiClient.post<MachineFileRow>('/admin/machine-files/upload', fd, {
        headers: { ...headersFor(tenantId), 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: FILES_KEY(tenantId, row.machineDocId) }),
  });
}

export function useUpdateMachineFile(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: { notes?: string; isLocked?: boolean } }) =>
      (await apiClient.patch<MachineFileRow>(`/admin/machine-files/${id}`, input, { headers: headersFor(tenantId) })).data,
    onSuccess: (row) => qc.invalidateQueries({ queryKey: FILES_KEY(tenantId, row.machineDocId) }),
  });
}

export function useDeleteMachineFile(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; machineId: number }) => {
      await apiClient.delete(`/admin/machine-files/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: FILES_KEY(tenantId, vars.machineId) }),
  });
}

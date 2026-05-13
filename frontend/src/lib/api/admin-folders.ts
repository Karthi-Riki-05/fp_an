'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface FolderRow {
  id: number;
  name: string;
  equipmentId: number;
  equipmentName: string | null;
  folderType: number;
  folderTypeName: string | null;
  status: number;
  createdAt: string | null;
}

export interface FolderListParams {
  page?: number;
  perPage?: number;
  search?: string;
  equipmentId?: number;
  folderType?: number;
  order?: 'asc' | 'desc';
}

export interface FolderInput {
  name: string;
  equipmentId: number;
  folderType: number;
  status?: number;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const KEY = (tenantId: number | null | undefined) => ['admin', 'folders', tenantId] as const;

export function useFolderList(tenantId: number | null | undefined, params: FolderListParams) {
  return useQuery({
    queryKey: [...KEY(tenantId), 'list', params] as const,
    queryFn: async () =>
      (
        await apiClient.get<{ data: FolderRow[]; total: number; page: number; perPage: number }>(
          '/admin/folders',
          { params, headers: headersFor(tenantId) },
        )
      ).data,
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useCreateFolder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FolderInput) =>
      (await apiClient.post<FolderRow>('/admin/folders', input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useUpdateFolder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<FolderInput> }) =>
      (await apiClient.patch<FolderRow>(`/admin/folders/${id}`, input, { headers: headersFor(tenantId) })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

export function useDeleteFolder(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/folders/${id}`, { headers: headersFor(tenantId) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(tenantId) }),
  });
}

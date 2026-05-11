import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface RoleSummary {
  id: number;
  name: string;
  all: boolean;
  sort: number;
  permissionCount: number;
  userCount: number;
}

export interface RoleDetail {
  id: number;
  name: string;
  all: boolean;
  sort: number;
  userCount: number;
  permissions: string[];
}

export interface PermissionRow {
  id: number;
  name: string;
  displayName: string;
  sort: number;
}

export interface UpsertRoleInput {
  name: string;
  all?: boolean;
  sort?: number;
  permissions: string[];
}

export type UpdateRoleInput = Partial<UpsertRoleInput>;

const KEYS = {
  list: ['admin', 'roles', 'list'] as const,
  detail: (id: number) => ['admin', 'roles', 'detail', id] as const,
  perms: ['admin', 'roles', 'permissions'] as const,
  any: ['admin', 'roles'] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: async () => (await apiClient.get<RoleSummary[]>('/admin/roles')).data,
    staleTime: 10_000,
  });
}

export function useRole(id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['admin', 'roles', 'detail', 'idle'],
    queryFn: async () => (await apiClient.get<RoleDetail>(`/admin/roles/${id}`)).data,
    enabled: id !== null,
  });
}

export function usePermissionInventory() {
  return useQuery({
    queryKey: KEYS.perms,
    queryFn: async () => (await apiClient.get<PermissionRow[]>('/admin/roles/permissions')).data,
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertRoleInput) =>
      (await apiClient.post<RoleDetail>('/admin/roles', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateRoleInput }) =>
      (await apiClient.patch<RoleDetail>(`/admin/roles/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/roles/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

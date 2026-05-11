import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { TenantSummary } from './types';

export interface TenantDetail extends TenantSummary {
  primaryUserId: number | null;
  legacyDbName: string | null;
  updatedAt: string;
  _count?: { users: number };
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  timezone?: string;
}

export interface UpdateTenantInput {
  name?: string;
  timezone?: string;
}

export interface TenantUserRow {
  id: number;
  tenantId: number;
  userId: number;
  roleId: number | null;
  status: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    status: number;
    deletedAt: string | null;
  };
}

export interface TenantUserListResponse {
  data: TenantUserRow[];
  total: number;
  page: number;
  perPage: number;
}

const KEYS = {
  list: ['admin', 'tenants'] as const,
  detail: (id: number) => ['admin', 'tenants', 'detail', id] as const,
  users: (id: number) => ['admin', 'tenants', 'users', id] as const,
  any: ['admin', 'tenants'] as const,
};

export function useTenantsList(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: async () => (await apiClient.get<TenantSummary[]>('/admin/tenants')).data,
    enabled: opts.enabled ?? true,
  });
}

export function useTenant(id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['admin', 'tenants', 'detail', 'idle'],
    queryFn: async () => (await apiClient.get<TenantDetail>(`/admin/tenants/${id}`)).data,
    enabled: id !== null,
  });
}

export function useTenantUsers(id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.users(id) : ['admin', 'tenants', 'users', 'idle'],
    queryFn: async () =>
      (await apiClient.get<TenantUserListResponse>(`/admin/tenants/${id}/users`)).data,
    enabled: id !== null,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantInput) =>
      (await apiClient.post<TenantSummary>('/admin/tenants', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateTenantInput }) =>
      (await apiClient.patch<TenantDetail>(`/admin/tenants/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useSetTenantStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'suspended' | 'archived' }) =>
      (await apiClient.patch<TenantDetail>(`/admin/tenants/${id}/status`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useArchiveTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/tenants/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useAddTenantUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, userId, roleId }: { tenantId: number; userId: number; roleId?: number }) =>
      (await apiClient.post(`/admin/tenants/${tenantId}/users`, { userId, roleId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useRemoveTenantUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, userId }: { tenantId: number; userId: number }) => {
      await apiClient.delete(`/admin/tenants/${tenantId}/users/${userId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

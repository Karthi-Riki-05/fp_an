import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { AdminUser, AdminUserListResponse, GlobalAdminUser, GlobalUserListResponse } from './types';

export interface ListAdminUsersParams {
  page?: number;
  perPage?: number;
  search?: string;
  name?: string;
  email?: string;
  /** "true" / "false" — DataTables-style filter. Backend is permissive. */
  confirmed?: 'true' | 'false';
  active?: 'true' | 'false';
  /** "true" — include soft-deleted rows (superadmin global list only). */
  deleted?: 'true';
  sort?: 'id' | 'name' | 'email' | 'confirmed' | 'status' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  confirmed?: boolean;
  active?: boolean;
  roleId?: number;
  /** Preferred over roleId — array of role names e.g. ['Company'] */
  roles?: string[];
  unitOnly?: boolean;
  /** Accepted by backend DTO; not persisted (JWT TTL governs session). */
  sessionTimeout?: number;
}

export type UpdateAdminUserInput = Partial<Omit<CreateAdminUserInput, 'password'>> & {
  password?: string;
  roles?: string[];
  unitOnly?: boolean;
};

const KEYS = {
  list: (tenantId: number | null, params: ListAdminUsersParams) =>
    ['admin-users', 'list', tenantId, params] as const,
  detail: (tenantId: number | null, id: number) =>
    ['admin-users', 'detail', tenantId, id] as const,
  any: (tenantId: number | null) => ['admin-users', tenantId] as const,
};

/**
 * Build X-Tenant-Id headers.
 *
 * The JWT already encodes the user's tenant for non-admins, and the backend's
 * TenantInterceptor rejects X-Tenant-Id from non-admins (403 admin-only).
 * Therefore: only send the header when the caller is an admin choosing to
 * operate on a specific tenant. Non-admin: omit entirely.
 */
function tenantHeaders(tenantId: number | null, isAdmin: boolean) {
  if (!isAdmin || !tenantId) return undefined;
  return { 'X-Tenant-Id': String(tenantId) };
}

export interface TenantScope {
  tenantId: number | null;
  isAdmin: boolean;
}

/** Global single-user fetch for superadmin — calls /superadmin/users/:id, no tenant required. */
export function useGlobalUser(id: number | null) {
  return useQuery({
    queryKey: ['superadmin-users', 'detail', id] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<GlobalAdminUser>(`/superadmin/users/${id}`);
      return data;
    },
    enabled: id !== null,
  });
}

/** Global user list for superadmin — calls /superadmin/users, no tenant required. */
export function useGlobalUsers(params: ListAdminUsersParams) {
  return useQuery({
    queryKey: ['superadmin-users', params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<GlobalUserListResponse>('/superadmin/users', { params });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useAdminUsers(scope: TenantScope, params: ListAdminUsersParams) {
  return useQuery({
    queryKey: KEYS.list(scope.tenantId, params),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUserListResponse>('/admin/users', {
        params,
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });
}

export function useAdminUser(scope: TenantScope, id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(scope.tenantId, id) : ['admin-users', 'detail', 'idle'],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUser>(`/admin/users/${id}`, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    enabled: id !== null,
  });
}

export function useCreateAdminUser(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAdminUserInput) => {
      const { data } = await apiClient.post<AdminUser>('/admin/users', input, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any(scope.tenantId) }),
  });
}

export function useUpdateAdminUser(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateAdminUserInput }) => {
      const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}`, input, {
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any(scope.tenantId) }),
  });
}

export function useDeleteAdminUser(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenantId: overrideTenantId }: { id: number; tenantId?: number }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      await apiClient.delete(`/admin/users/${id}`, { headers: hdrs });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useToggleAdminUserStatus(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active, tenantId: overrideTenantId }: { id: number; active: boolean; tenantId?: number }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      const { data } = await apiClient.patch<AdminUser>(
        `/admin/users/${id}/status`,
        { active },
        { headers: hdrs },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useToggleAdminUserConfirm(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmed }: { id: number; confirmed: boolean }) => {
      const { data } = await apiClient.patch<AdminUser>(
        `/admin/users/${id}/confirm`,
        { confirmed },
        { headers: tenantHeaders(scope.tenantId, scope.isAdmin) },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any(scope.tenantId) }),
  });
}

// -----------------------------------------------------------------
// Phase 4b extensions: deactivated/deleted lists, restore, permanent
// delete, password reset, resend confirm.
// -----------------------------------------------------------------

export function useDeactivatedUsers(scope: TenantScope, params: ListAdminUsersParams) {
  return useQuery({
    queryKey: ['admin-users', 'deactivated', scope.tenantId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUserListResponse>('/admin/users/deactivated', {
        params,
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useDeletedUsers(scope: TenantScope, params: ListAdminUsersParams) {
  return useQuery({
    queryKey: ['admin-users', 'deleted', scope.tenantId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUserListResponse>('/admin/users/deleted', {
        params,
        headers: tenantHeaders(scope.tenantId, scope.isAdmin),
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRestoreUser(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenantId: overrideTenantId }: { id: number; tenantId?: number }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      const { data } = await apiClient.post<AdminUser>(`/admin/users/${id}/restore`, {}, { headers: hdrs });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function usePermanentDeleteUser(scope: TenantScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenantId: overrideTenantId }: { id: number; tenantId?: number }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      await apiClient.delete(`/admin/users/${id}/permanent`, { headers: hdrs });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

export function useChangeUserPassword(scope: TenantScope) {
  return useMutation({
    mutationFn: async ({ id, password, tenantId: overrideTenantId }: { id: number; password: string; tenantId?: number | null }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      await apiClient.post(`/admin/users/${id}/password`, { password }, { headers: hdrs });
    },
  });
}

export function useResendConfirmation(scope: TenantScope) {
  return useMutation({
    mutationFn: async ({ id, tenantId: overrideTenantId }: { id: number; tenantId?: number | null }) => {
      const hdrs = overrideTenantId
        ? { 'X-Tenant-Id': String(overrideTenantId) }
        : tenantHeaders(scope.tenantId, scope.isAdmin);
      const { data } = await apiClient.post<{ ok: true; queued: boolean }>(
        `/admin/users/${id}/confirm/resend`,
        {},
        { headers: hdrs },
      );
      return data;
    },
  });
}

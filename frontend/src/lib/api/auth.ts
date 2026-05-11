import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { LoginResponse, MeResponse } from './types';

export const ME_QUERY_KEY = ['me'] as const;

export function useMe(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<MeResponse>('/me');
      return data;
    },
    enabled: opts.enabled ?? true,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => qc.clear(),
  });
}

export interface ImpersonateResponse {
  user: {
    id: number;
    email: string;
    name: string;
    tenantId: number | null;
    roles: string[];
    impersonatorId?: number;
  };
  expiresIn: number;
}

/**
 * Issues an impersonation JWT (server sets cookie). After success, the next
 * /me call will reflect the target user. Caller is responsible for showing
 * the persistent banner (see ImpersonationBanner).
 */
export function useImpersonate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetUserId, tenantId }: { targetUserId: number; tenantId: number }) => {
      const { data } = await apiClient.post<ImpersonateResponse>(
        `/admin/users/${targetUserId}/impersonate`,
        {},
        { headers: { 'X-Tenant-Id': String(tenantId) } },
      );
      return data;
    },
    onSuccess: () => qc.clear(), // refetch /me + everything tenant-scoped
  });
}

/**
 * Ends an impersonation session and restores the original Super Admin token.
 * No re-login needed.
 */
export function useStopImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ImpersonateResponse>('/auth/impersonate/stop', {});
      return data;
    },
    onSuccess: () => qc.clear(),
  });
}

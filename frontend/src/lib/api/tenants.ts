import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { TenantSummary } from './types';

export interface CreateTenantInput {
  name: string;
  slug: string;
  timezone?: string;
}

const TENANTS_KEY = ['admin', 'tenants'] as const;

export function useTenantsList(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TENANTS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<TenantSummary[]>('/admin/tenants');
      return data;
    },
    enabled: opts.enabled ?? true,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantInput) => {
      const { data } = await apiClient.post<TenantSummary>('/admin/tenants', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TENANTS_KEY }),
  });
}

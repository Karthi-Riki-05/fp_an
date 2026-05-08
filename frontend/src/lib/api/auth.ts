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

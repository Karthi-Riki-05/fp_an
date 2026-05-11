import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface SocialRow {
  id: number;
  varKey: string;
  varValue: string | null;
  status: boolean;
  updatedAt: string;
}

export interface CreateSocialInput {
  varKey: string;
  varValue?: string;
  status?: boolean;
}

export interface UpdateSocialInput {
  varValue?: string;
  status?: boolean;
}

const KEYS = {
  list: ['admin', 'social'] as const,
};

export function useSocialList() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: async () => (await apiClient.get<SocialRow[]>('/admin/social')).data,
    staleTime: 10_000,
  });
}

export function useCreateSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSocialInput) =>
      (await apiClient.post<SocialRow>('/admin/social', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}

export function useUpdateSocial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateSocialInput }) =>
      (await apiClient.patch<SocialRow>(`/admin/social/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list }),
  });
}

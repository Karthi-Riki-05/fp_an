import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface FeedbackRow {
  id: number;
  body: string;
  status: number;
  tenantId: number | null;
  tenantNameSnap: string;
  userId: number | null;
  userEmailSnap: string;
  userNameSnap: string;
  visibleToTenant: boolean;
  createdAt: string;
}

export interface FeedbackListResponse {
  data: FeedbackRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface ListFeedbackParams {
  page?: number;
  perPage?: number;
  search?: string;
  tenantId?: number;
  sort?: 'id' | 'status' | 'createdAt' | 'tenantId';
  order?: 'asc' | 'desc';
}

export interface UpdateFeedbackInput {
  body?: string;
  status?: number;
  visibleToTenant?: boolean;
}

const KEYS = {
  list: (p: ListFeedbackParams) => ['admin', 'feedback', 'list', p] as const,
  detail: (id: number) => ['admin', 'feedback', 'detail', id] as const,
  any: ['admin', 'feedback'] as const,
};

export function useFeedbackList(params: ListFeedbackParams = {}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () =>
      (await apiClient.get<FeedbackListResponse>('/admin/feedback', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useFeedbackDetail(id: number | null) {
  return useQuery({
    queryKey: id ? KEYS.detail(id) : ['admin', 'feedback', 'detail', 'idle'],
    queryFn: async () => (await apiClient.get<FeedbackRow>(`/admin/feedback/${id}`)).data,
    enabled: id !== null,
  });
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateFeedbackInput }) =>
      (await apiClient.patch<FeedbackRow>(`/admin/feedback/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/feedback/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.any }),
  });
}

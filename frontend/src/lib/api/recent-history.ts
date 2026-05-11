import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface HistoryRow {
  id: number;
  text: string;
  icon: string | null;
  class: string | null;
  entityId: number | null;
  typeName: string;
  actorId: number;
  actorName: string;
  actorEmail: string;
  createdAt: string | null;
}

export interface HistoryListResponse {
  data: HistoryRow[];
  total: number;
  page: number;
  perPage: number;
}

export function useRecentHistory(opts: { page?: number; perPage?: number; enabled?: boolean } = {}) {
  const { page = 1, perPage = 50, enabled = true } = opts;
  return useQuery({
    queryKey: ['admin', 'history', { page, perPage }],
    queryFn: async () => {
      const { data } = await apiClient.get<HistoryListResponse>('/admin/history', {
        params: { page, perPage },
      });
      return data;
    },
    enabled,
    staleTime: 10_000,
  });
}

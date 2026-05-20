import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface HistoryRow {
  id: number;
  text: string;
  icon: string | null;
  class: string | null;
  entityId: number | null;
  entityType: string;
  actorId: number;
  actorName: string;
  actorEmail: string;
  impersonatorId: number | null;
  createdAt: string | null;
}

export interface HistoryListResponse {
  items: HistoryRow[];
  next_cursor: string | null;
}

export function useRecentHistory(opts: { limit?: number; before?: string; enabled?: boolean } = {}) {
  const { limit = 50, before, enabled = true } = opts;
  return useQuery({
    queryKey: ['admin', 'history', { limit, before }],
    queryFn: async () => {
      const { data } = await apiClient.get<HistoryListResponse>('/admin/history', {
        params: { limit, ...(before ? { before } : {}) },
      });
      return data;
    },
    enabled,
    staleTime: 10_000,
  });
}

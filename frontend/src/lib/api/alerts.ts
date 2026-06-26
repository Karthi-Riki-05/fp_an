import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export type AlertType = 'stop' | 'warning' | 'info';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  machineName: string;
  message: string;
  createdAt: string | null;
  equipmentId: number;
  flowId: number;
}

export interface AlertsResponse {
  items: AlertItem[];
  unread: number;
  counts: { critical: number; warning: number; info: number };
}

/**
 * Operator alert feed. Backed by GET /api/v1/user/alerts (JWT). Polls so the
 * UserShell bell badge stays roughly live without a socket subscription.
 */
export function useAlerts(opts: { enabled?: boolean; refetchMs?: number } = {}) {
  const { enabled = true, refetchMs = 30_000 } = opts;
  return useQuery({
    queryKey: ['user', 'alerts'],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertsResponse>('/user/alerts');
      return data;
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: refetchMs,
  });
}

/**
 * Acknowledge a warning (Sprint 3 / Task 2). On success the warning is removed
 * from the cached alert feed so the list + bell badge update immediately.
 */
export function useAcknowledgeWarning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.patch(`/user/alerts/warnings/${id}/acknowledge`);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<AlertsResponse>(['user', 'alerts'], (prev) => {
        if (!prev) return prev;
        const items = prev.items.filter((a) => !(a.type === 'warning' && a.id === id));
        return {
          ...prev,
          items,
          unread: items.length,
          counts: { ...prev.counts, warning: Math.max(0, prev.counts.warning - 1) },
        };
      });
    },
  });
}

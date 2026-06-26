import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export type LossType = 'Availability' | 'Performance' | 'Quality' | 'Excluded';

export interface LossRow {
  lossType: LossType;
  category: string;
  minutesLost: number;
  pctOfPlanned: number;
  occurrences: number | null;
}

export interface LossModelResponse {
  metrics: { oee: number; availability: number; performance: number; quality: number };
  losses: LossRow[];
  inputs: {
    plannedMinutes: number;
    downtimeMinutes: number;
    runTimeMinutes: number;
    actualQty: number;
    scrapQty: number;
    idealCycleSeconds: number;
  };
  range: { from: string; to: string; machineId: number };
}

/**
 * OEE waterfall + loss breakdown for the Loss Model page (Sprint 3 / Task 4).
 * Note the path: the route lives under the dashboard router, so it is
 * /admin/dashboard/loss-model (not /admin/loss-model).
 */
export function useLossModel(opts: { from?: string; to?: string; machineId?: number; enabled?: boolean } = {}) {
  const { from, to, machineId, enabled = true } = opts;
  return useQuery({
    queryKey: ['admin', 'loss-model', { from, to, machineId }],
    queryFn: async () => {
      const { data } = await apiClient.get<LossModelResponse>('/admin/dashboard/loss-model', {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(machineId ? { machineId } : {}) },
      });
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

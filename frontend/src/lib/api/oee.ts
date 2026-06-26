import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface OeeMetrics {
  oee: number;          // 0–100
  availability: number; // 0–100
  performance: number;  // 0–100
  quality: number;      // 0–100
  inputs: {
    plannedMinutes: number;
    downtimeMinutes: number;
    runTimeMinutes: number;
    actualQty: number;
    scrapQty: number;
    idealCycleSeconds: number;
  };
  computable: {
    availability: boolean;
    performance: boolean;
    quality: boolean;
  };
  range: { from: string; to: string };
}

/** Tenant-wide OEE for a date range, computed server-side from real DB data. */
export function useOee(opts: { from?: string; to?: string; enabled?: boolean } = {}) {
  const { from, to, enabled = true } = opts;
  return useQuery({
    queryKey: ['admin', 'oee', { from, to }],
    queryFn: async () => {
      const { data } = await apiClient.get<OeeMetrics>('/admin/dashboard/oee', {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      });
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

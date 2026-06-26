import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface DashboardChartResponse {
  dates: string[];
  production: number[];
  scrap: number[];
  stops: number[];
  range: { from: string; to: string; flowId: number };
}

/** Long-format point consumed by the @ant-design/plots Line chart. */
export interface ChartPoint {
  date: string;
  series: 'Production' | 'Scrap' | 'Stop';
  value: number;
}

/** Flatten the column response into the Line chart's long format. */
export function toChartPoints(d?: DashboardChartResponse): ChartPoint[] {
  if (!d) return [];
  const out: ChartPoint[] = [];
  d.dates.forEach((date, i) => {
    out.push({ date, series: 'Production', value: d.production[i] ?? 0 });
    out.push({ date, series: 'Scrap', value: d.scrap[i] ?? 0 });
    out.push({ date, series: 'Stop', value: d.stops[i] ?? 0 });
  });
  return out;
}

/** Daily Production / Scrap / Stop series for the admin dashboard line chart. */
export function useDashboardChart(opts: {
  from?: string; to?: string; flowId?: number; enabled?: boolean;
} = {}) {
  const { from, to, flowId, enabled = true } = opts;
  return useQuery({
    queryKey: ['admin', 'dashboard-chart', { from, to, flowId }],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardChartResponse>('/admin/dashboard/chart', {
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(flowId ? { flowId } : {}),
        },
      });
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

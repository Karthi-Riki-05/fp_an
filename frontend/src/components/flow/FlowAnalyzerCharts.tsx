'use client';

import { Card, Empty, Skeleton } from 'antd';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useFlowLineChart, useFlowQuantTime } from '../../lib/api/flow-designs';
import type { TenantScope } from '../../lib/api/admin-crud';

// next/dynamic avoids SSR for Highcharts (it touches window on import).
const HighchartsReact = dynamic(() => import('highcharts-react-official'), { ssr: false });

interface Props {
  scope: TenantScope;
  flowId: number;
  range: { startDate: string; endDate: string };
}

export default function FlowAnalyzerCharts({ scope, flowId, range }: Props) {
  const lineQ = useFlowLineChart(scope, flowId, { type: 'production', ...range });
  const quantQ = useFlowQuantTime(scope, flowId, range);

  const productionOptions = useMemo(() => {
    const rows = lineQ.data ?? [];
    const categories = rows.map((r) => r.d ?? r.date ?? '');
    const ok = rows.map((r) => Number(r.okQty ?? 0));
    const planned = rows.map((r) => Number(r.plannedQty ?? 0));
    return {
      chart: { type: 'line', height: 320 },
      title: { text: 'Production over time', style: { fontSize: '14px' } },
      xAxis: { categories },
      yAxis: { title: { text: 'Quantity' } },
      legend: { enabled: true },
      credits: { enabled: false },
      series: [
        { name: 'OK Qty', data: ok, color: '#00b4d8' },
        { name: 'Planned Qty', data: planned, color: '#5c6bc0' },
      ],
    };
  }, [lineQ.data]);

  const stopsByReasonOptions = useMemo(() => {
    const reasons = quantQ.data?.stopByReason ?? [];
    return {
      chart: { type: 'column', height: 320 },
      title: { text: 'Stops by reason', style: { fontSize: '14px' } },
      xAxis: { categories: reasons.map((r) => r.name ?? '(unknown)') },
      yAxis: { title: { text: 'Total minutes' } },
      legend: { enabled: false },
      credits: { enabled: false },
      series: [{
        name: 'Minutes',
        data: reasons.map((r) => Number(r.hours ?? 0) * 60 + Number(r.minutes ?? 0)),
        color: '#e91e8c',
      }],
    };
  }, [quantQ.data]);

  // We have to import Highcharts at runtime because the React wrapper needs
  // the highcharts module passed as a prop. Lazy-import to keep this off SSR.
  const Highcharts = (typeof window !== 'undefined') ? require('highcharts') : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card size="small" styles={{ body: { padding: 12 } }}>
        {lineQ.isLoading ? <Skeleton active />
         : (lineQ.data?.length ?? 0) === 0
           ? <Empty description="No production data for this date range" />
           : Highcharts && <HighchartsReact highcharts={Highcharts} options={productionOptions} />}
      </Card>
      <Card size="small" styles={{ body: { padding: 12 } }}>
        {quantQ.isLoading ? <Skeleton active />
         : (quantQ.data?.stopByReason.length ?? 0) === 0
           ? <Empty description="No stop data for this date range" />
           : Highcharts && <HighchartsReact highcharts={Highcharts} options={stopsByReasonOptions} />}
      </Card>
    </div>
  );
}

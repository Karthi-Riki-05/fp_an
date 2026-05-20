'use client';

import { FilterOutlined, FullscreenOutlined } from '@ant-design/icons';
import { Empty, Select, Spin, Tooltip, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { use, useRef, useState } from 'react';
import { apiClient } from '../../../../../../lib/api-client';
import { useMe } from '../../../../../../lib/api/auth';
import { DateRangeStrip } from '../../../../../../components/result/DateRangeStrip';

const HighchartsReact = dynamic(() => import('highcharts-react-official'), { ssr: false });

interface BoardRow {
  id: number;
  name: string;
  status: number;
}

interface WidgetRow {
  id: number;
  boardId: number;
  title: string;
  settings: string;
  createdAt: string;
}

interface WidgetChartResponse {
  widget: WidgetRow;
  chartData: Record<string, unknown>[];
}

type HcType = 'combo' | 'bar' | 'solidgauge' | 'column';

function tenantHeaders(isAdmin: boolean, tenantId: number | null) {
  return isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function buildChartOptions(
  hcType: HcType,
  chartData: Record<string, unknown>[]
): Highcharts.Options {
  const names = chartData.map((r) => String(r.name ?? ''));
  const quantities = chartData.map((r) => Number(r.quantity ?? r.ok_qty ?? 0));

  if (hcType === 'bar') {
    return {
      chart: { type: 'bar', height: 200, animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: { categories: names, labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: undefined } },
      series: [{ type: 'bar', name: 'Value', data: quantities }],
    };
  }

  if (hcType === 'solidgauge') {
    const val = quantities[0] ?? 0;
    return {
      chart: { type: 'solidgauge', height: 200, animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      pane: {
        center: ['50%', '70%'],
        size: '120%',
        startAngle: -90,
        endAngle: 90,
        background: [
          {
            backgroundColor: '#e6e6e6',
            innerRadius: '60%',
            outerRadius: '100%',
            shape: 'arc',
          },
        ],
      },
      yAxis: {
        min: 0,
        max: Math.max(100, val),
        lineWidth: 0,
        tickWidth: 0,
        minorTickInterval: undefined,
        title: { text: undefined },
        labels: { enabled: false },
      },
      series: [
        {
          type: 'solidgauge',
          name: 'Value',
          data: [val],
          dataLabels: {
            format:
              '<div style="text-align:center"><span style="font-size:16px">{y}</span></div>',
          },
        },
      ],
    };
  }

  // combo (column + spline) or default column
  return {
    chart: { height: 200, animation: false },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: hcType === 'combo' },
    xAxis: { categories: names, labels: { rotation: -30, style: { fontSize: '10px' } } },
    yAxis: { title: { text: undefined } },
    series:
      hcType === 'combo'
        ? [
            { type: 'column', name: 'Qty', data: quantities },
            { type: 'spline', name: 'Trend', data: quantities },
          ]
        : [{ type: 'column', name: 'Qty', data: quantities }],
  };
}

function WidgetCard({
  widget,
  boardId,
  dateRange,
  headers,
  Highcharts,
}: {
  widget: WidgetRow;
  boardId: number;
  dateRange: { from: string; to: string };
  headers: Record<string, string> | undefined;
  Highcharts: typeof import('highcharts') | null;
}) {
  const settings = (() => {
    try {
      return typeof widget.settings === 'string'
        ? JSON.parse(widget.settings)
        : widget.settings ?? {};
    } catch {
      return {};
    }
  })();

  const hcType: HcType = (['bar', 'solidgauge', 'combo', 'column'] as HcType[]).includes(
    settings.hc_type
  )
    ? (settings.hc_type as HcType)
    : 'combo';

  const { data, isFetching } = useQuery({
    queryKey: ['board-widget-chart', boardId, widget.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data: res } = await apiClient.get(
        `/admin/boards/${boardId}/widgets/${widget.id}/chart-data`,
        { params: { from: dateRange.from, to: dateRange.to }, headers }
      );
      return res as WidgetChartResponse;
    },
    refetchInterval: 30_000,
  });

  const chartData = data?.chartData ?? [];
  const options = buildChartOptions(hcType, chartData);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {isFetching && <Spin size="small" style={{ alignSelf: 'flex-end' }} />}

      {!isFetching && chartData.length === 0 ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="No Data" />
        </div>
      ) : Highcharts ? (
        <HighchartsReact highcharts={Highcharts} options={options} />
      ) : (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      )}

      <Typography.Text
        style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', fontWeight: 500 }}
      >
        {widget.title}
      </Typography.Text>
    </div>
  );
}

export default function BoardViewPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = use(params);
  const boardId = Number(id);

  const { data: me } = useMe();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [Highcharts, setHighcharts] = useState<typeof import('highcharts') | null>(null);

  const today = todayYMD();
  const [dateRange, setDateRange] = useState({ from: today, to: today });
  const [selectedBoardId, setSelectedBoardId] = useState<number>(boardId);

  // solid-gauge extends a class registered by highcharts-more, so the
  // imports MUST run serially — `Promise.all` triggered the class-
  // extends-undefined error because solid-gauge evaluated before
  // highcharts-more finished side-effecting on Highcharts.
  if (typeof window !== 'undefined' && !Highcharts) {
    (async () => {
      const hc = await import('highcharts');
      const more = await import('highcharts/highcharts-more');
      if (typeof more.default === 'function') (more.default as unknown as (hc: unknown) => void)(hc.default);
      const sg = await import('highcharts/modules/solid-gauge');
      if (typeof sg.default === 'function') (sg.default as unknown as (hc: unknown) => void)(hc.default);
      setHighcharts(hc.default as typeof import('highcharts'));
    })();
  }

  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  const headers = tenantHeaders(scope.isAdmin, scope.tenantId);

  const { data: boards } = useQuery({
    queryKey: ['admin-boards-list', scope.tenantId],
    queryFn: async () => {
      const { data: res } = await apiClient.get('/admin/boards', {
        params: { page: 1, perPage: 100 },
        headers,
      });
      return (res as { data: BoardRow[] }).data;
    },
  });

  const { data: widgets, isFetching: loadingWidgets } = useQuery({
    queryKey: ['board-widgets', selectedBoardId, scope.tenantId],
    queryFn: async () => {
      const { data: res } = await apiClient.get(
        `/admin/boards/${selectedBoardId}/widgets`,
        { headers }
      );
      return res as WidgetRow[];
    },
    enabled: !!selectedBoardId,
  });

  const currentBoard = boards?.find((b) => b.id === selectedBoardId);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        background: isFullscreen ? '#0f172a' : undefined,
        padding: isFullscreen ? 16 : undefined,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Board selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            FP Analyzer
          </Typography.Text>
          <Select
            value={selectedBoardId}
            onChange={(v) => setSelectedBoardId(v)}
            style={{ minWidth: 160 }}
            options={(boards ?? []).map((b) => ({ value: b.id, label: b.name }))}
            placeholder="Select board"
            size="small"
          />
          {currentBoard && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {currentBoard.name}
            </Typography.Text>
          )}
        </div>

        {/* Date range strip */}
        <div style={{ flex: 1 }}>
          <DateRangeStrip
            value={dateRange}
            onChange={(from, to) => setDateRange({ from, to })}
          />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="Fullscreen">
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Toggle fullscreen"
            >
              <FullscreenOutlined style={{ fontSize: 16, color: '#374151' }} />
            </button>
          </Tooltip>
          <Tooltip title="Filter">
            <button
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Filter"
            >
              <FilterOutlined style={{ fontSize: 16, color: '#374151' }} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Widget grid */}
      {loadingWidgets ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (widgets ?? []).length === 0 ? (
        <Empty description="No widgets on this board yet." />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {(widgets ?? []).map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              boardId={selectedBoardId}
              dateRange={dateRange}
              headers={headers}
              Highcharts={Highcharts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

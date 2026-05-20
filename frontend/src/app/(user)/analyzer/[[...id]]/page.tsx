'use client';

import {
  ArrowLeftOutlined,
  CloseCircleOutlined,
  FilterOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Radio,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import FlowCardGrid from '../../../../components/flow/FlowCardGrid';
import EmptyDiagramPlaceholder from '../../../../components/flow/EmptyDiagramPlaceholder';
import { DateRangeStrip } from '../../../../components/result/DateRangeStrip';
import { useMe } from '../../../../lib/api/auth';
import { workShiftsApi } from '../../../../lib/api/admin-crud';
import { useEquipmentParts } from '../../../../lib/api/monitor';
import {
  type AnalyzerFilters,
  type FlowAnalyzerData,
  type FlowDesignRow,
  useFlowAnalyzerData,
  useFlowDesign,
  useFlowDesignsList,
  useFlowLineChart,
} from '../../../../lib/api/flow-designs';

const HighchartsReact = dynamic(() => import('highcharts-react-official'), { ssr: false });

const { Title, Text } = Typography;
const TEAL = '#00b4d8';

type TabKey = 'stop' | 'scrap' | 'production';
type GroupBy = 'Part' | 'Equipment' | 'WorkShift' | 'Order';

/**
 * Walk the drawio flow-data XML to build a `cell-id → equipment-id` map,
 * then inject `data-equipment-id` attributes onto matching
 * `<g data-cell-id>` elements in the cached SVG. The Analyzer's
 * `FlowDiagramClickMap` reads these via DOM ancestor walk on click.
 *
 * Restored from the §11-S8 implementation — the live `<FlowDesignerEditor readOnly>`
 * iframe path races with drawio's `EditorUi.createUi` hook on second-
 * iframe loads, leaving `__editorUi` unset and the cellClick forwarder
 * unarmed. Static SVG sidesteps the iframe entirely.
 */
function decorateSvgWithEquipmentIds(svg: string | null | undefined, flowData: string | null | undefined): string | null {
  if (!svg || !flowData) return svg ?? null;
  const trimmed = flowData.trimStart();
  if (!trimmed.startsWith('<')) return svg;
  if (typeof DOMParser === 'undefined') return svg;
  try {
    const xmlDoc = new DOMParser().parseFromString(trimmed, 'text/xml');
    const userObjects = xmlDoc.querySelectorAll('UserObject[equipment-id]');
    const cellToEquipment = new Map<string, string>();
    for (const uo of Array.from(userObjects)) {
      const equipmentId = uo.getAttribute('equipment-id');
      const inner = uo.querySelector('mxCell');
      const cellId = uo.getAttribute('id') || inner?.getAttribute('id');
      if (equipmentId && cellId) cellToEquipment.set(cellId, equipmentId);
    }
    if (cellToEquipment.size === 0) return svg;
    const svgDoc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const groups = svgDoc.querySelectorAll('g[data-cell-id]');
    for (const g of Array.from(groups)) {
      const id = g.getAttribute('data-cell-id');
      const eq = id ? cellToEquipment.get(id) : null;
      if (eq) {
        g.setAttribute('data-equipment-id', eq);
        (g as HTMLElement | SVGElement).setAttribute('style', 'cursor: pointer;');
      }
    }
    return new XMLSerializer().serializeToString(svgDoc.documentElement);
  } catch {
    return svg;
  }
}

/**
 * Renders the cached SVG inline and forwards clicks on cells that carry
 * an `equipment-id` mapping to the parent. Pure DOM — no iframe — so it
 * works regardless of drawio's embed-mode quirks.
 */
function FlowDiagramClickMap({
  svgCache, flowData, onCellClick,
}: {
  svgCache: string | null;
  flowData: string | null;
  onCellClick: (equipmentId: number | null) => void;
}) {
  const decorated = useMemo(
    () => decorateSvgWithEquipmentIds(svgCache, flowData),
    [svgCache, flowData],
  );
  if (!decorated || !decorated.trimStart().startsWith('<svg')) {
    return <EmptyDiagramPlaceholder width="100%" height={376} />;
  }
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    let el: HTMLElement | null = e.target as HTMLElement;
    while (el && el !== e.currentTarget) {
      const eid = el.getAttribute && el.getAttribute('data-equipment-id');
      if (eid) {
        const n = Number(eid);
        if (Number.isInteger(n) && n > 0) { onCellClick(n); return; }
      }
      el = el.parentElement;
    }
    onCellClick(null);
  };
  return (
    <div
      data-testid="flow-diagram-click-map"
      onClick={handleClick}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff', overflow: 'auto',
      }}
      dangerouslySetInnerHTML={{
        __html: decorated.replace(
          /<svg([^>]*)>/i,
          '<svg$1 style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;">',
        ),
      }}
    />
  );
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * This page is mounted at BOTH /analyzer (user shell) and /admin/analyzer
 * (admin shell, via a re-export). useRouteBases keeps internal links
 * inside whichever shell the user came from.
 */
function useRouteBases() {
  const pathname = usePathname() ?? '';
  const inAdmin = pathname.startsWith('/admin/');
  return {
    analyzerRoute: inAdmin ? '/admin/analyzer' : '/analyzer',
    dashboardRoute: inAdmin ? '/admin/dashboard' : '/dashboard',
  };
}

// ─── Card grid (no detail id present) ──────────────────────────────────────

function FlowAnalyzerGrid() {
  const router = useRouter();
  const { data: me } = useMe();
  const { analyzerRoute, dashboardRoute } = useRouteBases();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const flows = useFlowDesignsList(scope);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href={dashboardRoute} aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={3} style={{ margin: 0 }}>Flow Analyzer</Title>
      </div>
      <FlowCardGrid
        flows={flows.data ?? []}
        onFlowClick={(id) => router.push(`${analyzerRoute}/${id}`)}
        title={`${flows.data?.length ?? 0} active flow${(flows.data?.length ?? 0) === 1 ? '' : 's'}`}
      />
    </div>
  );
}

// ─── Detail (tabbed analytics) ─────────────────────────────────────────────

function FlowAnalyzerDetail({ flowId }: { flowId: number }) {
  const router = useRouter();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };
  const { analyzerRoute } = useRouteBases();

  // ── State ───────────────────────────────────────────────────────────────
  const [range, setRange] = useState<{ from: string; to: string }>({ from: todayYMD(), to: todayYMD() });
  const [activeTab, setActiveTab] = useState<TabKey>('stop');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [selectedEquipmentName, setSelectedEquipmentName] = useState<string>('All');
  const [fullscreen, setFullscreen] = useState(false);

  // Per-tab filter draft state (the "applied" filter only updates when the
  // operator clicks the teal filter button — matches the legacy UX where
  // changing a dropdown doesn't immediately refetch).
  const [stopDraft, setStopDraft] = useState<AnalyzerFilters>({});
  const [scrapDraft, setScrapDraft] = useState<AnalyzerFilters>({});
  const [productionDraft, setProductionDraft] = useState<AnalyzerFilters>({ groupBy: 'Part' });
  const [stopApplied, setStopApplied] = useState<AnalyzerFilters>({});
  const [scrapApplied, setScrapApplied] = useState<AnalyzerFilters>({});
  const [productionApplied, setProductionApplied] = useState<AnalyzerFilters>({ groupBy: 'Part' });

  const flowQ = useFlowDesign(scope, flowId);
  const flowsListQ = useFlowDesignsList(scope);

  // ── Flow selector dropdown changes the route ────────────────────────────
  const flowOptions = useMemo(
    () => (flowsListQ.data ?? []).map((f: FlowDesignRow) => ({ value: f.id, label: f.name })),
    [flowsListQ.data],
  );

  // ── Top toolbar ─────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href={analyzerRoute} aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={4} style={{ margin: 0 }}>Flow Analyzer</Title>
        <Button type="primary" style={{ background: TEAL, borderColor: TEAL }}>
          Analyze Flow
        </Button>
        <div style={{ flex: 1 }} />
        <Select
          value={flowId}
          options={flowOptions}
          loading={flowsListQ.isLoading}
          onChange={(val) => router.push(`${analyzerRoute}/${val}`)}
          style={{ minWidth: 220 }}
          showSearch
          optionFilterProp="label"
        />
      </div>

      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 12 } }}>
        <DateRangeStrip value={range} onChange={(from, to) => setRange({ from, to })} />
      </Card>

      {selectedEquipmentId != null ? (
        <div style={{ marginBottom: 8 }}>
          <Tag
            color="processing"
            closable
            closeIcon={<CloseCircleOutlined />}
            onClose={() => { setSelectedEquipmentId(null); setSelectedEquipmentName('All'); }}
          >
            Filtered to {selectedEquipmentName}
          </Tag>
        </div>
      ) : null}

      {/* ── Diagram canvas (static SVG with cell-click delegation) ───────
          Uses the §11-S8 decorated-svgCache approach: parse the drawio
          flowData for UserObject[equipment-id], cross-reference SVG
          g[data-cell-id], inject data-equipment-id, then catch clicks
          via DOM event delegation. The live `<FlowDesignerEditor readOnly>`
          path hits the second-iframe `__editorUi` race intermittently
          (see SESSION_HANDOFF_2026-05-15.md item #2). */}
      <Card
        size="small"
        styles={{
          body: {
            padding: 0,
            height: fullscreen ? 'calc(100vh - 80px)' : 400,
            position: 'relative',
          },
        }}
        style={fullscreen ? { position: 'fixed', inset: 8, zIndex: 1000, margin: 0 } : { marginBottom: 12 }}
      >
        <FlowDiagramClickMap
          svgCache={flowQ.data?.svgCache ?? null}
          flowData={flowQ.data?.flowData ?? null}
          onCellClick={(eid) => {
            if (eid == null) {
              setSelectedEquipmentId(null);
              setSelectedEquipmentName('All');
              return;
            }
            setSelectedEquipmentId(eid);
            setSelectedEquipmentName(`Equipment #${eid}`);
          }}
        />
        <Button
          icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={() => setFullscreen((v) => !v)}
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
          size="small"
        />
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        items={[
          {
            key: 'stop',
            label: 'Stop Cause',
            children: (
              <StopCauseTab
                tenantId={tenantId}
                scope={scope}
                flowId={flowId}
                flowKey={selectedEquipmentId}
                range={range}
                draft={stopDraft}
                onDraft={setStopDraft}
                applied={stopApplied}
                onApply={() => setStopApplied(stopDraft)}
              />
            ),
          },
          {
            key: 'scrap',
            label: 'Scrap',
            children: (
              <ScrapTab
                tenantId={tenantId}
                scope={scope}
                flowId={flowId}
                flowKey={selectedEquipmentId}
                range={range}
                draft={scrapDraft}
                onDraft={setScrapDraft}
                applied={scrapApplied}
                onApply={() => setScrapApplied(scrapDraft)}
              />
            ),
          },
          {
            key: 'production',
            label: 'Production',
            children: (
              <ProductionTab
                tenantId={tenantId}
                scope={scope}
                flowId={flowId}
                flowKey={selectedEquipmentId}
                range={range}
                draft={productionDraft}
                onDraft={setProductionDraft}
                applied={productionApplied}
                onApply={() => setProductionApplied(productionDraft)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

// ─── Shared filter-bar pieces ──────────────────────────────────────────────

interface TabProps {
  tenantId: number | null;
  scope: { tenantId: number | null; isAdmin: boolean };
  flowId: number;
  flowKey: number | null;
  range: { from: string; to: string };
  draft: AnalyzerFilters;
  onDraft: (f: AnalyzerFilters) => void;
  applied: AnalyzerFilters;
  onApply: () => void;
}

function WorkShiftSelect({
  tenantId, value, onChange,
}: { tenantId: number | null; value?: string; onChange: (v?: string) => void }) {
  const shiftsQ = workShiftsApi.useList({ tenantId, isAdmin: false }, { page: 1, perPage: 200 });
  const options = (shiftsQ.data?.data ?? [])
    .filter((s) => s.name)
    .map((s) => ({ value: s.name as string, label: s.name as string }));
  return (
    <Select
      placeholder="Filter Workshift"
      allowClear
      style={{ width: 180 }}
      value={value}
      options={options}
      loading={shiftsQ.isLoading}
      onChange={onChange}
    />
  );
}

function PartSelect({
  tenantId, flowKey, value, onChange,
}: { tenantId: number | null; flowKey: number | null; value?: number | null; onChange: (v: number | null) => void }) {
  // When the user has clicked an equipment, scope the part list to that
  // equipment. With no equipment selected, the cascade hook stays disabled
  // and we render an empty Select — same as legacy.
  const partsQ = useEquipmentParts(tenantId, flowKey);
  const options = (partsQ.data ?? []).map((p) => ({
    value: p.id,
    label: p.partNo ? `${p.partNo} - ${p.name}` : p.name,
  }));
  return (
    <Select
      placeholder="Filter Part"
      allowClear
      style={{ width: 180 }}
      value={value ?? undefined}
      options={options}
      loading={partsQ.isLoading}
      onChange={(v) => onChange(typeof v === 'number' ? v : null)}
      disabled={flowKey == null}
    />
  );
}

function OrderInput({
  value, onChange, onSubmit,
}: { value?: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <Input
      placeholder="Filter Order no"
      style={{ width: 180 }}
      suffix={<SearchOutlined />}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onPressEnter={onSubmit}
      allowClear
    />
  );
}

function FilterBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button
      icon={<FilterOutlined />}
      onClick={onClick}
      type="primary"
      style={{ background: TEAL, borderColor: TEAL }}
      aria-label="Apply filters"
    />
  );
}

// ─── Stop Cause tab ────────────────────────────────────────────────────────

function StopCauseTab({ tenantId, scope, flowId, flowKey, range, draft, onDraft, applied, onApply }: TabProps) {
  const [metric, setMetric] = useState<'all' | 'quantity' | 'time'>('all');
  const filters: AnalyzerFilters = useMemo(
    () => ({ ...applied }),
    [applied],
  );
  const dataQ = useFlowAnalyzerData(scope, flowId, { startDate: range.from, endDate: range.to }, flowKey ?? null, filters);
  const lineQ = useFlowLineChart(scope, flowId, {
    type: 'stop', startDate: range.from, endDate: range.to, flowKey: flowKey ?? null, ...filters,
  });

  const stops = dataQ.data?.stops ?? [];
  const totalQty   = stops.reduce((sum, r) => sum + (r.count ?? 0), 0);
  const totalHours = stops.reduce((sum, r) => sum + Math.round((r.totalMinutes ?? 0) / 60 * 10) / 10, 0);

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <WorkShiftSelect tenantId={tenantId} value={draft.workShift} onChange={(v) => onDraft({ ...draft, workShift: v })} />
        <PartSelect tenantId={tenantId} flowKey={flowKey} value={draft.partId} onChange={(v) => onDraft({ ...draft, partId: v })} />
        <OrderInput value={draft.orderNo} onChange={(v) => onDraft({ ...draft, orderNo: v })} onSubmit={onApply} />
        <Checkbox checked={!!draft.includeExcluded} onChange={(e) => onDraft({ ...draft, includeExcluded: e.target.checked })}>
          Show also excluded types
        </Checkbox>
        <Checkbox checked={!!draft.showUnregistered} onChange={(e) => onDraft({ ...draft, showUnregistered: e.target.checked })}>
          Show Unregistered Stop
        </Checkbox>
        <FilterBtn onClick={onApply} />
      </Space>

      <Title level={5} style={{ textAlign: 'center', marginBottom: 16 }}>All Stop Causes</Title>

      <BarChartCard
        loading={dataQ.isLoading}
        empty={stops.length === 0}
        emptyText="No stop data for this date range"
        options={buildStopBarOptions(stops, metric)}
      />

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '12px 0' }}>
        <Radio.Group value={metric} onChange={(e) => setMetric(e.target.value)}>
          <Radio value="all">All</Radio>
          <Radio value="quantity">Quantity</Radio>
          <Radio value="time">Sum of time (hrs)</Radio>
        </Radio.Group>
        <Text>Total Qty: <Text strong>{totalQty}</Text></Text>
        <Text>Total Hours: <Text strong>{totalHours.toFixed(1)}</Text></Text>
      </div>

      <Title level={5} style={{ textAlign: 'center', marginTop: 24 }}>Stop reason count over time analyze</Title>
      <BarChartCard
        loading={lineQ.isLoading}
        empty={(lineQ.data?.series.length ?? 0) === 0}
        emptyText="No stop data over time"
        options={buildLineOptions(lineQ.data, 'Number of stop count')}
      />
    </div>
  );
}

// ─── Scrap tab ─────────────────────────────────────────────────────────────

function ScrapTab({ tenantId, scope, flowId, flowKey, range, draft, onDraft, applied, onApply }: TabProps) {
  const dataQ = useFlowAnalyzerData(scope, flowId, { startDate: range.from, endDate: range.to }, flowKey ?? null, applied);
  const lineQ = useFlowLineChart(scope, flowId, {
    type: 'scrap', startDate: range.from, endDate: range.to, flowKey: flowKey ?? null, ...applied,
  });
  const scraps = dataQ.data?.scraps ?? [];
  const totalQty = scraps.reduce((sum, r) => sum + (r.totalQty ?? 0), 0);

  return (
    <div>
      <Title level={5} style={{ marginBottom: 8 }}>Scrap Detail</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <WorkShiftSelect tenantId={tenantId} value={draft.workShift} onChange={(v) => onDraft({ ...draft, workShift: v })} />
        <PartSelect tenantId={tenantId} flowKey={flowKey} value={draft.partId} onChange={(v) => onDraft({ ...draft, partId: v })} />
        <OrderInput value={draft.orderNo} onChange={(v) => onDraft({ ...draft, orderNo: v })} onSubmit={onApply} />
        <FilterBtn onClick={onApply} />
      </Space>

      <Title level={5} style={{ textAlign: 'center' }}>Scrap Count</Title>
      <BarChartCard
        loading={dataQ.isLoading}
        empty={scraps.length === 0}
        emptyText="No scrap data for this date range"
        options={buildScrapBarOptions(scraps)}
      />

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '12px 0' }}>
        <Radio.Group value="quantity">
          <Radio value="quantity">Quantity</Radio>
        </Radio.Group>
        <Text>Total Qty: <Text strong>{totalQty}</Text></Text>
      </div>

      <Title level={5} style={{ textAlign: 'center', marginTop: 24 }}>Scrap reason over time analyze</Title>
      <BarChartCard
        loading={lineQ.isLoading}
        empty={(lineQ.data?.series.length ?? 0) === 0}
        emptyText="No scrap data over time"
        options={buildLineOptions(lineQ.data, 'Number of scrap count')}
      />
    </div>
  );
}

// ─── Production tab ───────────────────────────────────────────────────────

function ProductionTab({ tenantId, scope, flowId, flowKey, range, draft, onDraft, applied, onApply }: TabProps) {
  const [metric, setMetric] = useState<'all' | 'ok' | 'planned'>('all');
  const dataQ = useFlowAnalyzerData(scope, flowId, { startDate: range.from, endDate: range.to }, flowKey ?? null, applied);
  const lineQ = useFlowLineChart(scope, flowId, {
    type: 'production', startDate: range.from, endDate: range.to, flowKey: flowKey ?? null, ...applied,
  });
  const prod = dataQ.data?.production ?? [];
  const totalOk      = prod.reduce((sum, r) => sum + (r.okQty ?? 0), 0);
  const totalPlanned = prod.reduce((sum, r) => sum + (r.plannedQty ?? 0), 0);

  return (
    <div>
      <Title level={5} style={{ marginBottom: 8 }}>Production</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <WorkShiftSelect tenantId={tenantId} value={draft.workShift} onChange={(v) => onDraft({ ...draft, workShift: v })} />
        <OrderInput value={draft.orderNo} onChange={(v) => onDraft({ ...draft, orderNo: v })} onSubmit={onApply} />
        <FilterBtn onClick={onApply} />
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Text>Group data by</Text>
        <Select
          value={draft.groupBy ?? 'Part'}
          onChange={(v) => { onDraft({ ...draft, groupBy: v as GroupBy }); }}
          options={[
            { value: 'Part', label: 'Part' },
            { value: 'Equipment', label: 'Equipment' },
            { value: 'WorkShift', label: 'Work Shift' },
            { value: 'Order', label: 'Order' },
          ]}
          style={{ width: 140 }}
        />
      </Space>

      <Title level={5} style={{ textAlign: 'center' }}>Production Output</Title>
      <BarChartCard
        loading={dataQ.isLoading}
        empty={prod.length === 0}
        emptyText="No production data for this date range"
        options={buildProductionBarOptions(prod, metric)}
      />

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '12px 0' }}>
        <Radio.Group value={metric} onChange={(e) => setMetric(e.target.value)}>
          <Radio value="all">All</Radio>
          <Radio value="ok">OK parts qty</Radio>
          <Radio value="planned">Planned Qty</Radio>
        </Radio.Group>
        <Text>Total Ok Qty: <Text strong>{totalOk}</Text></Text>
        <Text>Total Planned Qty: <Text strong>{totalPlanned}</Text></Text>
      </div>

      <Title level={5} style={{ textAlign: 'center', marginTop: 24 }}>Production data over time</Title>
      <BarChartCard
        loading={lineQ.isLoading}
        empty={(lineQ.data?.series.length ?? 0) === 0}
        emptyText="No production data over time"
        options={buildLineOptions(lineQ.data, 'Production count')}
      />
    </div>
  );
}

// ─── HighCharts option builders ────────────────────────────────────────────

function buildStopBarOptions(stops: FlowAnalyzerData['stops'], metric: 'all' | 'quantity' | 'time') {
  return {
    chart: { type: 'column', height: 320 },
    title: { text: '' },
    credits: { enabled: false },
    xAxis: {
      categories: stops.map((s) => s.stopReasonName ?? '(unregistered)'),
      title: { text: '' },
    },
    yAxis: [
      { title: { text: 'Quantity' }, opposite: false, min: 0 },
      { title: { text: 'Time (hrs)' }, opposite: true, min: 0 },
    ],
    legend: { enabled: true },
    plotOptions: { column: { borderWidth: 0 } },
    series: [
      {
        name: 'Quantity',
        type: 'column',
        yAxis: 0,
        color: '#00b4d8',
        data: stops.map((s) => s.count ?? 0),
        visible: metric !== 'time',
      },
      {
        name: 'Sum of time (hrs)',
        type: 'column',
        yAxis: 1,
        color: '#e91e8c',
        data: stops.map((s) => Number(((s.totalMinutes ?? 0) / 60).toFixed(1))),
        visible: metric !== 'quantity',
      },
    ],
  };
}

function buildScrapBarOptions(scraps: FlowAnalyzerData['scraps']) {
  return {
    chart: { type: 'column', height: 320 },
    title: { text: '' },
    credits: { enabled: false },
    xAxis: {
      categories: scraps.map((s) => s.scrapReasonName ?? '(unknown)'),
      title: { text: '' },
    },
    yAxis: [
      { title: { text: 'Quantity' }, opposite: false, min: 0 },
      { title: { text: '' }, opposite: true, min: 0, max: 100, labels: { format: '{value}%' } },
    ],
    legend: { enabled: true },
    series: [
      { name: 'Quantity', type: 'column', yAxis: 0, color: '#00b4d8', data: scraps.map((s) => s.totalQty ?? 0) },
    ],
  };
}

function buildProductionBarOptions(prod: FlowAnalyzerData['production'], metric: 'all' | 'ok' | 'planned') {
  return {
    chart: { type: 'column', height: 320 },
    title: { text: '' },
    credits: { enabled: false },
    xAxis: {
      categories: prod.map((p) => p.label || '—'),
      title: { text: '' },
    },
    yAxis: [
      { title: { text: 'OK parts qty' }, opposite: false, min: 0 },
      { title: { text: 'Planned Qty' }, opposite: true, min: 0 },
    ],
    legend: { enabled: true },
    series: [
      {
        name: 'OK parts qty', type: 'column', yAxis: 0, color: '#00b4d8',
        data: prod.map((p) => p.okQty ?? 0),
        visible: metric !== 'planned',
      },
      {
        name: 'Planned Qty', type: 'column', yAxis: 1, color: '#e91e8c',
        data: prod.map((p) => p.plannedQty ?? 0),
        visible: metric !== 'ok',
      },
    ],
  };
}

function buildLineOptions(data: { categories: string[]; series: Array<{ name: string; data: number[] }> } | undefined, yAxisTitle: string) {
  return {
    chart: { type: 'line', height: 320 },
    title: { text: '' },
    credits: { enabled: false },
    xAxis: { categories: data?.categories ?? [] },
    yAxis: { title: { text: yAxisTitle }, min: 0 },
    legend: { enabled: true },
    series: (data?.series ?? []).map((s, i) => ({
      ...s,
      type: 'line',
      color: ['#00b4d8', '#e91e8c', '#5c6bc0', '#ff9800', '#4caf50', '#9c27b0'][i % 6],
    })),
  };
}

// ─── BarChartCard — handles loading + empty states ─────────────────────────

function BarChartCard({
  loading, empty, emptyText, options,
}: { loading: boolean; empty: boolean; emptyText: string; options: object }) {
  // Highcharts touches `window` at import time, so we lazy-require it on
  // the client. Next dynamic() handles the React side; the highcharts
  // module itself is fetched via require() at runtime.
  const Highcharts = (typeof window !== 'undefined') ? require('highcharts') : null;
  return (
    <Card size="small" styles={{ body: { padding: 12 } }}>
      {loading ? <Skeleton active />
        : empty ? <Empty description={emptyText} />
        : Highcharts ? <HighchartsReact highcharts={Highcharts} options={options} /> : null}
    </Card>
  );
}

// ─── Top-level page (route entry) ─────────────────────────────────────────

export default function FlowAnalyzerPage() {
  const routeParams = useParams<{ id?: string[] }>();
  const urlFlowId = routeParams?.id?.[0] ? Number(routeParams.id[0]) : null;
  if (urlFlowId === null) return <FlowAnalyzerGrid />;
  return <FlowAnalyzerDetail flowId={urlFlowId} />;
}

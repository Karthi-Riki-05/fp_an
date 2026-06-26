'use client';

import { CalendarOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Card, DatePicker, Empty, List, Skeleton, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useMe } from '../../../../lib/api/auth';
import { useRecentHistory, type HistoryRow } from '../../../../lib/api/recent-history';
import { useOee } from '../../../../lib/api/oee';
import { useDashboardChart, toChartPoints } from '../../../../lib/api/dashboard-chart';
import { useAlerts } from '../../../../lib/api/alerts';
import { useAdminMachines } from '../../../../lib/api/admin-machines';
import { useLiveMachines } from '../../../../hooks/useLiveMachine';

const { Title, Text } = Typography;

const BRAND = '#01b9d0';
const SUCCESS = '#00a65a';
const ERROR = '#dd4b39';
const WARN = '#f39c12';
const PURPLE = '#954cfe';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';

// @ant-design/plots is heavy + client-only. Lazy-load with SSR off.
const Line = dynamic(
  () => import('@ant-design/plots').then((mod) => ({ default: mod.Line })),
  { ssr: false, loading: () => <Skeleton.Image style={{ width: '100%', height: 220 }} active /> },
);

type MachineVisualState = 'running' | 'stopped' | 'warning';
const STATE_COLOR: Record<MachineVisualState, string> = { running: SUCCESS, stopped: ERROR, warning: WARN };
const STATE_LABEL: Record<MachineVisualState, string> = { running: 'Running', stopped: 'Stopped', warning: 'Warning' };

// ---------- presentational pieces (mockup) ----------

function StatCard({ topColor, value, label }: { topColor: string; value: React.ReactNode; label: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 16, borderTop: `3px solid ${topColor}`, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 26, fontWeight: 800, color: topColor, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** 60px SVG circular gauge. stroke-dashoffset = 157 * (1 - value/100). */
function Gauge({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 25;
  const circ = 2 * Math.PI * r; // ≈157
  const v = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - v / 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={60} height={60} viewBox="0 0 60 60">
        <circle cx={30} cy={30} r={r} fill="none" stroke="#f0f0f0" strokeWidth={5} />
        <circle
          cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
        <text x={30} y={34} textAnchor="middle" style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 800, fill: '#262626' }}>
          {Math.round(v)}%
        </text>
      </svg>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MachineCard({ name, state, sub }: { name: string; state: MachineVisualState; sub?: string }) {
  const color = STATE_COLOR[state];
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 12, borderLeft: `4px solid ${color}`, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{STATE_LABEL[state]}</span>
        {sub ? <span style={{ fontSize: 10, color: '#8c8c8c' }}>· {sub}</span> : null}
      </div>
    </div>
  );
}

// ---------- Super Admin recent-history feed (unchanged) ----------

function historyIcon(row: HistoryRow): React.ReactNode {
  const t = row.text.toLowerCase();
  if (t.includes('password')) return <KeyOutlined />;
  if (t.includes('impersonat')) return <UserOutlined />;
  return <UserOutlined />;
}

function RecentHistoryFeed() {
  const { data, isLoading, isError } = useRecentHistory({ limit: 50 });
  if (isLoading) {
    return <Card style={{ borderRadius: 8 }}><Skeleton active paragraph={{ rows: 8 }} /></Card>;
  }
  if (isError || !data) return <Empty description="Could not load recent history." />;
  if (data.items.length === 0) return <Empty description="No activity yet." />;
  return (
    <Card title={<span style={{ fontSize: 18, fontWeight: 600 }}>Recent History</span>} style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
      <List
        dataSource={data.items}
        renderItem={(row) => (
          <List.Item style={{ padding: '14px 24px' }}>
            <List.Item.Meta
              avatar={<Avatar style={{ background: BRAND }} icon={historyIcon(row)} />}
              title={
                <span style={{ fontSize: 13 }}>
                  <strong>{row.actorName}</strong>{' '}
                  <span style={{ color: '#666', fontWeight: 400 }}>{row.text.replace(/^\[impersonating[^\]]+\]\s*/, '')}</span>
                  {row.text.startsWith('[impersonating') && <Tag color="orange" style={{ marginLeft: 8 }}>impersonation</Tag>}
                </span>
              }
              description={<span style={{ fontSize: 11, color: '#999' }}>{row.createdAt ? dayjs(row.createdAt).fromNow() : ''} · {row.entityType}</span>}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

// ---------- page ----------

export default function AdminDashboardPage() {
  const { data: me } = useMe();
  const [from, setFrom] = useState<Dayjs>(dayjs().subtract(90, 'day').startOf('day'));
  const [to,   setTo]   = useState<Dayjs>(dayjs().endOf('day'));

  const tenant = me?.tenants.find((t) => t.id === me.activeTenantId) ?? me?.tenants[0];
  const t = useTranslations('texts');

  const { data: oee, isLoading: oeeLoading } = useOee({
    from: from.format('YYYY-MM-DD'),
    to: to.format('YYYY-MM-DD'),
    enabled: !me?.isAdmin,
  });
  const { data: chart, isLoading: chartLoading } = useDashboardChart({
    from: from.format('YYYY-MM-DD'),
    to: to.format('YYYY-MM-DD'),
    enabled: !me?.isAdmin,
  });
  // Today-scoped OEE → its inputs.actualQty is today's good-part total.
  const todayStr = dayjs().format('YYYY-MM-DD');
  const { data: todayOee } = useOee({ from: todayStr, to: todayStr, enabled: !me?.isAdmin });
  const { data: adminMachines } = useAdminMachines();
  const { data: alerts } = useAlerts({ enabled: !me?.isAdmin });
  const live = useLiveMachines();
  const data = toChartPoints(chart);

  const PRODUCTION_TARGET = 2000;
  const todayProduction = todayOee?.inputs.actualQty ?? 0;
  const todayScrap = todayOee?.inputs.scrapQty ?? 0;
  const productionPct = Math.min(100, Math.round((todayProduction / PRODUCTION_TARGET) * 100));

  const SEVERITY_COLOR: Record<string, string> = { critical: ERROR, warning: WARN, info: BRAND };

  // 10s-polled machine list (useAdminMachines), with live socket status
  // layered on top for instant running/stopped flips.
  const machines = useMemo(() => {
    return (adminMachines ?? []).map((m) => {
      const liveRunning = live[m.id]?.runningStatus;
      let state: MachineVisualState = m.status;
      if (state !== 'warning' && liveRunning) state = liveRunning === 'on' ? 'running' : 'stopped';
      return { id: m.id, name: m.name, state, unreg: m.unregisteredCount };
    });
  }, [adminMachines, live]);

  const machinesTotal = machines.length;
  const runningCount = machines.filter((m) => m.state === 'running').length;
  const downtimeHrs = ((oee?.inputs.downtimeMinutes ?? 0) / 60).toFixed(1);
  const openAlerts = alerts?.unread ?? 0;

  const shiftLabel = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Night';
    if (h < 14) return 'Morning';
    if (h < 22) return 'Afternoon';
    return 'Night';
  })();

  // Super Admin keeps the platform activity feed.
  if (me?.isAdmin) {
    return (
      <div>
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>{t('welcome_back')} <span style={{ fontWeight: 700 }}>{me.name}</span></Title>
        <Text type="secondary" style={{ fontSize: 12 }}>{t('platform_activity_feed')}</Text>
        <div style={{ marginTop: 20 }}><RecentHistoryFeed /></div>
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ margin: 0, fontWeight: 500 }}>{t('welcome_back')} <span style={{ fontWeight: 700 }}>{tenant?.name ?? me?.name ?? '…'}</span></Title>
      <Text type="secondary" style={{ fontSize: 12 }}>{t('administrative_overview')} {tenant ? `· ${tenant.timezone}` : ''}</Text>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT COLUMN */}
        <div style={{ flex: 1, minWidth: 320 }}>
          {/* 1. Stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <StatCard topColor={BRAND}   value={oeeLoading ? '…' : `${oee?.oee ?? 0}%`} label="OEE" />
            <StatCard topColor={SUCCESS} value={`${runningCount}/${machinesTotal}`} label="Machines Running" />
            <StatCard topColor={WARN}    value={`${downtimeHrs}h`} label="Downtime (range)" />
            <StatCard topColor={ERROR}   value={openAlerts} label="Open Alerts" />
          </div>

          {/* 2. OEE gauges card */}
          <div style={{ background: 'white', borderRadius: 8, padding: 20, marginTop: 16, boxShadow: CARD_SHADOW }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 13, fontWeight: 700, color: '#262626', marginBottom: 16 }}>OEE Breakdown</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
              <Gauge value={oee?.oee ?? 0}          color={BRAND}   label="OEE" />
              <Gauge value={oee?.availability ?? 0} color={SUCCESS} label="Availability" />
              <Gauge value={oee?.performance ?? 0}  color={WARN}    label="Performance" />
              <Gauge value={oee?.quality ?? 0}      color={PURPLE}  label="Quality" />
            </div>
          </div>

          {/* 3. Machine status grid */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 13, fontWeight: 700, color: '#262626', marginBottom: 10 }}>Machine Status</div>
            {machinesTotal === 0 ? (
              <div style={{ background: 'white', borderRadius: 8, padding: 24, boxShadow: CARD_SHADOW, textAlign: 'center', color: '#8c8c8c', fontSize: 13 }}>
                No machines connected
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {machines.map((m) => (
                  <MachineCard key={m.id} name={m.name} state={m.state} sub={m.state === 'warning' && m.unreg > 0 ? `${m.unreg} unreg.` : undefined} />
                ))}
              </div>
            )}
          </div>

          {/* 4. Flow analyzer trend (retained) */}
          <Card
            title={<span style={{ fontSize: 16, fontWeight: 600 }}>{t('flow_analyzer')}</span>}
            style={{ marginTop: 16, borderRadius: 8 }}
            bodyStyle={{ padding: 16 }}
            extra={
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <DatePicker value={from} onChange={(v) => v && setFrom(v.startOf('day'))} suffixIcon={<CalendarOutlined />} allowClear={false} size="small" />
                <DatePicker value={to}   onChange={(v) => v && setTo(v.endOf('day'))}   suffixIcon={<CalendarOutlined />} allowClear={false} size="small" />
              </span>
            }
          >
            {chartLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <Line
                data={data}
                xField="date" yField="value" colorField="series" seriesField="series"
                color={[BRAND, ERROR, WARN]} smooth point={{ size: 3, shape: 'circle' }}
                xAxis={{ tickCount: 4 }} legend={{ position: 'top-right' }} height={240}
              />
            )}
          </Card>
        </div>

        {/* RIGHT PANEL (240px) */}
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recent events */}
          <div style={{ background: 'white', borderRadius: 8, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626', padding: '12px 14px', borderBottom: '1px solid #f0f0f0' }}>Recent Events</div>
            {alerts?.items?.length ? (
              alerts.items.slice(0, 6).map((a) => (
                <div key={`${a.type}-${a.id}`} style={{ display: 'flex', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f7f7f7' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: SEVERITY_COLOR[a.severity] ?? WARN }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.machineName}</span>
                      {a.createdAt && <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{dayjs(a.createdAt).fromNow()}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>No recent events</div>
            )}
          </div>

          {/* Today's production */}
          <div style={{ background: 'white', borderRadius: 8, boxShadow: CARD_SHADOW, padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>Today&apos;s Production</div>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 28, fontWeight: 800, color: BRAND, lineHeight: 1.1, marginTop: 4 }}>{todayProduction}</div>
            <div style={{ fontSize: 10, color: '#8c8c8c' }}>good parts · {todayScrap} scrap · target {PRODUCTION_TARGET}</div>
            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${productionPct}%`, background: BRAND }} />
            </div>
            <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>{productionPct}% of daily target</div>
          </div>

          {/* Current shift */}
          <div style={{ background: 'white', borderRadius: 8, boxShadow: CARD_SHADOW, padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>Current Shift</div>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 18, fontWeight: 800, color: '#262626', marginTop: 4 }}>{shiftLabel}</div>
            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{dayjs().format('ddd, D MMM YYYY')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

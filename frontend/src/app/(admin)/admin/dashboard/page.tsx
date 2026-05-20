'use client';

import {
  CalendarOutlined,
  DesktopOutlined,
  KeyOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Card, Col, DatePicker, Empty, List, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '../../../../lib/api/auth';
import { useRecentHistory, type HistoryRow } from '../../../../lib/api/recent-history';

const { Title, Text } = Typography;

// @ant-design/plots is heavy + client-only. Lazy-load with SSR off.
const Line = dynamic(
  () => import('@ant-design/plots').then((mod) => ({ default: mod.Line })),
  { ssr: false, loading: () => <Skeleton.Image style={{ width: '100%', height: 220 }} active /> },
);

/* ----------------------------------------------------------------------
 * Mock metrics. Phase 4b.x replaces with real /api/v1/admin/dashboard
 * endpoint that aggregates KPIs from production_data, scrap_data,
 * stop_data, flow_designs.
 * -------------------------------------------------------------------- */

const KPIS = {
  flowMonitor: 11,
  productionEntries: 3,
  stopEntries: 693,
};

const ANALYTICS = {
  totalProduction: 157,
  totalScrap: 31,
  totalStopMinutes: 83,
};

// Mock daily series — Phase 4b.x switches to real query.
function mockSeries(from: Dayjs, to: Dayjs) {
  const data: Array<{ date: string; series: 'Production' | 'Scrap' | 'Stop'; value: number }> = [];
  const days = Math.min(120, to.diff(from, 'day') + 1);
  for (let i = 0; i < days; i++) {
    const d = from.add(i, 'day').format('YYYY-MM-DD');
    data.push({ date: d, series: 'Production', value: Math.round(Math.random() * 8) });
    data.push({ date: d, series: 'Scrap',      value: Math.random() < 0.85 ? Math.round(Math.random() * 4) : Math.round(20 + Math.random() * 100) });
    data.push({ date: d, series: 'Stop',       value: Math.round(Math.random() * 5) });
  }
  return data;
}

interface KpiCardProps {
  title: string;
  value: number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
}

function KpiCard({ title, value, unit, icon, color, href }: KpiCardProps) {
  const inner = (
    <Card
      hoverable={Boolean(href)}
      bodyStyle={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}
      style={{ borderRadius: 8, border: '1px solid #eef0f3' }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: `${color}1a`, // 10% alpha tint
          color,
          display: 'grid',
          placeItems: 'center',
          fontSize: 26,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{title}</div>
        <div style={{ fontSize: 26, fontWeight: 600, color, lineHeight: 1.2, marginTop: 2 }}>
          {value} <span style={{ fontSize: 13, fontWeight: 400, color: '#888' }}>{unit}</span>
        </div>
      </div>
    </Card>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

function historyIcon(row: HistoryRow): React.ReactNode {
  // Map text fragments → icons. Light heuristic; legacy used CSS class names.
  const t = row.text.toLowerCase();
  if (t.includes('password')) return <KeyOutlined />;
  if (t.includes('impersonat')) return <UserOutlined />;
  return <UserOutlined />;
}

function RecentHistoryFeed() {
  const { data, isLoading, isError } = useRecentHistory({ limit: 50 });
  if (isLoading) {
    return (
      <Card style={{ borderRadius: 8 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }
  if (isError || !data) {
    return <Empty description="Could not load recent history." />;
  }
  if (data.items.length === 0) {
    return <Empty description="No activity yet." />;
  }
  return (
    <Card title={<span style={{ fontSize: 18, fontWeight: 600 }}>Recent History</span>} style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
      <List
        dataSource={data.items}
        renderItem={(row) => (
          <List.Item style={{ padding: '14px 24px' }}>
            <List.Item.Meta
              avatar={<Avatar style={{ background: '#01b9d0' }} icon={historyIcon(row)} />}
              title={
                <span style={{ fontSize: 13 }}>
                  <strong>{row.actorName}</strong>{' '}
                  <span style={{ color: '#666', fontWeight: 400 }}>{row.text.replace(/^\[impersonating[^\]]+\]\s*/, '')}</span>
                  {row.text.startsWith('[impersonating') && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>impersonation</Tag>
                  )}
                </span>
              }
              description={
                <span style={{ fontSize: 11, color: '#999' }}>
                  {row.createdAt ? dayjs(row.createdAt).fromNow() : ''} · {row.entityType}
                </span>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data: me, isLoading } = useMe();
  const [from, setFrom] = useState<Dayjs>(dayjs().subtract(90, 'day').startOf('day'));
  const [to,   setTo]   = useState<Dayjs>(dayjs().endOf('day'));

  // activeTenantId: for Company users = their own user.id;
  //                 for sub-Users = their companyId (the Company user's id);
  //                 for Administrators = the X-Tenant-Id header value (Company user id).
  // `tenants[]` is a one-row synthetic array — see MIGRATION_NOTES §13.
  const tenant = me?.tenants.find((t) => t.id === me.activeTenantId) ?? me?.tenants[0];
  const data = mockSeries(from, to);
  const t = useTranslations('texts');

  // Super Admin gets the Recent History feed (matches legacy "Adminpanelen" screen).
  // Tenant admin gets the KPI + analyzer dashboard.
  if (me?.isAdmin) {
    return (
      <div>
        <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          {t('welcome_back')} <span style={{ fontWeight: 700 }}>{me.name}</span>
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('platform_activity_feed')}
        </Text>
        <div style={{ marginTop: 20 }}>
          <RecentHistoryFeed />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
        {t('welcome_back')} <span style={{ fontWeight: 700 }}>{tenant?.name ?? me?.name ?? '…'}</span>
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('administrative_overview')} {tenant ? `· ${tenant.timezone}` : ''}
      </Text>

      {/* ----- KPI cards ----- */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('flow_monitor')}
            value={KPIS.flowMonitor}
            icon={<DesktopOutlined />}
            color="#01b9d0"
            href="/admin/monitor"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('production_data')}
            value={KPIS.productionEntries}
            unit={t('entries')}
            icon={<PlayCircleOutlined />}
            color="#f39c12"
            href="/admin/results/production"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard
            title={t('stop_data')}
            value={KPIS.stopEntries}
            unit={t('entries')}
            icon={<PauseCircleOutlined />}
            color="#dd4b39"
            href="/admin/results/stop"
          />
        </Col>
      </Row>

      {/* ----- Flow Analyzer ----- */}
      <Card
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>{t('flow_analyzer')}</span>}
        style={{ marginTop: 24, borderRadius: 8 }}
        bodyStyle={{ padding: 0 }}
      >
        {isLoading ? (
          <div style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 5 }} />
          </div>
        ) : (
          <Row gutter={0} style={{ minHeight: 280 }}>
            <Col xs={24} md={8} style={{ borderRight: '1px solid #eef0f3', padding: 24 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, fontSize: 13, color: '#666' }}>{t('from')}</span>
                  <DatePicker
                    value={from}
                    onChange={(v) => v && setFrom(v.startOf('day'))}
                    suffixIcon={<CalendarOutlined />}
                    allowClear={false}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, fontSize: 13, color: '#666' }}>{t('to')}</span>
                  <DatePicker
                    value={to}
                    onChange={(v) => v && setTo(v.endOf('day'))}
                    suffixIcon={<CalendarOutlined />}
                    allowClear={false}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginTop: 12, borderTop: '1px solid #eef0f3', paddingTop: 16 }}>
                  <Statistic title={t('total_production')} value={ANALYTICS.totalProduction} valueStyle={{ color: '#01b9d0', fontSize: 22 }} />
                  <Statistic title={t('total_scrap_data')} value={ANALYTICS.totalScrap} valueStyle={{ color: '#f39c12', fontSize: 22 }} style={{ marginTop: 8 }} />
                  <Statistic title={t('total_stop_times')} value={ANALYTICS.totalStopMinutes} suffix={t('mins')} valueStyle={{ color: '#dd4b39', fontSize: 22 }} style={{ marginTop: 8 }} />
                </div>
              </Space>
            </Col>
            <Col xs={24} md={16} style={{ padding: 24 }}>
              <Line
                data={data}
                xField="date"
                yField="value"
                colorField="series"
                seriesField="series"
                color={['#01b9d0', '#dd4b39', '#f39c12']}
                smooth
                point={{ size: 3, shape: 'circle' }}
                xAxis={{ tickCount: 4 }}
                legend={{ position: 'top-right' }}
                height={260}
              />
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
}

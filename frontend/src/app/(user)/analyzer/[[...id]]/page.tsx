'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Card, Empty, Skeleton, Space, Table, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import FlowAnalyzerCharts from '../../../../components/flow/FlowAnalyzerCharts';
import FlowCardGrid from '../../../../components/flow/FlowCardGrid';
import GoJsLicensePlaceholder from '../../../../components/flow/GoJsLicensePlaceholder';
import { DateRangeStrip } from '../../../../components/result/DateRangeStrip';
import { useMe } from '../../../../lib/api/auth';
import { useFlowAnalyzerData, useFlowDesign, useFlowDesignsList } from '../../../../lib/api/flow-designs';

const { Title, Text } = Typography;

function FlowAnalyzerGrid() {
  const router = useRouter();
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const flows = useFlowDesignsList(scope);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/dashboard" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={3} style={{ margin: 0 }}>Flow Analyzer</Title>
      </div>
      <FlowCardGrid
        flows={flows.data ?? []}
        onFlowClick={(id) => router.push(`/analyzer/${id}`)}
        title={`${flows.data?.length ?? 0} active flow${(flows.data?.length ?? 0) === 1 ? '' : 's'}`}
      />
    </div>
  );
}

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function FlowAnalyzerDetail({ flowId }: { flowId: number }) {
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const [range, setRange] = useState<{ from: string; to: string }>({ from: todayYMD(), to: todayYMD() });

  const flowQ = useFlowDesign(scope, flowId);
  const analyzerQ = useFlowAnalyzerData(scope, flowId, { startDate: range.from, endDate: range.to });

  const stopRows = analyzerQ.data?.stops ?? [];
  const scrapRows = analyzerQ.data?.scraps ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/analyzer" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={3} style={{ margin: 0 }}>
          {flowQ.data?.name ?? `Flow #${flowId}`}
        </Title>
      </div>

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
        <DateRangeStrip
          value={range}
          onChange={(from, to) => setRange({ from, to })}
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16, marginBottom: 16 }}>
        <Card size="small" title="Flow diagram" styles={{ body: { padding: 12 } }}>
          <GoJsLicensePlaceholder width="100%" height={400} />
        </Card>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="Recent stops" styles={{ body: { padding: 12 } }}>
            {analyzerQ.isLoading ? <Skeleton active /> : stopRows.length === 0 ? (
              <Empty description="No stop data for this date range" />
            ) : (
              <Table
                rowKey={(r, idx) => `${r.equipmentId}-${r.stopReasonId ?? 'unknown'}-${idx ?? 0}`}
                size="small"
                pagination={{ pageSize: 5 }}
                dataSource={stopRows}
                columns={[
                  { title: 'Equipment ID', dataIndex: 'equipmentId', width: 110 },
                  { title: 'Reason', dataIndex: 'stopReasonName', render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
                  { title: 'Count', dataIndex: 'count', width: 70, align: 'right' },
                  { title: 'Total min', dataIndex: 'totalMinutes', width: 100, align: 'right' },
                ]}
              />
            )}
          </Card>
          <Card size="small" title="Recent scraps" styles={{ body: { padding: 12 } }}>
            {analyzerQ.isLoading ? <Skeleton active /> : scrapRows.length === 0 ? (
              <Empty description="No scrap data for this date range" />
            ) : (
              <Table
                rowKey={(r, idx) => `${r.equipmentId}-${r.scrapReasonId ?? 'unknown'}-${idx ?? 0}`}
                size="small"
                pagination={{ pageSize: 5 }}
                dataSource={scrapRows}
                columns={[
                  { title: 'Equipment ID', dataIndex: 'equipmentId', width: 110 },
                  { title: 'Reason', dataIndex: 'scrapReasonName', render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
                  { title: 'Count', dataIndex: 'count', width: 70, align: 'right' },
                  { title: 'Total qty', dataIndex: 'totalQty', width: 90, align: 'right' },
                ]}
              />
            )}
          </Card>
        </Space>
      </div>

      <FlowAnalyzerCharts scope={scope} flowId={flowId} range={{ startDate: range.from, endDate: range.to }} />
    </div>
  );
}

export default function FlowAnalyzerPage() {
  const routeParams = useParams<{ id?: string[] }>();
  const urlFlowId = routeParams?.id?.[0] ? Number(routeParams.id[0]) : null;
  if (urlFlowId === null) return <FlowAnalyzerGrid />;
  return <FlowAnalyzerDetail flowId={urlFlowId} />;
}

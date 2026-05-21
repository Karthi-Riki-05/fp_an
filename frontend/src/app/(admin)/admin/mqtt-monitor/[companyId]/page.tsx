'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeftOutlined, WifiOutlined } from '@ant-design/icons';
import {
  Badge,
  Breadcrumb,
  Card,
  Col,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient, toApiError } from '../../../../../lib/api-client';
import {
  useAdminSocketStore,
  type AdminLiveMachineState,
} from '../../../../../lib/store/adminSocketStore';

const { Title, Text } = Typography;

interface MachineRow {
  machineId: number;
  unitName: string;
  pinNo: number;
  runningStatus: string;
  unitConnected: string;
  lastOnline: string | null;
  equipmentId: number;
  equipmentName: string | null;
  mqttClientId: string | null;
  hasUnregisterData: string;
}

function useMachines(companyId: number) {
  return useQuery({
    queryKey: ['superadmin', 'companies', companyId, 'machines'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MachineRow[]; total: number; companyId: number }>(
        `/superadmin/companies/${companyId}/machines`,
      );
      return data;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

function useCompanyInfo(companyId: number) {
  return useQuery({
    queryKey: ['superadmin', 'company', companyId],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: Array<{ id: number; name: string; email: string }>;
      }>('/superadmin/companies');
      return data.data.find((c) => c.id === companyId) ?? null;
    },
    staleTime: 60_000,
  });
}

function StatusTag({ status }: { status: string }) {
  const t = useTranslations('texts');
  return status === 'on' ? (
    <Tag color="green">{t('status_on')}</Tag>
  ) : (
    <Tag color="red">{t('status_off')}</Tag>
  );
}

function ConnectedTag({ connected }: { connected: string }) {
  return connected === 'yes' ? (
    <Badge status="success" text="Yes" />
  ) : (
    <Badge status="error" text="No" />
  );
}

export default function CompanyEquipmentPage({
  params,
}: {
  params: { companyId: string };
}) {
  const companyId = Number(params.companyId);
  const t = useTranslations('texts');

  const { data, isLoading, error } = useMachines(companyId);
  const { data: companyInfo } = useCompanyInfo(companyId);
  const liveStore = useAdminSocketStore((s) => s.machines);
  const socketConnected = useAdminSocketStore((s) => s.socketConnected);
  const connectedTenantIds = useAdminSocketStore((s) => s.connectedTenantIds);

  const tenantJoined = connectedTenantIds.includes(companyId);

  // Merge REST data with live Socket.io state.
  const machines: (MachineRow & { live?: AdminLiveMachineState })[] = (data?.data ?? []).map(
    (m) => {
      const liveKey = `${companyId}:${m.machineId}`;
      return { ...m, live: liveStore[liveKey] };
    },
  );

  const runningCount = machines.filter(
    (m) => (m.live?.runningStatus ?? m.runningStatus) === 'on',
  ).length;
  const stoppedCount = machines.filter(
    (m) => (m.live?.runningStatus ?? m.runningStatus) === 'off',
  ).length;
  const connectedCount = machines.filter(
    (m) => (m.live?.unitConnected ?? m.unitConnected) === 'yes',
  ).length;

  const columns: ColumnsType<MachineRow & { live?: AdminLiveMachineState }> = [
    { title: 'ID', dataIndex: 'machineId', width: 70 },
    {
      title: t('unit_name'),
      dataIndex: 'unitName',
      render: (name: string, row) => (
        <span>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>pin {row.pinNo}</Text>
        </span>
      ),
    },
    {
      title: t('equipment'),
      dataIndex: 'equipmentName',
      render: (name: string | null) =>
        name ? (
          <Tag>{name}</Tag>
        ) : (
          <Text type="secondary">{t('unconfigured')}</Text>
        ),
    },
    {
      title: t('running_status'),
      key: 'runningStatus',
      render: (_: unknown, row) => {
        const status = row.live?.runningStatus ?? row.runningStatus;
        const isLive = !!row.live;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusTag status={status} />
            {isLive && (
              <Badge
                status="processing"
                style={{ fontSize: 10 }}
                text={<Text style={{ fontSize: 10 }}>{t('live')}</Text>}
              />
            )}
          </span>
        );
      },
    },
    {
      title: t('unit_connected'),
      key: 'unitConnected',
      render: (_: unknown, row) => {
        const connected = row.live?.unitConnected ?? row.unitConnected;
        return <ConnectedTag connected={connected} />;
      },
    },
    {
      title: t('last_online'),
      key: 'lastOnline',
      render: (_: unknown, row) => {
        const ts = row.live?.lastOnline ?? row.lastOnline;
        if (!ts) return <Text type="secondary">–</Text>;
        return (
          <Text style={{ fontSize: 12 }}>
            {new Date(ts).toLocaleString()}
          </Text>
        );
      },
    },
    {
      title: t('mqtt_id'),
      dataIndex: 'mqttClientId',
      render: (id: string | null) =>
        id ? (
          <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{id}</Tag>
        ) : (
          <Text type="secondary">–</Text>
        ),
    },
    {
      title: 'Open Stop',
      key: 'openStop',
      render: (_: unknown, row) => {
        const stop = row.live?.openStop;
        if (!stop) return <Text type="secondary">–</Text>;
        return (
          <Tag color="orange" style={{ fontSize: 11 }}>
            Since {new Date(stop.startTime).toLocaleTimeString()}
          </Tag>
        );
      },
    },
  ];

  if (error) {
    return (
      <Card>
        <Text type="danger">{toApiError(error).message}</Text>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[
          { title: <Link href="/admin/mqtt-monitor">{t('mqtt_monitor')}</Link> },
          { title: companyInfo?.name ?? `Company ${companyId}` },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <Link href="/admin/mqtt-monitor" style={{ marginRight: 10 }}>
            <ArrowLeftOutlined />
          </Link>
          {companyInfo?.name ?? `Company ${companyId}`}
        </Title>
        <Tag
          color={tenantJoined ? 'green' : 'default'}
          icon={<WifiOutlined />}
        >
          {tenantJoined ? t('socket_connected') : t('socket_disconnected')}
        </Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title={t('status_on')} value={runningCount} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title={t('status_off')} value={stoppedCount} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title={t('unit_connected')} value={connectedCount} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={machines}
          columns={columns}
          rowKey="machineId"
          loading={isLoading}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          size="middle"
          rowClassName={(row) => {
            const status = row.live?.runningStatus ?? row.runningStatus;
            return status === 'off' ? 'row-stopped' : '';
          }}
        />
      </Card>
    </div>
  );
}

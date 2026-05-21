'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Card, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { WifiOutlined } from '@ant-design/icons';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useAdminSocketStore } from '../../../../lib/store/adminSocketStore';

const { Title, Text } = Typography;

interface CompanyRow {
  id: number;
  name: string;
  email: string;
  status: number;
  createdAt: string;
  machineCount: number;
}

function useCompanies() {
  return useQuery({
    queryKey: ['superadmin', 'companies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CompanyRow[]; total: number }>(
        '/superadmin/companies',
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export default function MqttMonitorPage() {
  const t = useTranslations('texts');
  const { data, isLoading, error } = useCompanies();
  const connectedTenantIds = useAdminSocketStore((s) => s.connectedTenantIds);
  const socketConnected = useAdminSocketStore((s) => s.socketConnected);
  const allMachines = useAdminSocketStore((s) => s.machines);

  const columns: ColumnsType<CompanyRow> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: t('company'),
      dataIndex: 'name',
      render: (name: string, row) => (
        <Link href={`/admin/mqtt-monitor/${row.id}`} style={{ fontWeight: 500 }}>
          {name}
        </Link>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('email'),
      dataIndex: 'email',
      render: (e: string) => <Text type="secondary">{e}</Text>,
    },
    {
      title: t('machine_count'),
      dataIndex: 'machineCount',
      width: 110,
      render: (count: number) => <Tag>{count}</Tag>,
      sorter: (a, b) => a.machineCount - b.machineCount,
    },
    {
      title: t('live'),
      key: 'live',
      width: 120,
      render: (_: unknown, row) => {
        const joined = connectedTenantIds.includes(row.id);
        const tenantMachines = Object.values(allMachines).filter((m) => m.tenantId === row.id);
        const running = tenantMachines.filter((m) => m.runningStatus === 'on').length;
        const stopped = tenantMachines.filter((m) => m.runningStatus === 'off').length;
        return joined ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Badge status="success" text={<Text style={{ fontSize: 12 }}>{running} on</Text>} />
            <Badge status="error" text={<Text style={{ fontSize: 12 }}>{stopped} off</Text>} />
          </span>
        ) : (
          <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>–</Text>} />
        );
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, row) => (
        <Link href={`/admin/mqtt-monitor/${row.id}`}>
          <Tag color="blue" style={{ cursor: 'pointer' }}>View</Tag>
        </Link>
      ),
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
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <WifiOutlined style={{ marginRight: 8, color: '#01b9d0' }} />
          {t('mqtt_monitor')}
        </Title>
        <Tag
          color={socketConnected ? 'green' : 'default'}
          icon={<WifiOutlined />}
          style={{ fontSize: 13 }}
        >
          {socketConnected
            ? t('joined_tenants').replace('{count}', String(connectedTenantIds.length))
            : t('socket_disconnected')}
        </Tag>
      </div>

      <Card>
        <Table
          dataSource={data?.data ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          size="middle"
          onRow={(row) => ({
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
}

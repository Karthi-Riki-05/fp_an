'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  BugOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HeartOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { apiClient, toApiError } from '../../../../lib/api-client';
import {
  useAdminSocketStore,
  type AdminLiveMachineState,
} from '../../../../lib/store/adminSocketStore';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface CompanyRow {
  id: number;
  name: string;
  email: string;
  machineCount: number;
}

interface MachineRow {
  machineId: number;
  unitName: string;
  pinNo: number;
  runningStatus: string;
  unitConnected: string;
  lastOnline: string | null;
  equipmentName: string | null;
  mqttClientId: string | null;
}

interface ActionResult {
  success: boolean;
  topic: string;
  payload: Record<string, unknown>;
  timestamp: string;
  action: string;
  machineId: number;
  companyId: number;
}

function useCompanies() {
  return useQuery({
    queryKey: ['superadmin', 'companies'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CompanyRow[] }>('/superadmin/companies');
      return data;
    },
    staleTime: 30_000,
  });
}

function useMachines(companyId: number | null) {
  return useQuery({
    queryKey: ['superadmin', 'companies', companyId, 'machines'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MachineRow[] }>(
        `/superadmin/companies/${companyId}/machines`,
      );
      return data;
    },
    enabled: !!companyId,
    staleTime: 10_000,
  });
}

function useTestAction() {
  return useMutation({
    mutationFn: async (params: {
      companyId: number;
      machineId: number;
      action: 'stop_start' | 'stop_end' | 'heartbeat';
    }) => {
      const { data } = await apiClient.post<{
        success: boolean;
        topic: string;
        payload: Record<string, unknown>;
      }>('/superadmin/test/machine-action', params);
      return data;
    },
  });
}

function ActionLog({ log }: { log: ActionResult[] }) {
  if (log.length === 0) return null;
  return (
    <Card size="small" title="Action Log" style={{ marginTop: 16 }}>
      {[...log].reverse().slice(0, 10).map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid #f0f0f0',
            fontSize: 12,
          }}
        >
          <Text type="secondary">{entry.timestamp}</Text>
          <Tag
            color={
              entry.action === 'stop_start' ? 'red' :
              entry.action === 'stop_end'   ? 'green' :
              'blue'
            }
          >
            {entry.action}
          </Tag>
          <Text>Company {entry.companyId} / Machine {entry.machineId}</Text>
          <Text type="secondary" style={{ fontFamily: 'monospace' }}>
            → {entry.topic}
          </Text>
        </div>
      ))}
    </Card>
  );
}

export default function MqttTestingPage() {
  const t = useTranslations('texts');
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [actionLog, setActionLog] = useState<ActionResult[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const { data: companiesData, isLoading: companiesLoading } = useCompanies();
  const { data: machinesData, isLoading: machinesLoading } = useMachines(selectedCompany);
  const testAction = useTestAction();

  const liveStore = useAdminSocketStore((s) => s.machines);
  const socketConnected = useAdminSocketStore((s) => s.socketConnected);
  const connectedTenantIds = useAdminSocketStore((s) => s.connectedTenantIds);

  async function handleAction(
    machineId: number,
    action: 'stop_start' | 'stop_end' | 'heartbeat',
  ) {
    if (!selectedCompany) return;
    setLastError(null);
    try {
      const result = await testAction.mutateAsync({
        companyId: selectedCompany,
        machineId,
        action,
      });
      setActionLog((prev) => [
        ...prev,
        {
          ...result,
          timestamp: new Date().toLocaleTimeString(),
          action,
          machineId,
          companyId: selectedCompany,
        },
      ]);
    } catch (err) {
      setLastError(toApiError(err).message);
    }
  }

  const machines: (MachineRow & { live?: AdminLiveMachineState })[] = (
    machinesData?.data ?? []
  ).map((m) => ({
    ...m,
    live: selectedCompany ? liveStore[`${selectedCompany}:${m.machineId}`] : undefined,
  }));

  const columns: ColumnsType<MachineRow & { live?: AdminLiveMachineState }> = [
    { title: 'ID', dataIndex: 'machineId', width: 60 },
    {
      title: 'Machine',
      key: 'name',
      render: (_: unknown, row) => (
        <span>
          <Text strong>{row.unitName}</Text>
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>pin {row.pinNo}</Text>
        </span>
      ),
    },
    {
      title: t('running_status'),
      key: 'status',
      width: 140,
      render: (_: unknown, row) => {
        const status = row.live?.runningStatus ?? row.runningStatus;
        const isLive = !!row.live;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag color={status === 'on' ? 'green' : 'red'}>
              {status === 'on' ? t('status_on') : t('status_off')}
            </Tag>
            {isLive && <Badge status="processing" />}
          </span>
        );
      },
    },
    {
      title: t('unit_connected'),
      key: 'connected',
      width: 100,
      render: (_: unknown, row) => {
        const c = row.live?.unitConnected ?? row.unitConnected;
        return <Badge status={c === 'yes' ? 'success' : 'error'} text={c} />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_: unknown, row) => {
        const loading = testAction.isPending;
        const status = row.live?.runningStatus ?? row.runningStatus;
        const canTurnOff = status === 'on';
        const canTurnOn  = status === 'off' && (row.live?.openStop != null ||
          row.runningStatus === 'off');

        return (
          <Space size="small">
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              danger
              disabled={loading}
              onClick={() => handleAction(row.machineId, 'stop_start')}
              title="Simulate machine stopping (publishes stop/start)"
            >
              {t('turn_off')}
            </Button>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              type="primary"
              disabled={loading}
              onClick={() => handleAction(row.machineId, 'stop_end')}
              style={{ background: '#3f8600', borderColor: '#3f8600' }}
              title="Simulate machine restart (publishes stop/end)"
            >
              {t('turn_on')}
            </Button>
            <Button
              size="small"
              icon={<HeartOutlined />}
              disabled={loading}
              onClick={() => handleAction(row.machineId, 'heartbeat')}
              title="Simulate heartbeat (updates last_online)"
            >
              {t('heartbeat')}
            </Button>
          </Space>
        );
      },
    },
    {
      title: t('last_online'),
      key: 'lastOnline',
      width: 140,
      render: (_: unknown, row) => {
        const ts = row.live?.lastOnline ?? row.lastOnline;
        if (!ts) return <Text type="secondary">–</Text>;
        return <Text style={{ fontSize: 11 }}>{new Date(ts).toLocaleString()}</Text>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BugOutlined style={{ marginRight: 8, color: '#01b9d0' }} />
          {t('mqtt_testing')}
        </Title>
        <Tag
          color={socketConnected ? 'green' : 'default'}
          icon={<WifiOutlined />}
        >
          {socketConnected
            ? `Socket: ${connectedTenantIds.length} tenants`
            : t('socket_disconnected')}
        </Tag>
      </div>

      <Paragraph type="secondary">
        Simulate MQTT events for any machine. Actions exercise the full pipeline:
        MQTT handler → database write → Socket.io emit → real-time dashboard update.
      </Paragraph>

      {lastError && (
        <Alert
          type="error"
          message={lastError}
          closable
          onClose={() => setLastError(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Select Company:</Text>
          <Select
            style={{ width: 280 }}
            placeholder={t('select_company')}
            loading={companiesLoading}
            value={selectedCompany}
            onChange={setSelectedCompany}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={(companiesData?.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.name} (ID: ${c.id})`,
            }))}
          />
          {selectedCompany && connectedTenantIds.includes(selectedCompany) && (
            <Badge status="success" text={<Text style={{ fontSize: 12 }}>Live</Text>} />
          )}
        </Space>
      </Card>

      {selectedCompany && (
        <Card>
          <Table
            dataSource={machines}
            columns={columns}
            rowKey="machineId"
            loading={machinesLoading || testAction.isPending}
            pagination={{ pageSize: 30, hideOnSinglePage: true }}
            size="middle"
          />
        </Card>
      )}

      <ActionLog log={actionLog} />
    </div>
  );
}

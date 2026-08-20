'use client';

import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApiOutlined,
  PlusOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SettingOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useMe } from '../../../../../lib/api/auth';
import { toApiError } from '../../../../../lib/api-client';
import {
  useMqttUnits,
  useProvisionUnit,
  useRebootUnit,
  useRevokeUnit,
  useSendUnitConfig,
  type MqttUnitRow,
  type UnitCredentials,
} from '../../../../../lib/api/admin-iot-mqtt';
import { useIotFleet } from '../../../../../hooks/useIotFleet';

const { Title, Text, Paragraph } = Typography;

const UNIT_NAME_RE = /^[A-Za-z0-9._-]{1,50}$/;
const PINS = ['1', '2', '3', '4'] as const;

function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}

export default function IotUnitsPage() {
  const { message, modal } = App.useApp();
  const { data: me, isLoading: meLoading } = useMe();
  const tenantId = me?.activeTenantId ?? null;

  const [provisionForm] = Form.useForm();
  const [configForm] = Form.useForm();
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [credentials, setCredentials] = useState<UnitCredentials | null>(null);
  const [configTarget, setConfigTarget] = useState<string | null>(null);

  const units = useMqttUnits(tenantId);
  const provision = useProvisionUnit(tenantId);
  const revoke = useRevokeUnit(tenantId);
  const sendConfig = useSendUnitConfig(tenantId);
  const reboot = useRebootUnit(tenantId);
  const { units: live, gaps, connected } = useIotFleet();

  const rows = useMemo(() => units.data ?? [], [units.data]);
  const onlineCount = useMemo(
    () => rows.filter((r) => live[r.unitName]?.online).length,
    [rows, live],
  );

  async function onProvision(values: { unitName: string }) {
    try {
      const creds = await provision.mutateAsync({ unitName: values.unitName.trim() });
      setProvisionOpen(false);
      provisionForm.resetFields();
      setCredentials(creds);
    } catch (e) {
      message.error(toApiError(e).message);
    }
  }

  function confirmRevoke(unitName: string) {
    modal.confirm({
      title: `Revoke ${unitName}?`,
      icon: <StopOutlined style={{ color: '#cf1322' }} />,
      content:
        'The unit is disconnected and cannot reconnect. It stops reporting immediately. ' +
        'Re-provisioning issues a new password that must be entered on the device.',
      okText: 'Revoke',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await revoke.mutateAsync(unitName);
          message.success(`${unitName} revoked`);
        } catch (e) {
          message.error(toApiError(e).message);
        }
      },
    });
  }

  async function onSendConfig(values: any) {
    if (!configTarget) return;
    try {
      await sendConfig.mutateAsync({
        unitName: configTarget,
        off_on_ms: values.off_on_ms ?? undefined,
        on_off_ms: values.on_off_ms ?? undefined,
        pins: Object.fromEntries(PINS.map((p) => [p, values[`pin_${p}`] !== false])),
      });
      message.success(`Settings sent to ${configTarget}`);
      setConfigTarget(null);
      configForm.resetFields();
    } catch (e) {
      message.error(toApiError(e).message);
    }
  }

  function confirmReboot(unitName: string) {
    modal.confirm({
      title: `Reboot ${unitName}?`,
      icon: <PoweroffOutlined />,
      content: 'The unit restarts after 5 seconds. Machine monitoring pauses until it is back.',
      okText: 'Reboot',
      onOk: async () => {
        try {
          await reboot.mutateAsync({ unitName, delaySeconds: 5 });
          message.success(`Reboot sent to ${unitName}`);
        } catch (e) {
          message.error(toApiError(e).message);
        }
      },
    });
  }

  const columns: ColumnsType<MqttUnitRow> = [
    {
      title: 'Unit',
      dataIndex: 'unitName',
      render: (name: string, row) => {
        const l = live[name];
        return (
          <Space direction="vertical" size={0}>
            <Space size={6}>
              <Text strong>{name}</Text>
              {row.disabled && <Tag color="red">Revoked</Tag>}
              {(l?.droppedCount ?? 0) > 0 && (
                <Tooltip title={`${l!.droppedCount} events dropped — the unit's local buffer overflowed`}>
                  <Tag color="orange" icon={<WarningOutlined />}>{l!.droppedCount} dropped</Tag>
                </Tooltip>
              )}
              {(l?.driftPins?.length ?? 0) > 0 && (
                <Tooltip title={`Pins ${l!.driftPins!.join(', ')} report a different state than the database — events were lost`}>
                  <Tag color="orange" icon={<WarningOutlined />}>State drift</Tag>
                </Tooltip>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{row.username}</Text>
          </Space>
        );
      },
      sorter: (a, b) => a.unitName.localeCompare(b.unitName),
    },
    {
      title: 'Connection',
      width: 160,
      render: (_, row) => {
        const l = live[row.unitName];
        if (l?.online === undefined) {
          return (
            <Tooltip title="No presence message received since this page loaded">
              <Badge status="default" text="Unknown" />
            </Tooltip>
          );
        }
        if (l.online) return <Badge status="success" text="Online" />;
        return (
          <Tooltip title={l.reason === 'lwt' ? 'Dropped without disconnecting cleanly' : `Reason: ${l.reason}`}>
            <Badge status="error" text="Offline" />
          </Tooltip>
        );
      },
    },
    {
      title: 'Firmware',
      dataIndex: 'firmware',
      width: 110,
      render: (fw: string | null, row) => {
        const v = live[row.unitName]?.firmware ?? fw;
        return v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Last seen',
      dataIndex: 'lastSeenAt',
      width: 130,
      render: (iso: string | null) => <Text type="secondary">{relativeTime(iso)}</Text>,
      sorter: (a, b) =>
        new Date(a.lastSeenAt ?? 0).getTime() - new Date(b.lastSeenAt ?? 0).getTime(),
    },
    {
      title: '',
      width: 230,
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            disabled={row.disabled}
            onClick={() => { setConfigTarget(row.unitName); configForm.resetFields(); }}
          >
            Settings
          </Button>
          <Button
            size="small"
            icon={<PoweroffOutlined />}
            disabled={row.disabled}
            onClick={() => confirmReboot(row.unitName)}
          >
            Reboot
          </Button>
          <Button size="small" danger disabled={row.disabled} onClick={() => confirmRevoke(row.unitName)}>
            Revoke
          </Button>
        </Space>
      ),
    },
  ];

  if (meLoading) return <Spin style={{ display: 'block', marginTop: 40 }} />;
  if (!tenantId) {
    return <Alert type="info" showIcon message="Pick a company first"
      description="Units are provisioned per company." />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>IoT units</Title>
        <Text type="secondary">
          One unit is one Raspberry Pi. Each carries up to four machines on pins 1–4 over a
          single connection, so credentials and settings belong to the unit, not the machine.
        </Text>
      </div>

      {gaps.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Missing events detected"
          description={
            <Space direction="vertical" size={2}>
              {gaps.slice(0, 5).map((g, i) => (
                <Text key={i} style={{ fontSize: 13 }}>
                  <b>{g.unitName}</b> — {g.missing} event{g.missing === 1 ? '' : 's'} never
                  arrived for machine {g.machineId}. Downtime figures for that machine will be short.
                </Text>
              ))}
            </Space>
          }
        />
      )}

      <Card
        title={
          <Space>
            <ApiOutlined />
            Fleet
            <Tag color={connected ? 'green' : 'default'}>{connected ? 'Live' : 'Not connected'}</Tag>
            <Text type="secondary" style={{ fontWeight: 400 }}>
              {onlineCount} of {rows.length} online
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => units.refetch()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setProvisionOpen(true)}>
              Add unit
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="username"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={units.isLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No units yet. Add one to generate its broker credentials.' }}
        />
      </Card>

      <Modal
        title="Add unit"
        open={provisionOpen}
        onCancel={() => setProvisionOpen(false)}
        onOk={() => provisionForm.submit()}
        confirmLoading={provision.isPending}
        okText="Generate credentials"
        destroyOnClose
      >
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          The unit name becomes part of the unit&apos;s MQTT address, so it must stay the same
          for the life of the device.
        </Paragraph>
        <Form form={provisionForm} layout="vertical" onFinish={onProvision} requiredMark={false}>
          <Form.Item
            name="unitName"
            label="Unit name"
            rules={[
              { required: true, message: 'Unit name is required' },
              { pattern: UNIT_NAME_RE, message: 'Up to 50 characters: letters, numbers, dot, underscore, hyphen' },
            ]}
          >
            <Input placeholder="UNIT-01" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Credentials for this unit"
        open={credentials !== null}
        onCancel={() => setCredentials(null)}
        footer={<Button type="primary" onClick={() => setCredentials(null)}>I have saved these</Button>}
        width={620}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="The password is shown once"
          description="It is not stored in recoverable form. If it is lost, add the unit again to issue a new one."
        />
        {credentials && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Broker">
              <Text code copyable>{credentials.brokerUrl ?? 'mqtts://<host>:8883'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Username">
              <Text code copyable>{credentials.username}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Client ID">
              <Space direction="vertical" size={0}>
                <Text code copyable>{credentials.clientId}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Must match the username exactly, or the broker refuses the connection.
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Password">
              <Text code copyable>{credentials.password}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Topics">
              <Text code copyable>{credentials.topicPrefix}/…</Text>
            </Descriptions.Item>
            <Descriptions.Item label="CA certificate">
              <Text type="secondary" style={{ fontSize: 13 }}>
                Copy <Text code>ca.crt</Text> to the device as{' '}
                <Text code>/etc/fpanalyzer/ca.crt</Text>.
              </Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={`Settings — ${configTarget ?? ''}`}
        open={configTarget !== null}
        onCancel={() => setConfigTarget(null)}
        onOk={() => configForm.submit()}
        confirmLoading={sendConfig.isPending}
        okText="Send to unit"
        destroyOnClose
      >
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          Settings are stored on the broker, so a unit that is offline picks them up as soon
          as it reconnects.
        </Paragraph>
        <Form form={configForm} layout="vertical" onFinish={onSendConfig} requiredMark={false}>
          <Form.Item
            name="off_on_ms"
            label="Ignore stops shorter than (ms)"
            extra="Stops below this are treated as signal noise, not real downtime."
          >
            <InputNumber min={0} max={60_000} style={{ width: '100%' }} placeholder="100" />
          </Form.Item>
          <Form.Item
            name="on_off_ms"
            label="Ignore restarts shorter than (ms)"
          >
            <InputNumber min={0} max={60_000} style={{ width: '100%' }} placeholder="100" />
          </Form.Item>
          {PINS.map((p) => (
            <Form.Item key={p} name={`pin_${p}`} label={`Pin ${p}`} valuePropName="checked" initialValue>
              <Switch checkedChildren="Active" unCheckedChildren="Off" />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Space>
  );
}

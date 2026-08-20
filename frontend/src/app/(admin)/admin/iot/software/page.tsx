'use client';

import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloudUploadOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMe } from '../../../../../lib/api/auth';
import { toApiError } from '../../../../../lib/api-client';
import {
  useFirmwareRelease,
  useOtaStatus,
  usePublishRelease,
  usePushOta,
  type OtaState,
  type OtaStatusRow,
} from '../../../../../lib/api/admin-iot-mqtt';
import { useIotFleet } from '../../../../../hooks/useIotFleet';

const { Title, Text, Paragraph } = Typography;

const SHA256_RE = /^[0-9a-f]{64}$/i;

const OTA_STAGE: Record<OtaState, { pct: number; color: string; label: string }> = {
  downloading: { pct: 25, color: 'blue', label: 'Downloading' },
  verifying: { pct: 55, color: 'geekblue', label: 'Verifying' },
  applying: { pct: 80, color: 'orange', label: 'Applying' },
  success: { pct: 100, color: 'green', label: 'Installed' },
  failed: { pct: 100, color: 'red', label: 'Failed' },
};

function formatBytes(n: number | null | undefined) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export default function IotFirmwarePage() {
  const t = useTranslations('texts');
  const { message, modal } = App.useApp();
  const { data: me, isLoading: meLoading } = useMe();
  const tenantId = me?.activeTenantId ?? null;

  const [form] = Form.useForm();
  const [publishOpen, setPublishOpen] = useState(false);

  // Hooks must run before any early return, so the tenant guard sits below them.
  const release = useFirmwareRelease();
  const publish = usePublishRelease();
  const otaStatus = useOtaStatus(tenantId);
  const pushOta = usePushOta(tenantId);
  const { units: live, connected } = useIotFleet();

  const current = release.data?.data ?? null;
  const otaReady = release.data?.otaReady ?? false;

  // Live socket state wins over the polled snapshot — OTA steps arrive as the
  // device reports them, well before the next refetch.
  const rows = useMemo<OtaStatusRow[]>(() => {
    const base = otaStatus.data ?? [];
    return base.map((r) => {
      const l = live[r.unitName];
      return l?.otaState
        ? { ...r, otaState: l.otaState, otaVersion: l.otaVersion ?? r.otaVersion,
            otaDetail: l.otaDetail ?? r.otaDetail,
            otaUpdatedAt: l.otaTs ? new Date(l.otaTs).toISOString() : r.otaUpdatedAt }
        : r;
    });
  }, [otaStatus.data, live]);

  const upToDate = rows.filter((r) => current && r.firmware === current.version).length;

  async function onPublish(values: any) {
    try {
      await publish.mutateAsync({
        version: values.version.trim(),
        url: values.url.trim(),
        sha256: values.sha256.trim().toLowerCase(),
        size: values.size ?? null,
        notes: values.notes ?? '',
        mandatory: values.mandatory === true,
      });
      message.success(`Release ${values.version} published`);
      setPublishOpen(false);
      form.resetFields();
    } catch (e) {
      message.error(toApiError(e).message);
    }
  }

  function confirmPush(unitName?: string) {
    const target = unitName ?? `all ${rows.filter((r) => !r.disabled).length} units`;
    modal.confirm({
      title: `Send firmware ${current?.version} to ${target}?`,
      content: unitName
        ? 'The unit downloads the package, verifies its SHA-256, installs it and reboots.'
        : 'Every enabled unit downloads the package, verifies its SHA-256, installs it and reboots. Units that are offline receive the command when they reconnect.',
      okText: 'Send update',
      onOk: async () => {
        try {
          const res = await pushOta.mutateAsync({ unitName });
          const d = res.data;
          if (unitName) message.success(`Update sent to ${unitName}`);
          else if (d.failed?.length) {
            message.warning(`Sent to ${d.sent} of ${d.total} units — ${d.failed.length} failed`);
          } else {
            message.success(`Update sent to all ${d.sent} units`);
          }
        } catch (e) {
          message.error(toApiError(e).message);
        }
      },
    });
  }

  const columns: ColumnsType<OtaStatusRow> = [
    {
      title: 'Unit',
      dataIndex: 'unitName',
      render: (name: string, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {row.disabled && <Tag color="red">Revoked</Tag>}
        </Space>
      ),
      sorter: (a, b) => a.unitName.localeCompare(b.unitName),
    },
    {
      title: 'Connection',
      width: 130,
      render: (_, row) => {
        const l = live[row.unitName];
        const online = l?.online;
        if (online === undefined) {
          return <Tag>Unknown</Tag>;
        }
        return online
          ? <Tag color="green">Online</Tag>
          : <Tooltip title={l?.reason === 'lwt' ? 'Dropped without disconnecting' : l?.reason}>
              <Tag color="default">Offline</Tag>
            </Tooltip>;
      },
    },
    {
      title: 'Firmware',
      dataIndex: 'firmware',
      width: 150,
      render: (fw: string | null) => {
        if (!fw) return <Text type="secondary">—</Text>;
        const isCurrent = current && fw === current.version;
        return <Tag color={isCurrent ? 'green' : 'orange'}>{fw}</Tag>;
      },
      sorter: (a, b) => (a.firmware ?? '').localeCompare(b.firmware ?? ''),
    },
    {
      title: 'Update progress',
      width: 260,
      render: (_, row) => {
        if (!row.otaState) return <Text type="secondary">—</Text>;
        const stage = OTA_STAGE[row.otaState];
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Progress
              percent={stage.pct}
              size="small"
              status={row.otaState === 'failed' ? 'exception' : row.otaState === 'success' ? 'success' : 'active'}
              format={() => stage.label}
            />
            {row.otaDetail && (
              <Text type={row.otaState === 'failed' ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                {row.otaDetail}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          disabled={!otaReady || row.disabled}
          onClick={() => confirmPush(row.unitName)}
        >
          Send update
        </Button>
      ),
    },
  ];

  if (meLoading) return <Spin style={{ display: 'block', marginTop: 40 }} />;
  if (!tenantId) {
    return (
      <Alert
        type="info"
        showIcon
        message="Pick a company first"
        description="Firmware releases are global, but the fleet rollout view needs a company context."
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>IoT firmware</Title>
        <Text type="secondary">
          Publish a firmware release and roll it out to the Raspberry Pi fleet over MQTT.
        </Text>
      </div>

      {!otaReady && (
        <Alert
          type="warning"
          showIcon
          message="No release available to send"
          description={
            current
              ? 'The current release has no SHA-256 checksum, so it cannot be sent over the air. Publish a release below with a checksum.'
              : 'Publish a firmware release before sending updates to units.'
          }
        />
      )}

      <Card
        title={<Space><SafetyCertificateOutlined />Current release</Space>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => release.refetch()} />
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setPublishOpen(true)}>
              Publish release
            </Button>
          </Space>
        }
        loading={release.isLoading}
      >
        {current ? (
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
            <Descriptions.Item label="Version">
              <Tag color="blue">{current.version}</Tag>
              {current.mandatory && <Tag color="red">Mandatory</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Size">{formatBytes(current.size)}</Descriptions.Item>
            <Descriptions.Item label="Package URL" span={2}>
              <Text code copyable style={{ fontSize: 12 }}>{current.url}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="SHA-256" span={2}>
              {current.sha256
                ? <Text code copyable style={{ fontSize: 12 }}>{current.sha256}</Text>
                : <Text type="danger">Missing — cannot be sent over the air</Text>}
            </Descriptions.Item>
            {current.notes && (
              <Descriptions.Item label="Notes" span={2}>{current.notes}</Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          <Text type="secondary">No release published yet.</Text>
        )}
      </Card>

      <Card
        title={
          <Space>
            Fleet
            <Tag color={connected ? 'green' : 'default'}>
              {connected ? 'Live' : 'Not connected'}
            </Tag>
            {current && (
              <Text type="secondary" style={{ fontWeight: 400 }}>
                {upToDate} of {rows.length} on {current.version}
              </Text>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => otaStatus.refetch()} />
            <Button
              type="primary"
              disabled={!otaReady || rows.length === 0}
              loading={pushOta.isPending}
              onClick={() => confirmPush()}
            >
              Send to all units
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="unitName"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={otaStatus.isLoading}
          pagination={false}
          locale={{ emptyText: 'No units provisioned yet.' }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="Publish firmware release"
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={publish.isPending}
        okText="Publish"
        width={640}
        destroyOnClose
      >
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          The checksum is required. Units refuse to install a package whose SHA-256 does
          not match, which is what stops a tampered package from being installed as root.
        </Paragraph>
        <Form form={form} layout="vertical" onFinish={onPublish} requiredMark={false}>
          <Form.Item
            name="version"
            label="Version"
            rules={[
              { required: true, message: 'Version is required' },
              { pattern: /^\d+(\.\d+){0,3}$/, message: 'Use numbers and dots, e.g. 2.1.8' },
            ]}
          >
            <Input placeholder="2.1.8" />
          </Form.Item>

          <Form.Item
            name="url"
            label="Package URL"
            rules={[
              { required: true, message: 'URL is required' },
              { pattern: /^https:\/\//i, message: 'Must start with https://' },
            ]}
          >
            <Input placeholder="https://api.fptest.com/downloads/fp_2.1.8.zip" />
          </Form.Item>

          <Form.Item
            name="sha256"
            label="SHA-256 checksum"
            extra="Produce it with: shasum -a 256 fp_2.1.8.zip"
            rules={[
              { required: true, message: 'Checksum is required' },
              { pattern: SHA256_RE, message: 'Must be 64 hexadecimal characters' },
            ]}
          >
            <Input placeholder="e3b0c44298fc1c149afbf4c8996fb924…" />
          </Form.Item>

          <Form.Item name="size" label="Size in bytes" extra="Optional. Units treat it as an upper bound while downloading.">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="10485760" />
          </Form.Item>

          <Form.Item name="notes" label="Release notes">
            <Input.TextArea rows={3} placeholder="What changed in this version" />
          </Form.Item>

          <Form.Item name="mandatory" valuePropName="checked">
            <Checkbox>Mandatory — units should install without waiting for an operator</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

'use client';

import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useState } from 'react';
import { FlowCanvasPlaceholder, type FlowEdge, type FlowNode } from '../../../../components/flow/FlowCanvasPlaceholder';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------------- *
 * Mock data — Phase 4b binds this to /api/v1/flow-monitor/list +
 * /api/v1/flow-designs/:id/monitor with 10s polling per §16 R5.
 * ------------------------------------------------------------------------- */

const FLOWS = [
  { id: 'flow-1', name: 'Machining Line 1' },
  { id: 'flow-2', name: 'Assembly Line 1' },
];

const NODES: FlowNode[] = [
  { id: 'n1', label: 'CNC-01',  x: 0.15, y: 0.3, status: 'running' },
  { id: 'n2', label: 'CNC-02',  x: 0.40, y: 0.3, status: 'warning' },
  { id: 'n3', label: 'Robot-A', x: 0.65, y: 0.3, status: 'stopped' },
  { id: 'n4', label: 'Press-1', x: 0.85, y: 0.55, status: 'idle' },
  { id: 'n5', label: 'QA-1',    x: 0.40, y: 0.7, status: 'running' },
];

const EDGES: FlowEdge[] = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n3', to: 'n4' },
  { from: 'n2', to: 'n5' },
];

const KPIS = {
  oee:          78.4,
  availability: 92.1,
  performance:  88.6,
  quality:      96.0,
  shift:        'Day shift (06:00–14:00)',
  partsOk:      1240,
  partsScrap:   18,
};

/* ------------------------------------------------------------------------- */

function statusTag(status: FlowNode['status']) {
  const map: Record<FlowNode['status'], { color: string; label: string; icon: React.ReactNode }> = {
    running: { color: 'success',         label: 'Running', icon: <PlayCircleOutlined /> },
    idle:    { color: 'default',         label: 'Idle',    icon: <ClockCircleOutlined /> },
    stopped: { color: 'error',           label: 'Stopped', icon: <PauseCircleOutlined /> },
    warning: { color: 'warning',         label: 'Warning', icon: <WarningOutlined /> },
    offline: { color: 'default',         label: 'Offline', icon: <PauseCircleOutlined /> },
  };
  const { color, label, icon } = map[status];
  return <Tag color={color} icon={icon}>{label}</Tag>;
}

export default function FlowMonitorPage() {
  const { message } = App.useApp();
  const [flowId, setFlowId] = useState(FLOWS[0].id);
  const [selectedId, setSelectedId] = useState<string | null>('n2');
  const [openModal, setOpenModal] = useState<null | 'production' | 'scrap' | 'stop'>(null);
  const [form] = Form.useForm();

  const selected = NODES.find((n) => n.id === selectedId) ?? null;

  const submit = (kind: 'production' | 'scrap' | 'stop') => {
    form
      .validateFields()
      .then(() => {
        message.success(`(mock) ${kind} registered for ${selected?.label}`);
        setOpenModal(null);
        form.resetFields();
      })
      .catch(() => undefined);
  };

  return (
    <div>
      {/* page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <Space size="middle">
          <Link href="/dashboard" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
            <ArrowLeftOutlined />
          </Link>
          <Title level={3} style={{ margin: 0 }}>Flow Monitor</Title>
        </Space>
        <Space wrap>
          <Select
            value={flowId}
            onChange={setFlowId}
            style={{ minWidth: 220 }}
            options={FLOWS.map((f) => ({ value: f.id, label: f.name }))}
            aria-label="Select flow"
          />
          <Button icon={<FileExcelOutlined />}>Export</Button>
        </Space>
      </div>

      {/* main layout: canvas + side panel */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={17}>
          <Card bodyStyle={{ padding: 12 }}>
            <FlowCanvasPlaceholder
              nodes={NODES}
              edges={EDGES}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Card>
        </Col>
        <Col xs={24} lg={7}>
          <Card title={selected ? selected.label : 'Selected node'} size="small">
            {selected ? (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>{statusTag(selected.status)}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Click a node in the canvas to switch context.
                </Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Button block type="primary" onClick={() => setOpenModal('production')}>
                    Register production
                  </Button>
                </Space.Compact>
                <Space.Compact style={{ width: '100%' }}>
                  <Button block onClick={() => setOpenModal('scrap')}>
                    Register scrap
                  </Button>
                </Space.Compact>
                <Space.Compact style={{ width: '100%' }}>
                  <Button block danger onClick={() => setOpenModal('stop')}>
                    Register stop
                  </Button>
                </Space.Compact>
                <Card
                  size="small"
                  bordered={false}
                  style={{ background: '#fafafa', marginTop: 8 }}
                  bodyStyle={{ padding: 12 }}
                >
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Last 5 stops
                  </Text>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }}>
                    <li>09:42 · Tool change · 4m</li>
                    <li>08:18 · Material loading · 2m</li>
                    <li>07:55 · Quality issue · 6m</li>
                    <li>07:30 · Operator break · 10m</li>
                    <li>06:48 · Setup · 12m</li>
                  </ul>
                </Card>
              </Space>
            ) : (
              <Empty description="No node selected" />
            )}
          </Card>
        </Col>
      </Row>

      {/* KPI strip */}
      <Card>
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic
              title="OEE"
              value={KPIS.oee}
              suffix="%"
              precision={1}
              valueStyle={{ color: KPIS.oee >= 80 ? '#00a65a' : KPIS.oee >= 60 ? '#f39c12' : '#dd4b39' }}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Availability" value={KPIS.availability} suffix="%" precision={1} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Performance" value={KPIS.performance} suffix="%" precision={1} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Quality" value={KPIS.quality} suffix="%" precision={1} />
          </Col>
        </Row>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> {KPIS.shift}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Parts OK: <Text strong>{KPIS.partsOk}</Text> · Scrap: <Text strong>{KPIS.partsScrap}</Text>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Auto-refresh: 10s
          </Text>
        </div>
      </Card>

      {/* Modals */}
      <Modal
        title={`Register production — ${selected?.label ?? ''}`}
        open={openModal === 'production'}
        onCancel={() => setOpenModal(null)}
        onOk={() => submit('production')}
        okText="Register"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="quantity" label="OK quantity" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item name="orderNo" label="Order #">
            <Input placeholder="optional" />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Register scrap — ${selected?.label ?? ''}`}
        open={openModal === 'scrap'}
        onCancel={() => setOpenModal(null)}
        onOk={() => submit('scrap')}
        okText="Register"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="quantity" label="Scrap quantity" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select placeholder="Pick a scrap reason" options={[
              { value: 'wrong-spec',     label: 'Wrong spec' },
              { value: 'tool-wear',      label: 'Tool wear' },
              { value: 'material-fault', label: 'Material fault' },
              { value: 'operator-error', label: 'Operator error' },
            ]} />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Register stop — ${selected?.label ?? ''}`}
        open={openModal === 'stop'}
        onCancel={() => setOpenModal(null)}
        onOk={() => submit('stop')}
        okText="Register"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="duration" label="Duration (minutes)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select placeholder="Pick a stop reason" options={[
              { value: 'tool-change',     label: 'Tool change' },
              { value: 'material',        label: 'Material loading' },
              { value: 'quality',         label: 'Quality issue' },
              { value: 'break',           label: 'Operator break' },
              { value: 'setup',           label: 'Setup / changeover' },
            ]} />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

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
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FlowCanvasPlaceholder, type FlowEdge, type FlowNode } from '../../../../components/flow/FlowCanvasPlaceholder';
import FlowCardGrid from '../../../../components/flow/FlowCardGrid';
import GoJsLicensePlaceholder from '../../../../components/flow/GoJsLicensePlaceholder';
import { useMe } from '../../../../lib/api/auth';
import {
  decodeReasonValue,
  groupReasonsForSelect,
  useEquipmentParts,
  useEquipmentScrapReasons,
  useEquipmentStopReasons,
  useFlowDesignsList,
} from '../../../../lib/api/monitor';
import { useFlowDesignsList as useFlowDesignsListV2, useFlowMonitorStatus } from '../../../../lib/api/flow-designs';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------------- *
 * MOCK canvas data — Phase 4b binds NODES/EDGES to the real flow_data
 * (GoJS nodeDataArray) once the canvas is wired per §16 R5. Each NODE will
 * then carry `equipmentId` pointing at a real Equipment.id, which the
 * register-scrap / register-stop modals cascade off.
 * ------------------------------------------------------------------------- */

const NODES: FlowNode[] = [
  { id: 'n1', label: 'CNC-01',  x: 0.15, y: 0.3,  status: 'running' },
  { id: 'n2', label: 'CNC-02',  x: 0.40, y: 0.3,  status: 'warning' },
  { id: 'n3', label: 'Robot-A', x: 0.65, y: 0.3,  status: 'stopped' },
  { id: 'n4', label: 'Press-1', x: 0.85, y: 0.55, status: 'idle'    },
  { id: 'n5', label: 'QA-1',    x: 0.40, y: 0.7,  status: 'running' },
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
    running: { color: 'success', label: 'Running', icon: <PlayCircleOutlined /> },
    idle:    { color: 'default', label: 'Idle',    icon: <ClockCircleOutlined /> },
    stopped: { color: 'error',   label: 'Stopped', icon: <PauseCircleOutlined /> },
    warning: { color: 'warning', label: 'Warning', icon: <WarningOutlined /> },
    offline: { color: 'default', label: 'Offline', icon: <PauseCircleOutlined /> },
  };
  const { color, label, icon } = map[status];
  return <Tag color={color} icon={icon}>{label}</Tag>;
}

function FlowMonitorGrid() {
  const router = useRouter();
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const gridFlows = useFlowDesignsListV2(scope);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/dashboard" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
          <ArrowLeftOutlined />
        </Link>
        <Title level={3} style={{ margin: 0 }}>Flow Monitor</Title>
      </div>
      <FlowCardGrid
        flows={gridFlows.data ?? []}
        onFlowClick={(id) => router.push(`/monitor/${id}`)}
        title={`${gridFlows.data?.length ?? 0} active flow${(gridFlows.data?.length ?? 0) === 1 ? '' : 's'}`}
      />
    </div>
  );
}

function FlowMonitorDetail({ initialFlowId }: { initialFlowId: number }) {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };

  // Real flow list from /api/v1/admin/flow-designs (B1.4).
  const { data: flows, isLoading: flowsLoading } = useFlowDesignsList(tenantId);
  const [flowId, setFlowId] = useState<number | null>(initialFlowId);
  // Live monitor status (ETag-cached on the server, polled every 10s). The
  // data isn't painted onto the canvas yet because there's no GoJS — it
  // streams now so Plan B's overlay drops in cleanly.
  useFlowMonitorStatus(scope, flowId);

  // Default the flow Select to the first active flow once it loads. The
  // canvas is still mock so the selected flow doesn't actually drive
  // NODES/EDGES yet — Phase 4b §16 R5 will wire that.
  useEffect(() => {
    if (flows && flows.length > 0 && flowId === null) {
      setFlowId(flows[0].id);
    }
  }, [flows, flowId]);

  const [selectedId, setSelectedId] = useState<string | null>('n2');
  const [openModal, setOpenModal] = useState<null | 'production' | 'scrap' | 'stop'>(null);
  const [scrapForm] = Form.useForm();
  const [stopForm] = Form.useForm();
  const [productionForm] = Form.useForm();

  const selected = NODES.find((n) => n.id === selectedId) ?? null;
  // Cascade root for the modals. While the canvas is mock this stays
  // undefined and the cascading selects render in their "no data" state.
  const equipmentId = selected?.equipmentId;

  // Cascading queries — only fire when an equipment id is known (TanStack
  // `enabled` is wired inside the hooks).
  const { data: scrapGroups, isLoading: scrapLoading } = useEquipmentScrapReasons(tenantId, equipmentId);
  const { data: stopGroups, isLoading: stopLoading } = useEquipmentStopReasons(tenantId, equipmentId);
  const { data: equipmentParts, isLoading: partsLoading } = useEquipmentParts(tenantId, equipmentId);

  const scrapReasonOptions = groupReasonsForSelect(scrapGroups);
  const stopReasonOptions = groupReasonsForSelect(stopGroups);
  const partOptions = (equipmentParts ?? []).map((p) => ({
    value: p.id,
    label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));

  const onClose = () => {
    setOpenModal(null);
    scrapForm.resetFields();
    stopForm.resetFields();
    productionForm.resetFields();
  };

  const submitProduction = async () => {
    try {
      const values = await productionForm.validateFields();
      // TODO Phase E: POST /api/v1/admin/results/production with values
      message.success(`(mock) production registered for ${selected?.label}: ${JSON.stringify(values)}`);
      onClose();
    } catch { /* validation errors render inline */ }
  };

  const submitScrap = async () => {
    try {
      const values = await scrapForm.validateFields();
      // Composite reason value `${typeId}-${reasonId}` is split before submit
      // so the backend receives separate fields (matches legacy wire format).
      const { typeId: scrapTypeId, reasonId: scrapReasonId } = decodeReasonValue(values.reason);
      const payload = {
        ...values,
        scrapTypeId,
        scrapReasonId,
      };
      delete payload.reason;
      // TODO Phase E: POST /api/v1/admin/results/scrap with payload
      message.success(`(mock) scrap registered for ${selected?.label}: ${JSON.stringify(payload)}`);
      onClose();
    } catch { /* validation errors render inline */ }
  };

  const submitStop = async () => {
    try {
      const values = await stopForm.validateFields();
      const { typeId: stopTypeId, reasonId: stopReasonId } = decodeReasonValue(values.reason);
      const hours = Number(values.hours ?? 0);
      const minutes = Number(values.minutes ?? 0);
      const totalMinutes = hours * 60 + minutes;
      const payload = {
        ...values,
        stopTypeId,
        stopReasonId,
        totalMinutes,
      };
      delete payload.reason;
      // TODO Phase E: POST /api/v1/admin/results/stop with payload
      message.success(`(mock) stop registered for ${selected?.label}: ${JSON.stringify(payload)}`);
      onClose();
    } catch { /* validation errors render inline */ }
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
            value={flowId ?? undefined}
            onChange={setFlowId}
            placeholder="Select flow"
            loading={flowsLoading}
            style={{ minWidth: 220 }}
            options={(flows ?? []).map((f) => ({ value: f.id, label: f.name }))}
            aria-label="Select flow"
            notFoundContent={flowsLoading ? 'Loading…' : 'No active flows'}
          />
          <Button icon={<FileExcelOutlined />}>Export</Button>
        </Space>
      </div>

      {/* main layout: canvas + side panel */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={17}>
          <Card styles={{ body: { padding: 12 } }}>
            {process.env.NEXT_PUBLIC_GOJS_LICENSE_KEY ? (
              <FlowCanvasPlaceholder
                nodes={NODES}
                edges={EDGES}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <GoJsLicensePlaceholder width="100%" height={500} />
            )}
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

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      <Modal
        title={`Register production — ${selected?.label ?? ''}`}
        open={openModal === 'production'}
        onCancel={onClose}
        onOk={submitProduction}
        okText="Register"
        destroyOnClose
      >
        <Form form={productionForm} layout="vertical" preserve={false}>
          <Form.Item
            name="partId"
            label="Part"
            extra={!equipmentId ? 'Part list will populate when the canvas is wired to a real equipment.' : undefined}
          >
            <Select
              loading={partsLoading}
              disabled={!equipmentId || partsLoading}
              placeholder="Pick a part (optional)"
              options={partOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Form.Item name="quantity" label="OK quantity" rules={[{ required: true, message: 'Quantity is required' }]}>
            <InputNumber min={0} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item name="plannedQty" label="Planned quantity">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="orderNo" label="Order #" extra="Free text — list-mode lookup is a future enhancement (needs EquipmentProperty endpoint).">
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
        onCancel={onClose}
        onOk={submitScrap}
        okText="Register"
        destroyOnClose
      >
        <Form form={scrapForm} layout="vertical" preserve={false}>
          <Form.Item
            name="partId"
            label="Part"
            extra={!equipmentId ? 'Part list will populate when the canvas is wired to a real equipment.' : undefined}
          >
            <Select
              loading={partsLoading}
              disabled={!equipmentId || partsLoading}
              placeholder="Pick a part (optional)"
              options={partOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Form.Item name="quantity" label="Scrap quantity" rules={[{ required: true, message: 'Quantity is required' }]}>
            <InputNumber min={0} style={{ width: '100%' }} autoFocus />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Scrap reason"
            rules={[{ required: true, message: 'Pick a scrap reason' }]}
            extra={!equipmentId ? 'Reason list is cascaded from the selected equipment.' : undefined}
          >
            <Select
              loading={scrapLoading}
              disabled={!equipmentId || scrapLoading}
              placeholder={equipmentId
                ? (scrapReasonOptions.length === 0 && !scrapLoading
                    ? 'No scrap reasons configured for this equipment'
                    : 'Pick a scrap reason')
                : 'Select a node on the canvas first'}
              options={scrapReasonOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="orderNo" label="Order #" extra="Free text — list-mode lookup is a future enhancement (needs EquipmentProperty endpoint).">
            <Input placeholder="optional" />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Register stop — ${selected?.label ?? ''}`}
        open={openModal === 'stop'}
        onCancel={onClose}
        onOk={submitStop}
        okText="Register"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={stopForm} layout="vertical" preserve={false} initialValues={{ hours: 0, minutes: 0 }}>
          <Form.Item
            name="partId"
            label="Part"
            extra={!equipmentId ? 'Part list will populate when the canvas is wired to a real equipment.' : undefined}
          >
            <Select
              loading={partsLoading}
              disabled={!equipmentId || partsLoading}
              placeholder="Pick a part (optional)"
              options={partOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="hours" label="Hours" rules={[{ required: true, message: 'Hours is required' }]}>
                <InputNumber min={0} style={{ width: '100%' }} autoFocus />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="minutes" label="Minutes" rules={[{ required: true, message: 'Minutes is required' }]}>
                <InputNumber min={0} max={59} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="reason"
            label="Stop reason"
            rules={[{ required: true, message: 'Pick a stop reason' }]}
            extra={!equipmentId ? 'Reason list is cascaded from the selected equipment.' : undefined}
          >
            <Select
              loading={stopLoading}
              disabled={!equipmentId || stopLoading}
              placeholder={equipmentId
                ? (stopReasonOptions.length === 0 && !stopLoading
                    ? 'No stop reasons configured for this equipment'
                    : 'Pick a stop reason')
                : 'Select a node on the canvas first'}
              options={stopReasonOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="orderNo" label="Order #" extra="Free text — list-mode lookup is a future enhancement (needs EquipmentProperty endpoint).">
            <Input placeholder="optional" />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// Top-level page: switch between the card grid and the detail view based
// on the URL. The catch-all route segment `[[...id]]` makes /monitor and
// /monitor/<id> hit the same file.
export default function FlowMonitorPage() {
  const routeParams = useParams<{ id?: string[] }>();
  const urlFlowId = routeParams?.id?.[0] ? Number(routeParams.id[0]) : null;
  if (urlFlowId === null) return <FlowMonitorGrid />;
  return <FlowMonitorDetail initialFlowId={urlFlowId} />;
}

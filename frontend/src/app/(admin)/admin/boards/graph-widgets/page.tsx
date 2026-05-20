'use client';

import {
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { apiClient, toApiError } from '../../../../../lib/api-client';
import { useMe } from '../../../../../lib/api/auth';

const HighchartsReact = dynamic(() => import('highcharts-react-official'), { ssr: false });

const { Title } = Typography;

interface WidgetRow {
  id: number;
  boardId: number;
  title: string;
  imgPath: string;
  settings: string;
  createdAt: string;
}

type HcType = 'combo' | 'bar' | 'solidgauge';

const CHART_TYPE_OPTIONS = [
  { value: 'combo', label: 'Bar + Line combo' },
  { value: 'bar', label: 'Horizontal bar' },
  { value: 'solidgauge', label: 'Gauge' },
];

function buildMockOptions(hcType: HcType): Highcharts.Options {
  if (hcType === 'bar') {
    return {
      chart: { type: 'bar', height: 160, margin: [10, 10, 30, 60], animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: { categories: ['A', 'B', 'C', 'D'], labels: { style: { fontSize: '10px' } } },
      yAxis: { title: { text: undefined } },
      series: [{ type: 'bar', name: 'Value', data: [4, 7, 2, 9] }],
    };
  }
  if (hcType === 'solidgauge') {
    return {
      chart: { type: 'solidgauge', height: 160, margin: [0, 0, 0, 0], animation: false },
      title: { text: undefined },
      credits: { enabled: false },
      pane: {
        center: ['50%', '70%'],
        size: '120%',
        startAngle: -90,
        endAngle: 90,
        background: [{ backgroundColor: '#e6e6e6', innerRadius: '60%', outerRadius: '100%', shape: 'arc' }],
      },
      yAxis: { min: 0, max: 100, stops: [[0.1, '#55BF3B'], [0.5, '#DDDF0D'], [0.9, '#DF5353']], lineWidth: 0, tickWidth: 0, minorTickInterval: undefined, title: { text: undefined }, labels: { enabled: false } },
      series: [{ type: 'solidgauge', name: 'Value', data: [72], dataLabels: { format: '<div style="text-align:center"><span style="font-size:16px">{y}%</span></div>' } }],
    };
  }
  // combo (column + spline)
  return {
    chart: { height: 160, margin: [10, 10, 30, 40], animation: false },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    yAxis: { title: { text: undefined } },
    series: [
      { type: 'column', name: 'Count', data: [3, 6, 2, 8, 5] },
      { type: 'spline', name: 'Trend', data: [3, 5, 3.5, 7, 5.5] },
    ],
  };
}

function tenantHeaders(isAdmin: boolean, tenantId: number | null) {
  return isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

const KEY = (tenantId: number | null) => ['admin-widgets', tenantId] as const;

export default function GraphWidgetsPage() {
  const { data: me } = useMe();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<{ title: string; hcType: HcType; chartType: string }>();
  const [Highcharts, setHighcharts] = useState<typeof import('highcharts') | null>(null);

  // Dynamically import Highcharts on client only.
  //   - solid-gauge extends a class defined in highcharts-more, so the
  //     latter MUST be evaluated first or its import fails with
  //     "Class extends value undefined".
  //   - In Highcharts 12 the modules self-register; calling `.default(hc)`
  //     is still tolerated but is a no-op for some submodules.
  if (typeof window !== 'undefined' && !Highcharts) {
    (async () => {
      const hc = await import('highcharts');
      // 1. highcharts-more — registers radial axes, etc.
      const more = await import('highcharts/highcharts-more');
      if (typeof more.default === 'function') (more.default as unknown as (hc: unknown) => void)(hc.default);
      // 2. solid-gauge — depends on highcharts-more being loaded first.
      const sg = await import('highcharts/modules/solid-gauge');
      if (typeof sg.default === 'function') (sg.default as unknown as (hc: unknown) => void)(hc.default);
      setHighcharts(hc.default as typeof import('highcharts'));
    })();
  }

  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  const headers = tenantHeaders(scope.isAdmin, scope.tenantId);

  const { data: widgets, isFetching } = useQuery({
    queryKey: KEY(scope.tenantId),
    queryFn: async () => {
      const { data: res } = await apiClient.get('/admin/boards/widgets', { headers });
      return res as WidgetRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { title: string; settings: object; imgPath?: string }) => {
      const { data: res } = await apiClient.post('/admin/boards/widgets', input, { headers });
      return res as WidgetRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/boards/widgets/${id}`, { headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const settings = {
        chart_type: values.chartType ?? 'stop_data',
        hc_type: values.hcType,
      };
      await createMut.mutateAsync({ title: values.title, settings });
      message.success('Widget created');
      setDrawerOpen(false);
      form.resetFields();
    } catch (err) {
      const e = toApiError(err);
      if (e.status) message.error(e.message);
    }
  };

  const handleDelete = (w: WidgetRow) =>
    modal.confirm({
      title: `Delete widget "${w.title}"?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(w.id);
          message.success('Deleted');
        } catch (err) {
          message.error(toApiError(err).message);
        }
      },
    });

  function parseHcType(w: WidgetRow): HcType {
    try {
      const s = typeof w.settings === 'string' ? JSON.parse(w.settings) : w.settings;
      if (s?.hc_type === 'bar') return 'bar';
      if (s?.hc_type === 'solidgauge') return 'solidgauge';
    } catch {
      // fall through
    }
    return 'combo';
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Graph Widgets
        </Title>
        <Button
          type="link"
          icon={<PlusOutlined />}
          style={{ color: '#13c2c2', fontWeight: 600 }}
          onClick={() => setDrawerOpen(true)}
        >
          + Add Widget
        </Button>
      </div>

      <Spin spinning={isFetching}>
        <Row gutter={[16, 16]}>
          {(widgets ?? []).map((w) => {
            const hcType = parseHcType(w);
            const opts = buildMockOptions(hcType);
            return (
              <Col key={w.id} xs={24} sm={12} md={8}>
                <Card
                  size="small"
                  bodyStyle={{ padding: 12 }}
                  extra={
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(w)}
                      />
                    </Tooltip>
                  }
                  title={<span style={{ fontSize: 13 }}>{w.title}</span>}
                >
                  {Highcharts ? (
                    <HighchartsReact highcharts={Highcharts} options={opts} />
                  ) : (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Spin size="small" />
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}

          {!isFetching && (widgets ?? []).length === 0 && (
            <Col span={24}>
              <Typography.Text type="secondary">No widgets yet. Click "+ Add Widget" to create one.</Typography.Text>
            </Col>
          )}
        </Row>
      </Spin>

      <Drawer
        title="Add Graph Widget"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
        }}
        width={400}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setDrawerOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={createMut.isPending}>
              Create
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required.' }]}
          >
            <Input placeholder="e.g. Stop Reasons Summary" autoFocus />
          </Form.Item>

          <Form.Item
            name="hcType"
            label="Chart type"
            initialValue="combo"
            rules={[{ required: true }]}
          >
            <Select options={CHART_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item name="chartType" label="Data source (chart type)">
            <Select
              placeholder="Select data source"
              options={[
                { value: 'stop_data', label: 'Stop data' },
                { value: 'stop_count', label: 'Stop count' },
                { value: 'scrap_data', label: 'Scrap data' },
                { value: 'scrap_count', label: 'Scrap count' },
                { value: 'production_data', label: 'Production data' },
                { value: 'production_count', label: 'Production count' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

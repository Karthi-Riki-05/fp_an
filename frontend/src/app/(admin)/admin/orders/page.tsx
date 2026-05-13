'use client';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import { typesApi } from '../../../../lib/api/admin-crud';
import { useFlowDesignsList, useEquipmentParts } from '../../../../lib/api/monitor';
import { useEquipmentList } from '../../../../lib/api/equipment';
import {
  useCreateOrder,
  useDeleteOrder,
  useOrderList,
  useUpdateOrder,
  type OrderInput,
  type OrderRow,
} from '../../../../lib/api/admin-orders';

const { Title, Text } = Typography;

interface OrderFormShape {
  orderNr: string;
  description?: string;
  typeId?: number;
  flowId?: number;
  equipmentId?: number;
  partId?: number;
  startDate?: Dayjs | null;
  endDate?: Dayjs | null;
  plannedQty?: number;
  okQty?: number;
  scrapQty?: number;
  plannedHrs?: number;
  workedHrs?: number;
  remainingQty?: number;
  remainingHrs?: number;
  sortOrder?: number;
}

export default function OrdersAdminPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = useMemo(
    () => ({ tenantId, isAdmin: me?.isAdmin ?? false }),
    [tenantId, me?.isAdmin],
  );

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OrderFormShape>();

  // Cascading roots — watch flowId and equipmentId from the form so the
  // dependent queries refire and the child Selects clear on parent change.
  const watchedFlowId = Form.useWatch('flowId', form);
  const watchedEquipmentId = Form.useWatch('equipmentId', form);

  // ── Queries ───────────────────────────────────────────────────────────────
  const listParams = useMemo(
    () => ({ page, perPage, search: search || undefined, order: 'desc' as const }),
    [page, perPage, search],
  );
  const { data, isFetching } = useOrderList(tenantId, listParams);

  // Order types Select (entity=Order).
  const { data: orderTypes } = typesApi.useList(scope, {
    entity: 'Order', perPage: 200, sort: 'sortOrder', order: 'asc',
  });

  // Flow designs Select.
  const { data: flowDesigns, isLoading: flowsLoading } = useFlowDesignsList(tenantId);

  // Equipment Select. Strict "equipment in flow" filtering needs flow_data
  // parsing which we defer; for now the form shows all active equipment and
  // the user picks one. The cascading clear-on-parent-change behaviour still
  // matches the legacy UX.
  const { data: equipmentList } = useEquipmentList(tenantId);

  // Parts cascade off equipmentId via the Phase A endpoint.
  const { data: equipmentParts, isLoading: partsLoading } = useEquipmentParts(tenantId, watchedEquipmentId ?? null);

  const orderTypeOptions = (orderTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));
  const flowOptions = (flowDesigns ?? []).map((f) => ({ value: f.id, label: f.name }));
  const equipmentOptions = (equipmentList ?? []).map((e) => ({ value: e.id, label: e.name ?? `#${e.id}` }));
  const partOptions = (equipmentParts ?? []).map((p) => ({
    value: p.id,
    label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = useCreateOrder(tenantId);
  const updateMut = useUpdateOrder(tenantId);
  const deleteMut = useDeleteOrder(tenantId);

  // ── Modal lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        orderNr: editing.orderNr,
        description: editing.description,
        typeId: editing.typeId || undefined,
        flowId: editing.flowId || undefined,
        equipmentId: editing.equipmentId || undefined,
        partId: editing.partId || undefined,
        startDate: editing.startDate ? dayjs(editing.startDate) : null,
        endDate: editing.endDate ? dayjs(editing.endDate) : null,
        plannedQty: editing.plannedQty,
        okQty: editing.okQty,
        scrapQty: editing.scrapQty,
        plannedHrs: editing.plannedHrs,
        workedHrs: editing.workedHrs,
        remainingQty: editing.remainingQty,
        remainingHrs: editing.remainingHrs,
        sortOrder: editing.sortOrder,
      });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  // Cascading clear: when flow changes, drop equipment + part; when
  // equipment changes, drop part. Mirrors the legacy AJAX refresh pattern.
  const onFlowChange = (val: number | undefined) => {
    form.setFieldsValue({ flowId: val, equipmentId: undefined, partId: undefined });
  };
  const onEquipmentChange = (val: number | undefined) => {
    form.setFieldsValue({ equipmentId: val, partId: undefined });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: OrderInput = {
        orderNr: values.orderNr,
        description: values.description ?? '',
        typeId: Number(values.typeId ?? 0),
        flowId: Number(values.flowId ?? 0),
        equipmentId: Number(values.equipmentId ?? 0),
        partId: Number(values.partId ?? 0),
        startDate: values.startDate ? values.startDate.toISOString() : null,
        endDate: values.endDate ? values.endDate.toISOString() : null,
        plannedQty: Number(values.plannedQty ?? 0),
        okQty: Number(values.okQty ?? 0),
        scrapQty: Number(values.scrapQty ?? 0),
        plannedHrs: Number(values.plannedHrs ?? 0),
        workedHrs: Number(values.workedHrs ?? 0),
        remainingQty: Number(values.remainingQty ?? 0),
        remainingHrs: Number(values.remainingHrs ?? 0),
        sortOrder: Number(values.sortOrder ?? 0),
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        message.success('Order updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Order created.');
      }
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id);
      message.success('Order deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const columns: ColumnsType<OrderRow> = [
    { title: 'Order #', dataIndex: 'orderNr', key: 'orderNr', width: 140 },
    { title: 'Type', dataIndex: 'typeName', key: 'typeName', width: 140, render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Flow', dataIndex: 'flowName', key: 'flowName', width: 160, ellipsis: true },
    { title: 'Equipment', dataIndex: 'equipmentName', key: 'equipmentName', width: 160, ellipsis: true },
    { title: 'Part', dataIndex: 'partName', key: 'partName', ellipsis: true, render: (_: unknown, row: OrderRow) => row.partNo ? `${row.partNo} — ${row.partName ?? ''}` : (row.partName ?? '—') },
    { title: 'Planned', dataIndex: 'plannedQty', key: 'plannedQty', width: 90, align: 'right' as const },
    { title: 'OK', dataIndex: 'okQty', key: 'okQty', width: 80, align: 'right' as const },
    { title: 'Scrap', dataIndex: 'scrapQty', key: 'scrapQty', width: 80, align: 'right' as const },
    {
      title: 'Start',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 110,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, row: OrderRow) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => { setEditing(row); setModalOpen(true); }} />
          </Tooltip>
          <Popconfirm
            title={`Delete order ${row.orderNr}?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(row.id)}
          >
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Orders' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Orders</Title>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
            Add order
          </Button>
        </Space>
      </div>

      <Card
        bodyStyle={{ padding: 0 }}
        title={
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="Filter by order # or description…"
            allowClear
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 360 }}
          />
        }
      >
        <Table<OrderRow>
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.data ?? []}
          size="middle"
          pagination={{
            current: page,
            pageSize: perPage,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (t) => `${t} orders`,
            onChange: (p, ps) => { setPage(p); setPerPage(ps); },
          }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit order ${editing.orderNr}` : 'Add order'}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        width={720}
        maskClosable={false}
      >
        <Form<OrderFormShape> form={form} layout="vertical" preserve={false}>
          <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="orderNr" label="Order #" rules={[{ required: true, message: 'Order # is required' }]} style={{ minWidth: 220 }}>
              <Input maxLength={50} autoFocus />
            </Form.Item>
            <Form.Item name="typeId" label="Order type" rules={[{ required: true, message: 'Type is required' }]} style={{ minWidth: 220 }}>
              <Select options={orderTypeOptions} showSearch optionFilterProp="label" placeholder="Pick type" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>

          {/* Cascading: flow → equipment → part */}
          <Form.Item name="flowId" label="Flow" rules={[{ required: true, message: 'Flow is required' }]}>
            <Select
              options={flowOptions}
              loading={flowsLoading}
              showSearch
              optionFilterProp="label"
              placeholder="Select flow"
              onChange={onFlowChange}
            />
          </Form.Item>
          <Form.Item name="equipmentId" label="Equipment" rules={[{ required: true, message: 'Equipment is required' }]}>
            <Select
              options={equipmentOptions}
              showSearch
              optionFilterProp="label"
              placeholder={watchedFlowId ? 'Select equipment' : 'Pick a flow first'}
              disabled={!watchedFlowId}
              onChange={onEquipmentChange}
            />
          </Form.Item>
          <Form.Item name="partId" label="Part" rules={[{ required: true, message: 'Part is required' }]}>
            <Select
              options={partOptions}
              loading={partsLoading}
              showSearch
              optionFilterProp="label"
              placeholder={
                watchedEquipmentId
                  ? (partOptions.length === 0 && !partsLoading ? 'No parts configured for this equipment' : 'Select part')
                  : 'Pick an equipment first'
              }
              disabled={!watchedEquipmentId || partsLoading}
            />
          </Form.Item>

          <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="startDate" label="Start date">
              <DatePicker showTime style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="endDate" label="End date">
              <DatePicker showTime style={{ width: 220 }} />
            </Form.Item>
          </Space>

          <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="plannedHrs" label="Planned hrs"><InputNumber min={0} /></Form.Item>
            <Form.Item name="plannedQty" label="Planned qty"><InputNumber min={0} /></Form.Item>
            <Form.Item name="okQty" label="OK qty"><InputNumber min={0} /></Form.Item>
            <Form.Item name="scrapQty" label="Scrap qty"><InputNumber min={0} /></Form.Item>
            <Form.Item name="workedHrs" label="Worked hrs"><InputNumber min={0} /></Form.Item>
            <Form.Item name="remainingHrs" label="Remaining hrs"><InputNumber min={0} /></Form.Item>
            <Form.Item name="remainingQty" label="Remaining qty"><InputNumber min={0} /></Form.Item>
            <Form.Item name="sortOrder" label="Sort"><InputNumber min={0} /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

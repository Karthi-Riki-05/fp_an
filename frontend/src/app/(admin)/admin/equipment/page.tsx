'use client';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Form,
  Popconfirm,
  Tooltip,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentDetail,
  useEquipmentList,
  useUpdateEquipment,
  type Equipment,
} from '../../../../lib/api/equipment';
import { salaryGroupsApi, typesApi } from '../../../../lib/api/admin-crud';
import { EquipmentTreeSelect } from '../../../../components/equipment/EquipmentTreeSelect';
import EquipmentPropertiesPanel from '../../../../components/equipment/EquipmentPropertiesPanel';
import EquipmentDetailsView from '../../../../components/equipment/EquipmentDetailsView';

const { Title } = Typography;

interface ShiftScheduleRow {
  id: number;
  name: string | null;
  status: number;
}

interface EquipmentFormValues {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
  reasonStopTypeIds: number[];
  reasonScrapTypeIds: number[];
  reasonPartTypeIds: number[];
  reasonOrderTypeIds: number[];
  scheduleId?: number | null;
  alsoAssignImport: boolean;
}

const DEFAULT_VALUES: EquipmentFormValues = {
  name: '',
  isActive: true,
  reasonStopTypeIds: [],
  reasonScrapTypeIds: [],
  reasonPartTypeIds: [],
  reasonOrderTypeIds: [],
  alsoAssignImport: false,
};

export default function EquipmentListPage() {
  const { message, modal } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = useMemo(
    () => ({ tenantId, isAdmin: me?.isAdmin ?? false }),
    [tenantId, me?.isAdmin],
  );

  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<EquipmentFormValues>();

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: equipmentRows, isLoading: rowsLoading } = useEquipmentList(tenantId);
  const { data: detail } = useEquipmentDetail(tenantId, editingId);

  const headers = me?.isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;

  // Equipment type Select (entity=Equipment).
  const { data: equipmentTypes } = typesApi.useList(scope, { entity: 'Equipment', perPage: 200, sort: 'sortOrder', order: 'asc' });

  // Tab data: one query per assignment kind so the cache key reflects the
  // entity filter and stale-time can differ per call site.
  // Stop types come from `types` with entity=StopReason, same source the
  // Stop Reasons page uses for its Category dropdown. Previously this
  // hit /admin/stop-categories which is a separate, unused table.
  const { data: stopTypes } = typesApi.useList(scope, { entity: 'StopReason', perPage: 200 });
  const { data: scrapTypes } = typesApi.useList(scope, { entity: 'ScrapReason', perPage: 200 });
  const { data: partTypes } = typesApi.useList(scope, { entity: 'Part', perPage: 200 });
  const { data: orderTypes } = typesApi.useList(scope, { entity: 'Order', perPage: 200 });

  // Shift schedules for the Radio.Group on the Shift tab.
  const { data: shiftSchedules } = useQuery({
    queryKey: ['shift-schedules-list', tenantId],
    queryFn: async () =>
      (
        await apiClient.get<{ data: ShiftScheduleRow[]; total: number }>('/admin/shift-schedules', {
          params: { perPage: 200 },
          headers,
        })
      ).data,
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useCreateEquipment(tenantId);
  const updateMut = useUpdateEquipment(tenantId);
  const deleteMut = useDeleteEquipment(tenantId);

  // Compute prefill values once, when detail arrives. With destroyOnClose +
  // preserve={false} + lazy Tabs mounting, calling form.setFieldsValue from
  // a useEffect would silently drop values for fields that haven't yet
  // registered (e.g. the Stop/Scrap/Part/Order tabs that lazy-mount). Using
  // initialValues guarantees each Form.Item picks up its value when it
  // mounts, no matter when that is.
  const initialValues = useMemo<EquipmentFormValues>(() => {
    if (editingId !== null && detail) {
      return {
        name: detail.name ?? '',
        parentId: detail.parentId || undefined,
        typeId: detail.typeId || undefined,
        description: detail.description ?? undefined,
        sortOrder: detail.sortOrder ?? 0,
        isActive: detail.isActive ?? true,
        reasonStopTypeIds: detail.reasonStopTypeIds ?? [],
        reasonScrapTypeIds: detail.reasonScrapTypeIds ?? [],
        reasonPartTypeIds: detail.reasonPartTypeIds ?? [],
        reasonOrderTypeIds: detail.reasonOrderTypeIds ?? [],
        scheduleId: detail.scheduleId ?? undefined,
        alsoAssignImport: detail.alsoAssignImport ?? false,
      };
    }
    return DEFAULT_VALUES;
  }, [editingId, detail]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setViewMode(false);
    form.resetFields();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        name: values.name,
        parentId: values.parentId ?? 0,
        typeId: values.typeId ?? 0,
        description: values.description ?? '',
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive,
        reasonStopTypeIds: values.reasonStopTypeIds,
        reasonScrapTypeIds: values.reasonScrapTypeIds,
        reasonPartTypeIds: values.reasonPartTypeIds,
        reasonOrderTypeIds: values.reasonOrderTypeIds,
        scheduleId: values.scheduleId ?? null,
        alsoAssignImport: values.alsoAssignImport,
      };
      if (editingId !== null) {
        await updateMut.mutateAsync({ id: editingId, input: payload });
        message.success('Equipment updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Equipment created.');
      }
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Table data ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = equipmentRows ?? [];
    if (!f) return list;
    return list.filter((r) => (r.name ?? '').toLowerCase().includes(f) || (r.description ?? '').toLowerCase().includes(f));
  }, [equipmentRows, filter]);

  const typeNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of equipmentTypes?.data ?? []) m.set(t.id, t.name ?? `#${t.id}`);
    return m;
  }, [equipmentTypes]);

  const parentNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of equipmentRows ?? []) m.set(r.id, r.name ?? `#${r.id}`);
    return m;
  }, [equipmentRows]);

  const columns: ColumnsType<Equipment> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Parent',
      dataIndex: 'parentId',
      key: 'parentId',
      render: (v: number) => (v ? parentNameById.get(v) ?? `#${v}` : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: 'Type',
      dataIndex: 'typeId',
      key: 'typeId',
      render: (v: number) => (v ? <Tag>{typeNameById.get(v) ?? `#${v}`}</Tag> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Sort', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'right' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'active' : 'inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, row) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#01b9d0' }} />}
              onClick={() => { setEditingId(row.id); setViewMode(true); setModalOpen(true); }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#01b9d0' }} />}
              onClick={() => { setEditingId(row.id); setViewMode(false); setModalOpen(true); }}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete ${row.name}?`}
            description="Soft-delete — production data is preserved."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try { await deleteMut.mutateAsync(row.id); message.success('Equipment deleted.'); }
              catch (err) { message.error(toApiError(err).message); }
            }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </span>
      ),
    },
  ];

  if (!me) return null;
  if (!tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Equipment' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Equipment</Title>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); setModalOpen(true); }}>
            Add equipment
          </Button>
        </Space>
      </div>

      <Card
        bodyStyle={{ padding: 0 }}
        title={
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="Filter by name or description…"
            allowClear
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        }
      >
        <Table<Equipment>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          size="middle"
          loading={rowsLoading}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'], showTotal: (t) => `${t} items` }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        title={
          viewMode
            ? `View equipment #${editingId}`
            : editingId === null
              ? 'Add equipment'
              : `Edit equipment #${editingId}`
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={viewMode ? closeModal : onSubmit}
        okText={viewMode ? 'Close' : editingId === null ? 'Create' : 'Save changes'}
        cancelButtonProps={viewMode ? { style: { display: 'none' } } : undefined}
        confirmLoading={submitting}
        destroyOnClose
        width={920}
      >
        {editingId !== null && !detail ? (
          <Spin />
        ) : viewMode && detail ? (
          <EquipmentDetailsView detail={detail} scope={scope} />
        ) : (
          <Form<EquipmentFormValues> form={form} layout="vertical" preserve={false} initialValues={initialValues}>
            <Tabs
              defaultActiveKey="equipment"
              items={[
                {
                  key: 'equipment',
                  label: 'Equipment',
                  children: (
                    <>
                      <Form.Item name="parentId" label="Parent equipment">
                        <EquipmentTreeSelect tenantId={tenantId} placeholder="Select parent equipment (optional)" />
                      </Form.Item>
                      <Form.Item name="typeId" label="Type" rules={[{ required: true, message: 'Type is required' }]}>
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="Select equipment type"
                          options={(equipmentTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                        />
                      </Form.Item>
                      <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                        <Input maxLength={255} autoFocus />
                      </Form.Item>
                      <Form.Item name="description" label="Description">
                        <Input.TextArea rows={3} maxLength={2000} />
                      </Form.Item>
                      <Space size="middle" wrap>
                        <Form.Item name="sortOrder" label="Sort order">
                          <InputNumber min={0} />
                        </Form.Item>
                        <Form.Item name="isActive" label="Active" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Space>
                    </>
                  ),
                },
                {
                  key: 'stop',
                  label: 'Stop types',
                  children: (
                    <Form.Item name="reasonStopTypeIds">
                      <Checkbox.Group
                        options={(stopTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: 'scrap',
                  label: 'Scrap types',
                  children: (
                    <Form.Item name="reasonScrapTypeIds">
                      <Checkbox.Group
                        options={(scrapTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: 'parts',
                  label: 'Part types',
                  children: (
                    <Form.Item name="reasonPartTypeIds">
                      <Checkbox.Group
                        options={(partTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: 'orders',
                  label: 'Order types',
                  children: (
                    <Form.Item name="reasonOrderTypeIds">
                      <Checkbox.Group
                        options={(orderTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }))}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  key: 'shift',
                  label: 'Shift schedule',
                  children: (
                    <>
                      <Form.Item name="scheduleId" label="Shift schedule">
                        <Radio.Group>
                          <Space direction="vertical">
                            <Radio value={null}>(none)</Radio>
                            {(shiftSchedules?.data ?? []).map((s) => (
                              <Radio key={s.id} value={s.id}>{s.name ?? `#${s.id}`}</Radio>
                            ))}
                          </Space>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item name="alsoAssignImport" valuePropName="checked">
                        <Checkbox>Also assign on import</Checkbox>
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: 'properties',
                  label: 'Properties',
                  children: <EquipmentPropertiesPanel equipmentId={editingId} scope={scope} />,
                },
              ]}
            />
          </Form>
        )}
      </Modal>
    </div>
  );
}

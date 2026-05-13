'use client';

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Alert,
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
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
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import { useMachinesForSelect } from '../../../../lib/api/admin-machines';
import {
  useCreateWorkstation,
  useDeleteWorkstation,
  useToggleWorkstationStatus,
  useUpdateWorkstation,
  useWorkstationList,
  type WorkstationInput,
  type WorkstationRow,
} from '../../../../lib/api/admin-workstations';

const { Title, Text } = Typography;

interface FormShape { name: string; machineId?: number }

export default function WorkstationsPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkstationRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormShape>();

  const listParams = useMemo(
    () => ({ page, perPage, search: search || undefined }),
    [page, perPage, search],
  );
  const { data, isFetching } = useWorkstationList(tenantId, listParams);
  const { data: machines } = useMachinesForSelect(tenantId);
  const machineOptions = (machines ?? []).map((m) => ({ value: m.id, label: m.machineName ?? `#${m.id}` }));

  const createMut = useCreateWorkstation(tenantId);
  const updateMut = useUpdateWorkstation(tenantId);
  const deleteMut = useDeleteWorkstation(tenantId);
  const toggleMut = useToggleWorkstationStatus(tenantId);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({ name: editing.name, machineId: editing.machineId ?? undefined });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: WorkstationInput = {
        name: values.name,
        machineId: values.machineId !== undefined ? Number(values.machineId) : undefined,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        message.success('Workstation updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Workstation created.');
      }
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const columns: ColumnsType<WorkstationRow> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Machine',
      dataIndex: 'machineName',
      key: 'machineName',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: number) => v === 1 ? <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag> : <Tag icon={<CloseCircleOutlined />}>Inactive</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, row: WorkstationRow) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => { setEditing(row); setModalOpen(true); }} />
          </Tooltip>
          <Tooltip title={row.status === 1 ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              size="small"
              icon={row.status === 1 ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={async () => {
                try { await toggleMut.mutateAsync(row.id); message.success('Status toggled.'); }
                catch (err) { message.error(toApiError(err).message); }
              }}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete workstation "${row.name}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try { await deleteMut.mutateAsync(row.id); message.success('Workstation deleted.'); }
              catch (err) { message.error(toApiError(err).message); }
            }}
          >
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Workstations' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Workstations</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          Add workstation
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Workstation is now a definition row (name + machine binding)."
        description="The legacy form's stop_cause / counts / date / time / duration fields were a stop-recording UI that's been moved to the Result Stop data form (Phase B/C5). Tracked in DROPDOWN_AUDIT.md."
      />

      <Card
        bodyStyle={{ padding: 0 }}
        title={
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="Filter by name…"
            allowClear
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 360 }}
          />
        }
      >
        <Table<WorkstationRow>
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
            showTotal: (t) => `${t} workstations`,
            onChange: (p, ps) => { setPage(p); setPerPage(ps); },
          }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit workstation "${editing.name}"` : 'Add workstation'}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        width={480}
        maskClosable={false}
      >
        <Form<FormShape> form={form} layout="vertical" preserve={false}>
          <Form.Item name="machineId" label="Machine" rules={[{ required: true, message: 'Machine is required' }]}>
            <Select
              options={machineOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Pick a machine"
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input maxLength={255} autoFocus />
          </Form.Item>
          {/* TODO Phase E or later: legacy form had stop_cause / counts / date / time / duration
              fields that captured a stop event tied to this workstation. That responsibility is
              owned by StopData (admin/results/stop). If a workstation-scoped stop entry shortcut
              becomes desirable, build it as a separate sub-form rather than reviving here. */}
        </Form>
      </Modal>
    </div>
  );
}

'use client';

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
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
  useCreateMachineProgramme,
  useDeleteMachineProgramme,
  useMachineProgrammeList,
  useToggleMachineProgrammeStatus,
  useUpdateMachineProgramme,
  type MachineProgrammeRow,
  type MachineProgrammeInput,
} from '../../../../lib/api/admin-machine-programmes';

const { Title, Text } = Typography;

interface FormShape {
  name: string;
  machineId?: number;
  isLink?: boolean;
  isLocked?: boolean;
}

export default function MachineProgrammesPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MachineProgrammeRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormShape>();

  const listParams = useMemo(
    () => ({ page, perPage, search: search || undefined }),
    [page, perPage, search],
  );
  const { data, isFetching } = useMachineProgrammeList(tenantId, listParams);
  const { data: machines } = useMachinesForSelect(tenantId);
  const machineOptions = (machines ?? []).map((m) => ({ value: m.id, label: m.machineName ?? `#${m.id}` }));

  const createMut = useCreateMachineProgramme(tenantId);
  const updateMut = useUpdateMachineProgramme(tenantId);
  const deleteMut = useDeleteMachineProgramme(tenantId);
  const toggleMut = useToggleMachineProgrammeStatus(tenantId);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        machineId: editing.machineId ?? undefined,
        isLink: editing.isLink,
        isLocked: editing.isLocked,
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

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: MachineProgrammeInput = {
        name: values.name,
        machineId: Number(values.machineId ?? 0),
        isLink: values.isLink ?? false,
        isLocked: values.isLocked ?? false,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        message.success('Programme updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Programme created.');
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

  const columns: ColumnsType<MachineProgrammeRow> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Machine',
      dataIndex: 'machineName',
      key: 'machineName',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Link',
      dataIndex: 'isLink',
      key: 'isLink',
      width: 80,
      render: (v: boolean) => v ? <Tag icon={<LinkOutlined />}>Link</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Locked',
      dataIndex: 'isLocked',
      key: 'isLocked',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="warning" icon={<LockOutlined />}>Locked</Tag> : <Tag icon={<UnlockOutlined />}>Open</Tag>,
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
      render: (_: unknown, row: MachineProgrammeRow) => (
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
            title={`Delete programme "${row.name}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try { await deleteMut.mutateAsync(row.id); message.success('Programme deleted.'); }
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
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Machine programmes' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Machine programmes</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          Add programme
        </Button>
      </div>

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
        <Table<MachineProgrammeRow>
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
            showTotal: (t) => `${t} programmes`,
            onChange: (p, ps) => { setPage(p); setPerPage(ps); },
          }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit programme "${editing.name}"` : 'Add programme'}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        width={520}
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
          <Form.Item name="isLink" valuePropName="checked">
            <Checkbox>This programme is a link (not a file upload)</Checkbox>
          </Form.Item>
          <Form.Item name="isLocked" valuePropName="checked">
            <Checkbox>Locked</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

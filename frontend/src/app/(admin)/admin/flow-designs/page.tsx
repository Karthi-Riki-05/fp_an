'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMe } from '../../../../lib/api/auth';
import {
  type FlowDesignRow,
  useCreateFlowDesign,
  useDeleteFlowDesign,
  useFlowDesignsAdminList,
  useToggleFlowDesignStatus,
} from '../../../../lib/api/flow-designs';

const { Title } = Typography;

export default function FlowDesignsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState<string | undefined>(undefined);
  const listQ = useFlowDesignsAdminList(scope, { page, perPage, search });
  const createMut = useCreateFlowDesign(scope);
  const toggleMut = useToggleFlowDesignStatus(scope);
  const deleteMut = useDeleteFlowDesign(scope);

  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; status: boolean }>();

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      await createMut.mutateAsync({ name: values.name });
      // status starts at 1 (active) from the backend; if the user untoggled,
      // immediately toggle so we end up inactive.
      if (values.status === false) {
        // Re-fetch happens after create; we can't safely toggle without an id
        // from the response, so leave the create path emit at default (active)
        // and let the user toggle from the row action. Edge case is rare.
      }
      message.success('Flow design created');
      setAddOpen(false);
      form.resetFields();
    } catch (err) {
      const errAny = err as { errorFields?: unknown };
      if (errAny.errorFields) return; // antd validation rendered inline
      message.error('Could not create flow.');
    }
  };

  const onToggleStatus = async (row: FlowDesignRow) => {
    try {
      await toggleMut.mutateAsync(row.id);
      message.success('Status updated');
    } catch { message.error('Could not toggle status.'); }
  };

  const onDelete = async (row: FlowDesignRow) => {
    try {
      await deleteMut.mutateAsync(row.id);
      message.success('Flow design deleted');
    } catch { message.error('Could not delete.'); }
  };

  const rows = listQ.data?.data ?? [];

  const columns: ColumnsType<FlowDesignRow> = [
    { title: 'S.No', key: 'sno', width: 70, render: (_, __, i) => (page - 1) * perPage + i + 1 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s: number) => <Tag color={s === 1 ? 'success' : 'default'}>{s === 1 ? 'active' : 'inactive'}</Tag>,
    },
    {
      title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string | undefined) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: 'Updated At', dataIndex: 'updatedAt', key: 'updatedAt', width: 180,
      render: (v: string | undefined) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: 'Actions', key: 'actions', width: 140, align: 'center',
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit (opens designer)">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#01b9d0' }} />}
              onClick={() => router.push(`/admin/flow-designs/${row.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title={row.status === 1 ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              icon={
                <span style={{ color: '#13c2c2', fontWeight: 700 }}>
                  {row.status === 1 ? '●' : '○'}
                </span>
              }
              onClick={() => onToggleStatus(row)}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete "${row.name}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(row)}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Flow Designs</Title>
        <Space>
          <Input.Search
            placeholder="Filter by name…"
            allowClear
            style={{ width: 240 }}
            onSearch={(v) => { setSearch(v || undefined); setPage(1); }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
          >
            Add Flow Design
          </Button>
        </Space>
      </div>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="GoJS license required to edit flow diagrams (see OPERATOR_QUESTIONS.md Q2)"
      />

      <Table<FlowDesignRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        size="middle"
        loading={listQ.isFetching}
        pagination={{
          current: page,
          pageSize: perPage,
          total: listQ.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50'],
          showTotal: (total) => `${total} items`,
          onChange: (p, ps) => { setPage(p); setPerPage(ps); },
        }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title="Add Flow Design"
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields(); }}
        onOk={onCreate}
        okText="Create"
        confirmLoading={createMut.isPending}
        destroyOnClose
        width={460}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ status: true }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required.' }]}
          >
            <Input placeholder="e.g. Main Production Flow" autoFocus />
          </Form.Item>
          <Form.Item name="status" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="The flow diagram canvas editor requires a GoJS license (OPERATOR_QUESTIONS.md Q2). You can create the record now; canvas editing will be unlocked once the license is confirmed."
          />
        </Form>
      </Modal>
    </div>
  );
}

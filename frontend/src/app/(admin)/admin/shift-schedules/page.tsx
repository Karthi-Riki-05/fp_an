'use client';

import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Pagination,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';

const { Title } = Typography;

interface ShiftScheduleRow {
  id: number;
  name: string;
  description: string | null;
  status: number;
  createdAt: string;
}

const KEY = (tenantId: number | null) => ['shift-schedules', tenantId] as const;

function tenantHeaders(isAdmin: boolean, tenantId: number | null) {
  return isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

export default function ShiftSchedulesPage() {
  const { data: me } = useMe();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const perPage = 10;
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; description: string }>();

  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  const headers = tenantHeaders(scope.isAdmin, scope.tenantId);

  const { data, isFetching } = useQuery({
    queryKey: [...KEY(scope.tenantId), page, perPage],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/shift-schedules', {
        params: { page, perPage },
        headers,
      });
      return data as { data: ShiftScheduleRow[]; total: number; page: number; perPage: number };
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data } = await apiClient.post('/admin/shift-schedules', input, { headers });
      return data as ShiftScheduleRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const statusMut = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.patch(`/admin/shift-schedules/${id}/status`, {}, { headers });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/shift-schedules/${id}`, { headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await createMut.mutateAsync({ name: values.name, description: values.description || undefined });
      message.success('Shift schedule created');
      setAddOpen(false);
      form.resetFields();
    } catch (err) {
      const e = toApiError(err);
      if (e.status) message.error(e.message);
    }
  };

  const handleDelete = (row: ShiftScheduleRow) =>
    modal.confirm({
      title: `Delete "${row.name}"?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(row.id);
          message.success('Deleted');
        } catch (err) {
          message.error(toApiError(err).message);
        }
      },
    });

  const columns: ColumnsType<ShiftScheduleRow> = [
    { title: 'S.No', key: 'sno', width: 70, render: (_, __, i) => (page - 1) * perPage + i + 1 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Manage',
      key: 'manage',
      width: 130,
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit">
            <Link href={`/admin/shift-schedules/${row.id}/edit`}>
              <Button type="text" icon={<EditOutlined style={{ color: '#1677ff' }} />} />
            </Link>
          </Tooltip>
          <Tooltip title={row.status === 1 ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              icon={
                <PlayCircleOutlined
                  style={{ color: row.status === 1 ? '#13c2c2' : '#8c8c8c', fontSize: 16 }}
                />
              }
              onClick={() => statusMut.mutate(row.id)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const total = data?.total ?? 0;
  const shown = Math.min(page * perPage, total);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Shift schedule</Title>
        <Button
          type="link"
          icon={<PlusOutlined />}
          style={{ color: '#13c2c2', fontWeight: 600 }}
          onClick={() => setAddOpen(true)}
        >
          Add shift schedule
        </Button>
      </div>

      <Card title="List" bodyStyle={{ padding: 0 }}>
        <Table<ShiftScheduleRow>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isFetching}
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text type="secondary">
          Showing 1 to {shown} of {total} entries
        </Typography.Text>
        <Pagination
          current={page}
          pageSize={perPage}
          total={total}
          onChange={(p) => setPage(p)}
          showSizeChanger={false}
        />
      </div>

      <Modal
        title="Add shift schedule"
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields(); }}
        onOk={handleAdd}
        okText="Create"
        confirmLoading={createMut.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required.' }]}>
            <Input placeholder="e.g. Day shift schedule" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

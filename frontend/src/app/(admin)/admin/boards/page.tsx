'use client';

import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  LinkOutlined,
} from '@ant-design/icons';
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
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';

const { Title } = Typography;

interface BoardRow {
  id: number;
  name: string;
  status: number;
  createdByName: string;
  updatedAt: string;
  createdAt: string;
}

interface BoardListResponse {
  data: BoardRow[];
  total: number;
  page: number;
  perPage: number;
}

function tenantHeaders(isAdmin: boolean, tenantId: number | null) {
  return isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

const KEY = (tenantId: number | null) => ['admin-boards', tenantId] as const;

export default function BoardsPage() {
  const { data: me } = useMe();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const perPage = 10;
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm<{ name: string }>();

  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  const headers = tenantHeaders(scope.isAdmin, scope.tenantId);

  const { data, isFetching } = useQuery({
    queryKey: [...KEY(scope.tenantId), page, perPage],
    queryFn: async () => {
      const { data: res } = await apiClient.get('/admin/boards', {
        params: { page, perPage },
        headers,
      });
      return res as BoardListResponse;
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data: res } = await apiClient.post('/admin/boards', input, { headers });
      return res as BoardRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const statusMut = useMutation({
    mutationFn: async (id: number) => {
      const { data: res } = await apiClient.patch(`/admin/boards/${id}/status`, {}, { headers });
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/boards/${id}`, { headers });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(scope.tenantId) }),
  });

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await createMut.mutateAsync({ name: values.name });
      message.success('Dashboard created');
      setAddOpen(false);
      form.resetFields();
    } catch (err) {
      const e = toApiError(err);
      if (e.status) message.error(e.message);
    }
  };

  const handleDelete = (row: BoardRow) =>
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

  const columns: ColumnsType<BoardRow> = [
    {
      title: 'S.No',
      key: 'sno',
      width: 70,
      render: (_, __, i) => (page - 1) * perPage + i + 1,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Creator',
      dataIndex: 'createdByName',
      key: 'createdByName',
      render: (v: string) => v || '—',
    },
    {
      title: 'Edit Date',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => fmtDate(v),
    },
    {
      title: 'Dashboard Link',
      key: 'link',
      render: (_, row) => (
        <Link href={`/admin/boards/${row.id}/${toSlug(row.name)}`}>
          <Button type="link" size="small" icon={<LinkOutlined />} style={{ padding: 0 }}>
            Open
          </Button>
        </Link>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit">
            <Link href={`/admin/boards/creator?id=${row.id}`}>
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
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const total = data?.total ?? 0;
  const shown = Math.min(page * perPage, total);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Dashboard List
        </Title>
        <Space>
          <Button
            type="link"
            icon={<PlusOutlined />}
            style={{ color: '#13c2c2', fontWeight: 600 }}
            onClick={() => router.push('/admin/boards/creator')}
          >
            + Add Dashboard
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => setAddOpen(true)}
            style={{ color: '#999' }}
          >
            (quick add)
          </Button>
        </Space>
      </div>

      <Card title="Dashboard List" bodyStyle={{ padding: 0 }}>
        <Table<BoardRow>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isFetching}
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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
        title="Add Dashboard"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        onOk={handleAdd}
        okText="Create"
        confirmLoading={createMut.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required.' }]}
          >
            <Input placeholder="e.g. Line 1" autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

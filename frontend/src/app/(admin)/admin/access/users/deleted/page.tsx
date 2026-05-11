'use client';

import { DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { App, Button, Popconfirm, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toApiError } from '../../../../../../lib/api-client';
import {
  useDeletedUsers,
  usePermanentDeleteUser,
  useRestoreUser,
} from '../../../../../../lib/api/admin-users';
import { useMe } from '../../../../../../lib/api/auth';
import type { AdminUser } from '../../../../../../lib/api/types';

const { Title, Text } = Typography;

export default function DeletedUsersPage() {
  const { data: me } = useMe();
  const { message } = App.useApp();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const { data, isFetching } = useDeletedUsers(scope, { page, perPage });
  const restore = useRestoreUser(scope);
  const hardDelete = usePermanentDeleteUser(scope);

  if (!me) return null;
  if (tenantId === null) {
    return <Text type="secondary">Pick a tenant to see its deleted users.</Text>;
  }

  const onRestore = async (row: AdminUser) => {
    try {
      await restore.mutateAsync(row.id);
      message.success(`Restored ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onPermanentDelete = async (row: AdminUser) => {
    try {
      await hardDelete.mutateAsync(row.id);
      message.success(`Permanently deleted ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>Deleted Users</Title>
      <Text type="secondary">Soft-deleted users. Restore brings them back; Permanent Delete is irreversible.</Text>

      <Table<AdminUser>
        style={{ marginTop: 16 }}
        rowKey="id"
        loading={isFetching}
        pagination={{
          current: page,
          pageSize: perPage,
          total: data?.total ?? 0,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPerPage(ps);
          },
        }}
        dataSource={data?.data ?? []}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: 'Name', dataIndex: 'name' },
          { title: 'E-mail', dataIndex: 'email' },
          {
            title: 'Roles',
            dataIndex: 'roles',
            render: (rs: string[]) => rs.map((r) => <Tag key={r}>{r}</Tag>),
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            width: 120,
            render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '—'),
          },
          {
            title: 'Actions',
            width: 220,
            render: (_, row) => (
              <span style={{ display: 'inline-flex', gap: 8 }}>
                <Button size="small" icon={<UndoOutlined />} onClick={() => onRestore(row)}>
                  Restore
                </Button>
                <Popconfirm
                  title="Permanently delete?"
                  description="This is irreversible. The row is removed from the database."
                  okText="Permanently delete"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onPermanentDelete(row)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Forever
                  </Button>
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

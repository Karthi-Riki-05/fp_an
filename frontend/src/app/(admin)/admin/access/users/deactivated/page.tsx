'use client';

import { CheckCircleOutlined } from '@ant-design/icons';
import { App, Button, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toApiError } from '../../../../../../lib/api-client';
import { useDeactivatedUsers, useToggleAdminUserStatus } from '../../../../../../lib/api/admin-users';
import { useMe } from '../../../../../../lib/api/auth';
import type { AdminUser } from '../../../../../../lib/api/types';

const { Title, Text } = Typography;

export default function DeactivatedUsersPage() {
  const { data: me } = useMe();
  const { message } = App.useApp();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const { data, isFetching } = useDeactivatedUsers(scope, { page, perPage });
  const toggle = useToggleAdminUserStatus(scope);

  if (!me) return null;
  if (tenantId === null) {
    return <Text type="secondary">Pick a tenant to see its deactivated users.</Text>;
  }

  const onActivate = async (row: AdminUser) => {
    try {
      await toggle.mutateAsync({ id: row.id, active: true });
      message.success(`Reactivated ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>Deactivated Users</Title>
      <Text type="secondary">Users with status=disabled. Click "Activate" to bring them back.</Text>

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
            title: 'Action',
            width: 130,
            render: (_, row) => (
              <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onActivate(row)}>
                Activate
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}

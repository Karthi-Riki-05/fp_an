'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Popconfirm, Table, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { toApiError } from '../../../../../lib/api-client';
import { useDeleteRole, useRoles, type RoleSummary } from '../../../../../lib/api/roles';

const { Title, Text } = Typography;

export default function RolesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { data, isLoading } = useRoles();
  const remove = useDeleteRole();

  const onDelete = async (row: RoleSummary) => {
    try {
      await remove.mutateAsync(row.id);
      message.success(`Deleted role "${row.name}".`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Roles</Title>
          <Text type="secondary">Each role grants a fixed set of permissions. Administrator (all) is the platform owner.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/access/roles/new')}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        >
          New role
        </Button>
      </div>

      <Table<RoleSummary>
        style={{ marginTop: 16 }}
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (v: string, row) => (
              <span style={{ fontWeight: 500 }}>
                {v}
                {row.all && <Tag color="gold" style={{ marginLeft: 8 }}>all permissions</Tag>}
              </span>
            ),
          },
          { title: 'Permissions', dataIndex: 'permissionCount', width: 140 },
          { title: 'Users', dataIndex: 'userCount', width: 120 },
          { title: 'Sort', dataIndex: 'sort', width: 80 },
          {
            title: 'Actions',
            width: 220,
            align: 'center' as const,
            render: (_, row) => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#01b9d0' }} />}
                  onClick={() => router.push(`/admin/access/roles/${row.id}/edit`)}
                >
                  Edit
                </Button>
                <Popconfirm
                  title={row.userCount > 0 ? `${row.userCount} user(s) hold this role` : 'Delete role?'}
                  description={
                    row.all
                      ? 'Cannot delete the Administrator role.'
                      : row.userCount > 0
                        ? 'Reassign or remove users first.'
                        : 'This is permanent.'
                  }
                  okText="Delete"
                  okButtonProps={{ danger: true, disabled: row.all || row.userCount > 0 }}
                  onConfirm={() => onDelete(row)}
                  disabled={row.all || row.userCount > 0}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={row.all || row.userCount > 0}
                  >
                    Delete
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

'use client';

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UndoOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toApiError } from '../../../../../lib/api-client';
import {
  ListAdminUsersParams,
  useAdminUsers,
  useChangeUserPassword,
  useDeactivatedUsers,
  useDeleteAdminUser,
  useDeletedUsers,
  useGlobalUsers,
  usePermanentDeleteUser,
  useResendConfirmation,
  useRestoreUser,
  useToggleAdminUserStatus,
} from '../../../../../lib/api/admin-users';
import { useImpersonate, useMe } from '../../../../../lib/api/auth';
import type { AdminUser, GlobalAdminUser } from '../../../../../lib/api/types';
import { UserFormModal } from './UserFormModal';

const { Text, Title } = Typography;

type StatusFilter = 'active' | 'deactivated' | 'deleted';

/* -------------------------------------------------------------------------
 * Top-right action buttons — create actions only (filter is handled by tabs)
 * ------------------------------------------------------------------------- */
function HeaderButtons({
  isAdmin,
  onCreateCompany,
}: {
  isAdmin: boolean;
  onCreateCompany: () => void;
}) {
  const router = useRouter();
  return (
    <Space>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ background: '#00a65a', borderColor: '#00a65a' }}
        onClick={() => router.push('/admin/access/users/create')}
      >
        Add New
      </Button>
      {isAdmin && (
        <Button onClick={onCreateCompany}>
          Create Company
        </Button>
      )}
    </Space>
  );
}

/* -------------------------------------------------------------------------
 * Filter tabs — updates ?status query param, no navigation away
 * ------------------------------------------------------------------------- */
function StatusTabs({ status }: { status: StatusFilter }) {
  const router = useRouter();
  const go = (s: StatusFilter) => router.push(`?status=${s}`);

  const tab = (label: string, value: StatusFilter) => {
    const active = status === value;
    return (
      <Button
        key={value}
        size="small"
        type={active ? 'primary' : 'default'}
        style={active ? { background: '#01b9d0', borderColor: '#01b9d0' } : {}}
        onClick={() => !active && go(value)}
      >
        {label}
      </Button>
    );
  };

  return (
    <Space style={{ marginBottom: 12 }}>
      {tab('All Users', 'active')}
      {tab('Deactivated Users', 'deactivated')}
      {tab('Deleted Users', 'deleted')}
    </Space>
  );
}

/* -------------------------------------------------------------------------
 * Shared action buttons for active users
 * ------------------------------------------------------------------------- */
function UserActions({
  row,
  me,
  onView,
  onEdit,
  onKey,
  onImpersonate,
  onToggleStatus,
  onDelete,
  onResend,
}: {
  row: AdminUser;
  me: { id: number; isAdmin: boolean };
  onView: () => void;
  onEdit: () => void;
  onKey: () => void;
  onImpersonate: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onResend: () => void;
}) {
  return (
    <Space size={2}>
      <Tooltip title="View">
        <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#00a65a' }} />} onClick={onView} />
      </Tooltip>
      <Tooltip title="Edit">
        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#3c8dbc' }} />} onClick={onEdit} />
      </Tooltip>
      <Tooltip title={row.active ? 'Deactivate' : 'Activate'}>
        <Button
          type="text"
          size="small"
          icon={
            row.active
              ? <PauseCircleOutlined style={{ color: '#dd4b39' }} />
              : <PlayCircleOutlined style={{ color: '#00a65a' }} />
          }
          onClick={onToggleStatus}
        />
      </Tooltip>
      {!row.confirmed && (
        <Tooltip title="Resend confirmation">
          <Button type="text" size="small" icon={<MailOutlined style={{ color: '#f39c12' }} />} onClick={onResend} />
        </Tooltip>
      )}
      {me.isAdmin && row.id !== me.id && !row.roles.includes('Administrator') && (
        <Tooltip title="Login as this user">
          <Button type="text" size="small" icon={<UserSwitchOutlined style={{ color: '#605ca8' }} />} onClick={onImpersonate} />
        </Tooltip>
      )}
      <Tooltip title="Change password">
        <Button type="text" size="small" icon={<KeyOutlined style={{ color: '#00c0ef' }} />} onClick={onKey} />
      </Tooltip>
      <Popconfirm
        title="Delete this user?"
        description="This is a soft delete. The user can be restored from the Deleted Users tab."
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={onDelete}
        disabled={row.id === me.id}
      >
        <Tooltip title={row.id === me.id ? "Can't delete yourself" : 'Delete'}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={row.id === me.id} />
        </Tooltip>
      </Popconfirm>
    </Space>
  );
}

/* =========================================================================
 * SUPERADMIN global view — all users across all tenants
 * ========================================================================= */
function GlobalUsersTable({ me, status }: { me: { id: number; isAdmin: boolean }; status: StatusFilter }) {
  const { message } = App.useApp();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<GlobalAdminUser | null>(null);
  const [pwTarget, setPwTarget] = useState<GlobalAdminUser | null>(null);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  const scope = { tenantId: null as number | null, isAdmin: true };

  const params = useMemo<ListAdminUsersParams>(() => {
    const p: ListAdminUsersParams = { page, perPage, sort: 'id', order: 'asc' };
    if (search) p.search = search;
    if (status === 'deactivated') p.active = 'false';
    if (status === 'deleted') p.deleted = 'true';
    return p;
  }, [page, perPage, search, status]);

  const { data, isFetching } = useGlobalUsers(params);
  const toggleStatus = useToggleAdminUserStatus(scope);
  const remove = useDeleteAdminUser(scope);
  const restore = useRestoreUser(scope);
  const hardDelete = usePermanentDeleteUser(scope);
  const impersonate = useImpersonate();
  const changePw = useChangeUserPassword(scope);
  const resendConfirm = useResendConfirmation(scope);

  const onToggleStatus = async (row: GlobalAdminUser) => {
    try {
      await toggleStatus.mutateAsync({ id: row.id, active: !row.active, tenantId: row.companyId });
      message.success(row.active ? 'User deactivated.' : 'User activated.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onDelete = async (row: GlobalAdminUser) => {
    try {
      await remove.mutateAsync({ id: row.id, tenantId: row.companyId });
      message.success('User deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onRestore = async (row: GlobalAdminUser) => {
    try {
      await restore.mutateAsync({ id: row.id, tenantId: row.companyId });
      message.success(`Restored ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onPermanentDelete = async (row: GlobalAdminUser) => {
    try {
      await hardDelete.mutateAsync({ id: row.id, tenantId: row.companyId });
      message.success(`Permanently deleted ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onImpersonate = async (row: AdminUser & { companyId?: number }) => {
    const tenantId = (row as GlobalAdminUser).companyId;
    if (!tenantId) { message.error('No tenant associated with this user.'); return; }
    try {
      await impersonate.mutateAsync({ targetUserId: row.id, tenantId });
      message.success(`Impersonating ${row.name}.`);
      router.push('/dashboard');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onChangePassword = async () => {
    if (!pwTarget) return;
    try {
      const values = await pwForm.validateFields();
      await changePw.mutateAsync({ id: pwTarget.id, password: values.password, tenantId: pwTarget.companyId });
      message.success(`Password updated for ${pwTarget.email}.`);
      setPwTarget(null);
      pwForm.resetFields();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  const onResend = async (row: GlobalAdminUser) => {
    try {
      await resendConfirm.mutateAsync({ id: row.id, tenantId: row.companyId });
      message.success(`Confirmation email queued for ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const activeColumns: ColumnsType<GlobalAdminUser> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 65 },
    {
      title: 'Company ID',
      dataIndex: 'companyId',
      key: 'companyId',
      width: 120,
      render: (id: number, row: GlobalAdminUser) =>
        row.companyName ? (
          <Tooltip title={row.companyName}>
            <Tag color="default">{id || '—'}</Tag>
          </Tooltip>
        ) : (
          <Tag color="default">{id || '—'}</Tag>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'E-mail',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <Text copyable={{ text: email }}>{email}</Text>,
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 140,
      render: (roles: string[]) =>
        roles.length ? <Tag color="blue">{roles[0]}</Tag> : <Tag color="default">None</Tag>,
    },
    {
      title: 'Confirmed',
      dataIndex: 'confirmed',
      key: 'confirmed',
      width: 110,
      align: 'center',
      render: (v: boolean) =>
        v ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
        ) : (
          <Tag color="red" icon={<CloseCircleOutlined />}>No</Tag>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      align: 'center',
      render: (_: unknown, row: GlobalAdminUser) =>
        status === 'deleted' ? (
          <Space size={4}>
            <Button size="small" icon={<UndoOutlined />} onClick={() => onRestore(row)}>Restore</Button>
            <Popconfirm
              title={`Permanently delete ${row.name}?`}
              description="This cannot be undone."
              okText="Permanently delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => onPermanentDelete(row)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>Forever</Button>
            </Popconfirm>
          </Space>
        ) : (
          <UserActions
            row={row}
            me={me}
            onView={() => router.push(`/admin/access/users/${row.id}`)}
            onEdit={() => setEditing(row)}
            onKey={() => setPwTarget(row)}
            onImpersonate={() => onImpersonate(row)}
            onToggleStatus={() => onToggleStatus(row)}
            onDelete={() => onDelete(row)}
            onResend={() => onResend(row)}
          />
        ),
    },
  ];

  const emptyText =
    status === 'deactivated' ? 'No deactivated users found.' :
    status === 'deleted' ? 'No deleted users found.' :
    'No users found.';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary">
            {status === 'active' ? 'Active Users' : status === 'deactivated' ? 'Deactivated Users' : 'Deleted Users'}
          </Text>
        </div>
        <HeaderButtons isAdmin onCreateCompany={() => router.push('/admin/tenants')} />
      </div>

      <StatusTabs status={status} />

      <div style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search by name or email…"
          allowClear
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onSearch={(v) => { setSearch(v); setPage(1); }}
        />
      </div>

      <Table<GlobalAdminUser>
        rowKey="id"
        columns={activeColumns}
        dataSource={data?.data ?? []}
        loading={isFetching}
        size="small"
        scroll={{ x: true }}
        locale={{ emptyText }}
        pagination={{
          current: page,
          pageSize: perPage,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (total, range) => `Showing ${range[0]} to ${range[1]} of ${total} entries`,
          onChange: (p, ps) => { setPage(p); setPerPage(ps); },
        }}
        style={{ background: '#fff' }}
      />

      <UserFormModal
        open={editing !== null}
        user={editing}
        onClose={() => setEditing(null)}
        scope={{ tenantId: editing?.companyId ?? null, isAdmin: true }}
      />

      <Modal
        open={pwTarget !== null}
        title={`Change password — ${pwTarget?.email ?? ''}`}
        okText="Save"
        onOk={onChangePassword}
        onCancel={() => { setPwTarget(null); pwForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={pwForm} layout="vertical" preserve={false}>
          <Form.Item name="password" label="New password" rules={[{ required: true }, { min: 8 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm new password"
            dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* =========================================================================
 * COMPANY ADMIN tenant-scoped view
 * ========================================================================= */
function TenantUsersTable({
  me,
  tenantId,
  status,
}: {
  me: { id: number; isAdmin: boolean; activeTenantId: number | null };
  tenantId: number;
  status: StatusFilter;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const scope = { tenantId, isAdmin: me.isAdmin };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  const params = useMemo<ListAdminUsersParams>(() => {
    const p: ListAdminUsersParams = { page, perPage, sort: 'id', order: 'asc' };
    if (search) p.search = search;
    return p;
  }, [page, perPage, search]);

  const { data: activeData, isFetching: activeFetching } = useAdminUsers(scope, params);
  const { data: deactivatedData, isFetching: deactivatedFetching } = useDeactivatedUsers(scope, params);
  const { data: deletedData, isFetching: deletedFetching } = useDeletedUsers(scope, params);

  const toggleStatus = useToggleAdminUserStatus(scope);
  const remove = useDeleteAdminUser(scope);
  const restore = useRestoreUser(scope);
  const hardDelete = usePermanentDeleteUser(scope);
  const impersonate = useImpersonate();
  const changePw = useChangeUserPassword(scope);
  const resendConfirm = useResendConfirmation(scope);

  const data = status === 'deactivated' ? deactivatedData : status === 'deleted' ? deletedData : activeData;
  const isFetching = status === 'deactivated' ? deactivatedFetching : status === 'deleted' ? deletedFetching : activeFetching;

  const onToggleStatus = async (row: AdminUser) => {
    try {
      await toggleStatus.mutateAsync({ id: row.id, active: !row.active });
      message.success(row.active ? 'User deactivated.' : 'User activated.');
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onDelete = async (row: AdminUser) => {
    try {
      await remove.mutateAsync({ id: row.id });
      message.success('User deleted.');
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onRestore = async (row: AdminUser) => {
    try {
      await restore.mutateAsync({ id: row.id });
      message.success(`Restored ${row.email}.`);
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onPermanentDelete = async (row: AdminUser) => {
    try {
      await hardDelete.mutateAsync({ id: row.id });
      message.success(`Permanently deleted ${row.email}.`);
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onImpersonate = async (row: AdminUser) => {
    try {
      await impersonate.mutateAsync({ targetUserId: row.id, tenantId });
      message.success(`Impersonating ${row.name}.`);
      router.push('/dashboard');
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onChangePassword = async () => {
    if (!pwTarget) return;
    try {
      const values = await pwForm.validateFields();
      await changePw.mutateAsync({ id: pwTarget.id, password: values.password });
      message.success(`Password updated for ${pwTarget.email}.`);
      setPwTarget(null);
      pwForm.resetFields();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  const onResend = async (row: AdminUser) => {
    try {
      await resendConfirm.mutateAsync({ id: row.id });
      message.success(`Confirmation queued for ${row.email}.`);
    } catch (err) { message.error(toApiError(err).message); }
  };

  const columns: ColumnsType<AdminUser> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 65 },
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: 'E-mail', dataIndex: 'email', key: 'email',
      render: (email: string) => <Text copyable={{ text: email }}>{email}</Text>,
    },
    {
      title: 'Roles', dataIndex: 'roles', key: 'roles', width: 140,
      render: (roles: string[]) =>
        roles.length ? <Tag color="blue">{roles[0]}</Tag> : <Tag color="default">None</Tag>,
    },
    {
      title: 'Confirmed', dataIndex: 'confirmed', key: 'confirmed', width: 110, align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
          : <Tag color="red"   icon={<CloseCircleOutlined />}>No</Tag>,
    },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 110,
      render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '—'),
    },
    {
      title: 'Actions', key: 'actions', width: 220, align: 'center',
      render: (_: unknown, row: AdminUser) =>
        status === 'deleted' ? (
          <Space size={4}>
            <Button size="small" icon={<UndoOutlined />} onClick={() => onRestore(row)}>Restore</Button>
            <Popconfirm
              title={`Permanently delete ${row.name}?`}
              description="This cannot be undone."
              okText="Permanently delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => onPermanentDelete(row)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>Forever</Button>
            </Popconfirm>
          </Space>
        ) : (
          <UserActions
            row={row}
            me={me}
            onView={() => router.push(`/admin/access/users/${row.id}`)}
            onEdit={() => setEditing(row)}
            onKey={() => setPwTarget(row)}
            onImpersonate={() => onImpersonate(row)}
            onToggleStatus={() => onToggleStatus(row)}
            onDelete={() => onDelete(row)}
            onResend={() => onResend(row)}
          />
        ),
    },
  ];

  const emptyText =
    status === 'deactivated' ? 'No deactivated users found.' :
    status === 'deleted' ? 'No deleted users found.' :
    'No users found.';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary">
            {status === 'active' ? 'Active Users' : status === 'deactivated' ? 'Deactivated Users' : 'Deleted Users'}
          </Text>
        </div>
        <HeaderButtons isAdmin={me.isAdmin} onCreateCompany={() => router.push('/admin/tenants')} />
      </div>

      <StatusTabs status={status} />

      <div style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search by name or email…"
          allowClear
          style={{ maxWidth: 360 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onSearch={(v) => { setSearch(v); setPage(1); }}
        />
      </div>

      <Table<AdminUser>
        rowKey="id"
        columns={columns}
        dataSource={data?.data ?? []}
        loading={isFetching}
        size="small"
        scroll={{ x: true }}
        locale={{ emptyText }}
        pagination={{
          current: page,
          pageSize: perPage,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (total, range) => `Showing ${range[0]} to ${range[1]} of ${total} entries`,
          onChange: (p, ps) => { setPage(p); setPerPage(ps); },
        }}
        style={{ background: '#fff' }}
      />

      <UserFormModal open={editing !== null} user={editing} onClose={() => setEditing(null)} scope={scope} />

      <Modal
        open={pwTarget !== null}
        title={`Change password — ${pwTarget?.email ?? ''}`}
        okText="Save"
        onOk={onChangePassword}
        onCancel={() => { setPwTarget(null); pwForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={pwForm} layout="vertical" preserve={false}>
          <Form.Item name="password" label="New password" rules={[{ required: true }, { min: 8 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm" label="Confirm new password" dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

/* =========================================================================
 * Page entry point — picks the correct view based on role + ?status param
 * ========================================================================= */
export default function UsersPage() {
  const { data: me } = useMe();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get('status');
  const status: StatusFilter =
    rawStatus === 'deactivated' ? 'deactivated' :
    rawStatus === 'deleted' ? 'deleted' :
    'active';

  if (!me) return null;

  if (me.isAdmin && !me.activeTenantId) {
    return <GlobalUsersTable me={me} status={status} />;
  }

  const tenantId = me.activeTenantId;
  if (!tenantId) {
    return <Text type="danger">You are not associated with a tenant.</Text>;
  }

  return <TenantUsersTable me={me} tenantId={tenantId} status={status} />;
}

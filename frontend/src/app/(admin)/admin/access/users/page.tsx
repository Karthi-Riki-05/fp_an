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
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toApiError } from '../../../../../lib/api-client';
import {
  ListAdminUsersParams,
  useAdminUsers,
  useChangeUserPassword,
  useDeleteAdminUser,
  useGlobalUsers,
  useResendConfirmation,
  useToggleAdminUserStatus,
} from '../../../../../lib/api/admin-users';
import { useImpersonate, useMe } from '../../../../../lib/api/auth';
import type { AdminUser, GlobalAdminUser } from '../../../../../lib/api/types';
import { UserFormModal } from './UserFormModal';

const { Text, Title } = Typography;

/* -------------------------------------------------------------------------
 * Shared action buttons (view, edit, key, impersonate, delete)
 * ------------------------------------------------------------------------- */
function UserActions({
  row,
  me,
  onEdit,
  onKey,
  onImpersonate,
  onToggleStatus,
  onDelete,
  onResend,
}: {
  row: AdminUser;
  me: { id: number; isAdmin: boolean };
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
        <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#00a65a' }} />} onClick={onEdit} />
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
        description="This is a soft delete."
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

/* -------------------------------------------------------------------------
 * Header tab buttons — matches old "All Users | Add New | Create Company"
 * ------------------------------------------------------------------------- */
function HeaderButtons({
  isAdmin,
  onAddUser,
  onCreateCompany,
}: {
  isAdmin: boolean;
  onAddUser: () => void;
  onCreateCompany: () => void;
}) {
  return (
    <Space>
      <Button
        type="primary"
        style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        onClick={() => {}}
      >
        All Users
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ background: '#00a65a', borderColor: '#00a65a' }}
        onClick={onAddUser}
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

/* =========================================================================
 * SUPERADMIN global view — all users across all tenants
 * ========================================================================= */
function GlobalUsersTable({ me }: { me: { id: number; isAdmin: boolean } }) {
  const { message } = App.useApp();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  const scope = { tenantId: null, isAdmin: true };
  const params = useMemo<ListAdminUsersParams>(() => {
    const p: ListAdminUsersParams = { page, perPage, sort: 'id', order: 'asc' };
    if (search) p.search = search;
    return p;
  }, [page, perPage, search]);

  const { data, isFetching } = useGlobalUsers(params);
  const toggleStatus = useToggleAdminUserStatus(scope);
  const remove = useDeleteAdminUser(scope);
  const impersonate = useImpersonate();
  const changePw = useChangeUserPassword(scope);
  const resendConfirm = useResendConfirmation(scope);

  const onToggleStatus = async (row: AdminUser) => {
    try {
      await toggleStatus.mutateAsync({ id: row.id, active: !row.active });
      message.success(row.active ? 'User deactivated.' : 'User activated.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onDelete = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      message.success('User deleted.');
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
      await resendConfirm.mutateAsync(row.id);
      message.success(`Confirmation email queued for ${row.email}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const columns: ColumnsType<GlobalAdminUser> = [
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
        roles.length ? (
          <Tag color="blue">{roles[0]}</Tag>
        ) : (
          <Tag color="default">None</Tag>
        ),
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
      width: 200,
      align: 'center',
      render: (_: unknown, row: GlobalAdminUser) => (
        <UserActions
          row={row}
          me={me}
          onEdit={() => setEditing(row)}
          onKey={() => setPwTarget(row)}
          onImpersonate={() => onImpersonate(row)}
          onToggleStatus={() => onToggleStatus(row)}
          onDelete={() => onDelete(row.id)}
          onResend={() => onResend(row)}
        />
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary">Active Users</Text>
        </div>
        <HeaderButtons
          isAdmin
          onAddUser={() => setCreateOpen(true)}
          onCreateCompany={() => router.push('/admin/tenants')}
        />
      </div>

      {/* Sub-tabs: All | Deactivated | Deleted */}
      <Space style={{ marginBottom: 12 }}>
        <Button size="small" type="primary" style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>All Users</Button>
        <Button size="small" onClick={() => router.push('/admin/access/users/deactivated')}>Deactivated Users</Button>
        <Button size="small" onClick={() => router.push('/admin/access/users/deleted')}>Deleted Users</Button>
      </Space>

      {/* Search */}
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

      {/* Table */}
      <Table<GlobalAdminUser>
        rowKey="id"
        columns={columns}
        dataSource={data?.data ?? []}
        loading={isFetching}
        size="small"
        scroll={{ x: true }}
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

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} scope={scope} />
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
 * COMPANY ADMIN tenant-scoped view — existing behaviour
 * ========================================================================= */
function TenantUsersTable({
  me,
  tenantId,
}: {
  me: { id: number; isAdmin: boolean; activeTenantId: number | null };
  tenantId: number;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const scope = { tenantId, isAdmin: me.isAdmin };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  const params = useMemo<ListAdminUsersParams>(() => {
    const p: ListAdminUsersParams = { page, perPage, sort: 'id', order: 'asc' };
    if (search) p.search = search;
    return p;
  }, [page, perPage, search]);

  const { data, isFetching } = useAdminUsers(scope, params);
  const toggleStatus = useToggleAdminUserStatus(scope);
  const remove = useDeleteAdminUser(scope);
  const impersonate = useImpersonate();
  const changePw = useChangeUserPassword(scope);
  const resendConfirm = useResendConfirmation(scope);

  const onToggleStatus = async (row: AdminUser) => {
    try {
      await toggleStatus.mutateAsync({ id: row.id, active: !row.active });
      message.success(row.active ? 'User deactivated.' : 'User activated.');
    } catch (err) { message.error(toApiError(err).message); }
  };

  const onDelete = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      message.success('User deleted.');
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
      await resendConfirm.mutateAsync(row.id);
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
      title: 'Actions', key: 'actions', width: 200, align: 'center',
      render: (_: unknown, row: AdminUser) => (
        <UserActions
          row={row}
          me={me}
          onEdit={() => setEditing(row)}
          onKey={() => setPwTarget(row)}
          onImpersonate={() => onImpersonate(row)}
          onToggleStatus={() => onToggleStatus(row)}
          onDelete={() => onDelete(row.id)}
          onResend={() => onResend(row)}
        />
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary">Active Users</Text>
        </div>
        <HeaderButtons isAdmin={me.isAdmin} onAddUser={() => setCreateOpen(true)} onCreateCompany={() => router.push('/admin/tenants')} />
      </div>

      <Space style={{ marginBottom: 12 }}>
        <Button size="small" type="primary" style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>All Users</Button>
        <Button size="small" onClick={() => router.push('/admin/access/users/deactivated')}>Deactivated Users</Button>
        <Button size="small" onClick={() => router.push('/admin/access/users/deleted')}>Deleted Users</Button>
      </Space>

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

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} scope={scope} />
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
 * Page entry point — picks the correct view based on role
 * ========================================================================= */
export default function UsersPage() {
  const { data: me } = useMe();

  if (!me) return null;

  // Superadmin without tenant → global view
  if (me.isAdmin && !me.activeTenantId) {
    return <GlobalUsersTable me={me} />;
  }

  // Company admin (or superadmin with active tenant) → tenant-scoped view
  const tenantId = me.activeTenantId;
  if (!tenantId) {
    return <Text type="danger">You are not associated with a tenant.</Text>;
  }

  return <TenantUsersTable me={me} tenantId={tenantId} />;
}

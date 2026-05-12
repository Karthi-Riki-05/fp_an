'use client';

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { toApiError } from '../../../../../../lib/api-client';
import {
  useAdminUser,
  useChangeUserPassword,
  useDeleteAdminUser,
  useResendConfirmation,
  useToggleAdminUserStatus,
} from '../../../../../../lib/api/admin-users';
import { useMe } from '../../../../../../lib/api/auth';
import { UserFormModal } from '../UserFormModal';

const { Title, Text } = Typography;

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const userId = Number(idStr);
  const router = useRouter();
  const { message } = App.useApp();

  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };
  const { data: user, isLoading, refetch } = useAdminUser(scope, userId);

  const toggleStatus = useToggleAdminUserStatus(scope);
  const remove = useDeleteAdminUser(scope);
  const resendConfirm = useResendConfirmation(scope);
  const changePw = useChangeUserPassword(scope);

  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm] = Form.useForm<{ password: string; confirm: string }>();

  if (!me) return null;

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="User not found." />
        <Button icon={<ArrowLeftOutlined />} style={{ marginTop: 16 }} onClick={() => router.back()}>
          Back
        </Button>
      </div>
    );
  }

  const onToggleStatus = async () => {
    try {
      await toggleStatus.mutateAsync({ id: user.id, active: !user.active });
      message.success(user.active ? 'User deactivated.' : 'User activated.');
      await refetch();
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync({ id: user.id });
      message.success('User deleted.');
      router.push('/admin/access/users');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onResend = async () => {
    try {
      await resendConfirm.mutateAsync(user.id);
      message.success('Confirmation email queued.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onSavePassword = async () => {
    try {
      const values = await pwForm.validateFields();
      await changePw.mutateAsync({ id: user.id, password: values.password });
      message.success('Password updated.');
      setPwOpen(false);
      pwForm.resetFields();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  const isSelf = me.id === user.id;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/admin/access/users')}>
          Back to Users
        </Button>
        <Title level={4} style={{ margin: 0 }}>User Detail</Title>
      </div>

      {!user.confirmed && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message="This user has not confirmed their email yet."
          action={
            <Button size="small" icon={<MailOutlined />} onClick={onResend}>
              Resend confirmation email
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Title level={3} style={{ margin: 0 }}>{user.name}</Title>
        <Tag color={user.active ? 'green' : 'red'}>{user.active ? 'Active' : 'Inactive'}</Tag>
        <Tag color={user.confirmed ? 'green' : 'orange'}>
          {user.confirmed ? <><CheckCircleOutlined /> Confirmed</> : <><CloseCircleOutlined /> Unconfirmed</>}
        </Tag>
        {user.roles.map((r) => <Tag key={r} color="blue">{r}</Tag>)}
      </div>

      <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
        <Descriptions.Item label="ID">{user.id}</Descriptions.Item>
        <Descriptions.Item label="Name">{user.name}</Descriptions.Item>
        <Descriptions.Item label="First name">{user.firstName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Last name">{user.lastName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">
          <Text copyable={{ text: user.email }}>{user.email}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Roles">
          {user.roles.length ? user.roles.map((r) => <Tag key={r} color="blue">{r}</Tag>) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={user.active ? 'green' : 'red'}>{user.active ? 'Active' : 'Inactive'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Confirmed">
          {user.confirmed
            ? <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
            : <Tag color="orange" icon={<CloseCircleOutlined />}>No</Tag>
          }
        </Descriptions.Item>
        <Descriptions.Item label="Created at">
          {user.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
        </Descriptions.Item>
      </Descriptions>

      <Space wrap>
        <Button icon={<EditOutlined />} type="primary" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <Button icon={<KeyOutlined />} onClick={() => setPwOpen(true)}>
          Change Password
        </Button>
        <Button
          icon={user.active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          danger={user.active}
          onClick={onToggleStatus}
          disabled={isSelf}
        >
          {user.active ? 'Deactivate' : 'Activate'}
        </Button>
        {!user.confirmed && (
          <Button icon={<MailOutlined />} onClick={onResend}>
            Resend Confirmation
          </Button>
        )}
        <Popconfirm
          title={`Delete ${user.name}?`}
          description="This is a soft delete. The user can be restored from the Deleted Users tab."
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
          disabled={isSelf}
        >
          <Button danger icon={<DeleteOutlined />} disabled={isSelf}>
            Delete
          </Button>
        </Popconfirm>
      </Space>

      <UserFormModal
        open={editOpen}
        user={user}
        onClose={() => { setEditOpen(false); refetch(); }}
        scope={scope}
      />

      <Modal
        open={pwOpen}
        title={`Change password — ${user.email}`}
        okText="Save"
        onOk={onSavePassword}
        onCancel={() => { setPwOpen(false); pwForm.resetFields(); }}
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
    </div>
  );
}

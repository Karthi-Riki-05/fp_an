'use client';

import { App, Button, Card, Checkbox, Form, Input, InputNumber, Skeleton, Space, Switch, Typography } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { toApiError } from '../../../../../../../lib/api-client';
import { useMe } from '../../../../../../../lib/api/auth';
import {
  useRole,
  useUpdateRole,
  usePermissionInventory,
  type PermissionRow,
} from '../../../../../../../lib/api/roles';

const { Title, Text } = Typography;

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const { data: me } = useMe();
  const { message } = App.useApp();

  const role = useRole(Number.isFinite(id) ? id : null);
  const inventory = usePermissionInventory();
  const update = useUpdateRole();

  const [form] = Form.useForm<{
    name: string;
    sort: number;
    all: boolean;
    permissions: string[];
  }>();

  useEffect(() => {
    if (role.data) {
      form.setFieldsValue({
        name: role.data.name,
        sort: role.data.sort,
        all: role.data.all,
        permissions: role.data.permissions,
      });
    }
  }, [role.data, form]);

  const groupedPermissions = useMemo(() => {
    if (!inventory.data) return [];
    // Bucket permissions by their prefix verb (manage / write / view / etc.)
    const groups: Record<string, PermissionRow[]> = {};
    inventory.data.forEach((p) => {
      const prefix = p.name.split('-')[0];
      groups[prefix] = groups[prefix] || [];
      groups[prefix].push(p);
    });
    return Object.entries(groups).map(([k, v]) => ({ key: k, items: v.sort((a, b) => a.sort - b.sort) }));
  }, [inventory.data]);

  if (!Number.isFinite(id)) {
    return <Text type="danger">Invalid role id.</Text>;
  }
  if (role.isLoading || inventory.isLoading) {
    return <Skeleton active />;
  }
  if (role.isError || !role.data) {
    return <Text type="danger">Could not load role.</Text>;
  }

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      await update.mutateAsync({
        id,
        input: {
          name: v.name,
          sort: v.sort,
          all: v.all,
          permissions: v.permissions,
        },
      });
      message.success('Role saved.');
      router.push('/admin/access/roles');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  const isAllRole = role.data.all;
  const allPermissions = inventory.data ?? [];
  const allNames = allPermissions.map((p) => p.name);

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>
        Edit role: {role.data.name}
        {isAllRole && <Text type="secondary" style={{ fontSize: 13, marginLeft: 12 }}>(super-admin: all permissions implicit)</Text>}
      </Title>
      <Text type="secondary">
        Permissions you check here become the role's grant set. Saving replaces the previous set entirely.
      </Text>

      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Card>
          <Space size="large" wrap>
            <Form.Item name="name" label="Name" rules={[{ required: true }, { max: 255 }]}>
              <Input style={{ width: 320 }} />
            </Form.Item>
            <Form.Item name="sort" label="Sort">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="all" label="All permissions (super-admin)" valuePropName="checked">
              <Switch disabled={!me?.isAdmin} />
            </Form.Item>
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }} title="Permission matrix">
          <Form.Item name="permissions" noStyle>
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space size="small">
                  <Button
                    size="small"
                    onClick={() => form.setFieldValue('permissions', allNames)}
                    disabled={isAllRole}
                  >
                    Select all
                  </Button>
                  <Button
                    size="small"
                    onClick={() => form.setFieldValue('permissions', [])}
                    disabled={isAllRole}
                  >
                    Clear
                  </Button>
                  {isAllRole && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Administrator implicitly holds every permission. Editing the matrix is a no-op.
                    </Text>
                  )}
                </Space>

                {groupedPermissions.map((g) => (
                  <div key={g.key}>
                    <div style={{ fontWeight: 600, color: '#333', marginBottom: 8, fontSize: 13, textTransform: 'capitalize' }}>
                      {g.key}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
                      {g.items.map((p) => (
                        <Checkbox key={p.name} value={p.name}>
                          <span style={{ fontSize: 13 }}>{p.displayName}</span>
                          <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>
                            ({p.name})
                          </Text>
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Card>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={() => router.push('/admin/access/roles')}>Cancel</Button>
          <Button type="primary" loading={update.isPending} onClick={onSubmit} style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>
            Save
          </Button>
        </div>
      </Form>
    </div>
  );
}

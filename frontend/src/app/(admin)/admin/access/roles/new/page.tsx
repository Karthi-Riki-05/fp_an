'use client';

import { App, Button, Card, Checkbox, Form, Input, InputNumber, Skeleton, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { toApiError } from '../../../../../../lib/api-client';
import { useCreateRole, usePermissionInventory } from '../../../../../../lib/api/roles';

const { Title, Text } = Typography;

export default function NewRolePage() {
  const router = useRouter();
  const { message } = App.useApp();
  const inventory = usePermissionInventory();
  const create = useCreateRole();
  const [form] = Form.useForm<{ name: string; sort: number; permissions: string[] }>();

  if (inventory.isLoading) return <Skeleton active />;

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      const created = await create.mutateAsync({
        name: v.name,
        sort: v.sort ?? 0,
        permissions: v.permissions ?? [],
      });
      message.success(`Created role "${created.name}".`);
      router.push('/admin/access/roles');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <Title level={4} style={{ margin: 0 }}>New role</Title>
      <Text type="secondary">Create a non-super-admin role and assign its permissions.</Text>

      <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ permissions: [] }}>
        <Card>
          <Space size="large" wrap>
            <Form.Item name="name" label="Name" rules={[{ required: true }, { max: 255 }]}>
              <Input style={{ width: 320 }} />
            </Form.Item>
            <Form.Item name="sort" label="Sort">
              <InputNumber min={0} defaultValue={0} />
            </Form.Item>
          </Space>
        </Card>

        <Card style={{ marginTop: 16 }} title="Permissions">
          <Form.Item name="permissions" noStyle>
            <Checkbox.Group>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
                {(inventory.data ?? []).map((p) => (
                  <Checkbox key={p.name} value={p.name}>
                    {p.displayName} <Text type="secondary" style={{ fontSize: 11 }}>({p.name})</Text>
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Card>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={() => router.push('/admin/access/roles')}>Cancel</Button>
          <Button type="primary" loading={create.isPending} onClick={onSubmit} style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>
            Create
          </Button>
        </div>
      </Form>
    </div>
  );
}

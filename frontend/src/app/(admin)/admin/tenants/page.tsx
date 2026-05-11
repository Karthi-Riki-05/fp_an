'use client';

import { PlusOutlined } from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import { useCreateTenant, useTenantsList } from '../../../../lib/api/tenants';
import type { TenantSummary } from '../../../../lib/api/types';

const { Title, Text } = Typography;

interface CreateForm {
  name: string;
  slug: string;
  timezone?: string;
}

export default function TenantsPage() {
  const { data: me } = useMe();
  const list = useTenantsList({ enabled: Boolean(me?.isAdmin) });
  const create = useCreateTenant();
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateForm>();
  const [open, setOpen] = useState(false);

  if (!me?.isAdmin) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Admin only"
        description="You need the Administrator role (or manage-tenants permission) to access this page."
      />
    );
  }

  const onSubmit = async (values: CreateForm) => {
    try {
      const t = await create.mutateAsync(values);
      message.success(`Created tenant "${t.name}" (id ${t.id}, schema ${t.schemaName}).`);
      setOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const columns: ColumnsType<TenantSummary> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Slug', dataIndex: 'slug', render: (v: string) => <Text code>{v}</Text> },
    { title: 'Schema', dataIndex: 'schemaName', render: (v: string) => <Text code>{v}</Text> },
    { title: 'Timezone', dataIndex: 'timezone' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : v === 'suspended' ? 'orange' : 'default'}>{v}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          Tenants
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            New tenant
          </Button>
        </Space>
      </div>

      <Table<TenantSummary>
        rowKey="id"
        columns={columns}
        dataSource={list.data ?? []}
        loading={list.isLoading}
        pagination={false}
        scroll={{ x: true }}
        style={{ marginTop: 16, background: '#fff' }}
      />

      <Modal
        title="New tenant"
        open={open}
        okText="Create"
        confirmLoading={create.isPending}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<CreateForm>
          form={form}
          layout="vertical"
          initialValues={{ timezone: 'Europe/Stockholm' }}
          onFinish={onSubmit}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required.' }]}
          >
            <Input placeholder="Acme Corp" />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            tooltip="Lowercase a-z 0-9 underscore. Used to derive the Postgres schema name."
            rules={[
              { required: true, message: 'Slug is required.' },
              { pattern: /^[a-z][a-z0-9_]*$/, message: 'lowercase a-z/0-9/_, start with letter' },
            ]}
          >
            <Input placeholder="acme" />
          </Form.Item>
          <Form.Item name="timezone" label="Timezone">
            <Input placeholder="Europe/Stockholm" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

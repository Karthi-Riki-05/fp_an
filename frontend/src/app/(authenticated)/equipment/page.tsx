'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { toApiError } from '../../../lib/api-client';
import { useMe } from '../../../lib/api/auth';
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentList,
} from '../../../lib/api/equipment';
import type { Equipment } from '../../../lib/api/types';

const { Title, Text } = Typography;

interface CreateForm {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
}

export default function EquipmentPage() {
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const list = useEquipmentList(tenantId);
  const create = useCreateEquipment(tenantId);
  const remove = useDeleteEquipment(tenantId);
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateForm>();
  const [open, setOpen] = useState(false);

  const onSubmit = async (values: CreateForm) => {
    try {
      await create.mutateAsync({
        name: values.name,
        parentId: values.parentId,
        typeId: values.typeId,
        description: values.description,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      });
      message.success('Equipment created.');
      setOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onDelete = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      message.success('Equipment deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const columns: ColumnsType<Equipment> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', render: (v: string | null) => v ?? <Text type="secondary">(unnamed)</Text> },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    { title: 'Sort', dataIndex: 'sortOrder', width: 80 },
    { title: 'Parent', dataIndex: 'parentId', width: 80 },
    { title: 'Type', dataIndex: 'typeId', width: 80 },
    {
      title: 'Active',
      dataIndex: 'isActive',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'active' : 'inactive'}</Tag>,
    },
    {
      title: '',
      width: 80,
      render: (_, row) => (
        <Popconfirm
          title="Delete this equipment?"
          okText="Delete"
          cancelText="Cancel"
          onConfirm={() => onDelete(row.id)}
        >
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  if (!tenantId) {
    return (
      <div>
        <Title level={3}>Equipment</Title>
        <Text type="secondary">
          You're acting at platform scope (no active tenant). Visit{' '}
          <strong>Tenants (admin)</strong> to create or pick one, or sign in as a tenant
          user.
        </Text>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Equipment
          </Title>
          <Text type="secondary">tenant {tenantId}</Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            New
          </Button>
        </Space>
      </div>

      <Table<Equipment>
        rowKey="id"
        columns={columns}
        dataSource={list.data ?? []}
        loading={list.isLoading}
        pagination={false}
        style={{ marginTop: 16, background: '#fff' }}
      />

      <Modal
        title="New equipment"
        open={open}
        okText="Create"
        confirmLoading={create.isPending}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<CreateForm>
          form={form}
          layout="vertical"
          initialValues={{ isActive: true, sortOrder: 0 }}
          onFinish={onSubmit}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required.' }]}
          >
            <Input placeholder="e.g. CNC-01" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
          <Space size="middle">
            <Form.Item name="parentId" label="Parent ID">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
            <Form.Item name="typeId" label="Type ID">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort order">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
          </Space>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

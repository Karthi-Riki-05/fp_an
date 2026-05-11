'use client';

import { CheckCircleOutlined, CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Switch, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useCreateSocial, useSocialList, useUpdateSocial, type SocialRow } from '../../../../lib/api/social';

const { Title, Text } = Typography;

export default function SocialManagementPage() {
  const { message } = App.useApp();
  const { data, isLoading } = useSocialList();
  const create = useCreateSocial();
  const update = useUpdateSocial();

  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ varKey: string; varValue: string; status: boolean }>();
  // editing keeps the optimistic value as the user types
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const onSaveValue = async (row: SocialRow) => {
    const next = drafts[row.id];
    if (next === undefined || next === (row.varValue ?? '')) return;
    try {
      await update.mutateAsync({ id: row.id, input: { varValue: next } });
      message.success(`${row.varKey} link saved.`);
      setDrafts((d) => {
        const { [row.id]: _, ...rest } = d;
        return rest;
      });
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onToggleStatus = async (row: SocialRow) => {
    try {
      await update.mutateAsync({ id: row.id, input: { status: !row.status } });
      message.success(`${row.varKey} ${!row.status ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onCreate = async () => {
    try {
      const v = await createForm.validateFields();
      await create.mutateAsync({ varKey: v.varKey, varValue: v.varValue, status: v.status });
      message.success(`Added ${v.varKey}.`);
      setCreating(false);
      createForm.resetFields();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Social Management</Title>
          <Text type="secondary">Inline-edit URLs; click save to persist. The status toggle hides a row from the public site.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        >
          Add platform
        </Button>
      </div>

      <Table<SocialRow>
        style={{ marginTop: 16 }}
        rowKey="id"
        loading={isLoading}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          {
            title: 'Media Name',
            dataIndex: 'varKey',
            width: 180,
            render: (v: string) => <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{v}</span>,
          },
          {
            title: 'Link',
            dataIndex: 'varValue',
            render: (v: string | null, row) => (
              <span style={{ display: 'inline-flex', gap: 8, width: '100%' }}>
                <Input
                  defaultValue={v ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  onBlur={() => onSaveValue(row)}
                  onPressEnter={() => onSaveValue(row)}
                  placeholder={`https://example.com/...`}
                />
              </span>
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            render: (v: boolean, row) => (
              <Switch
                checked={v}
                checkedChildren={<CheckCircleOutlined />}
                unCheckedChildren={<CloseCircleOutlined />}
                onChange={() => onToggleStatus(row)}
              />
            ),
          },
        ]}
      />

      <Modal
        open={creating}
        title="Add a social platform"
        okText="Create"
        confirmLoading={create.isPending}
        onOk={onCreate}
        onCancel={() => {
          setCreating(false);
          createForm.resetFields();
        }}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false} initialValues={{ status: true }}>
          <Form.Item
            name="varKey"
            label="Platform key"
            rules={[{ required: true }, { pattern: /^[a-z0-9_-]{1,32}$/, message: 'lowercase letters, digits, _ or -' }]}
          >
            <Input placeholder="facebook" />
          </Form.Item>
          <Form.Item name="varValue" label="URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="status" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

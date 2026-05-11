'use client';

import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Popconfirm, Switch, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import {
  useCmsList,
  useCreateCms,
  useDeleteCms,
  useUpdateCms,
  type CmsRow,
} from '../../../../lib/api/cms';

const { Title, Text } = Typography;

interface CmsModalProps {
  open: boolean;
  row: CmsRow | null;
  onClose: () => void;
}

function CmsModal({ open, row, onClose }: CmsModalProps) {
  const { message } = App.useApp();
  const create = useCreateCms();
  const update = useUpdateCms();
  const [form] = Form.useForm<{ slug: string; title: string; content: string; status: boolean }>();

  const isEdit = row !== null;

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      if (isEdit && row) {
        await update.mutateAsync({ id: row.id, input: { title: v.title, content: v.content, status: v.status } });
        message.success('CMS entry saved.');
      } else {
        await create.mutateAsync({ slug: v.slug, title: v.title, content: v.content, status: v.status });
        message.success('CMS entry created.');
      }
      form.resetFields();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit CMS entry: ${row.title}` : 'New CMS entry'}
      okText={isEdit ? 'Save' : 'Create'}
      confirmLoading={create.isPending || update.isPending}
      onOk={onSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      destroyOnClose
      width={760}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          row
            ? { slug: row.slug, title: row.title, content: row.content ?? '', status: row.status }
            : { status: true }
        }
      >
        <Form.Item
          name="slug"
          label="Slug"
          rules={[{ required: true, message: 'Required' }, { max: 255 }]}
          extra={isEdit ? 'Slug cannot be changed after creation.' : 'Lowercase, dashes only — auto-normalised.'}
        >
          <Input disabled={isEdit} placeholder="vara-tjanster" />
        </Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true }, { max: 255 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="content" label="Content (HTML)">
          <Input.TextArea rows={10} placeholder="<p>...</p>" />
        </Form.Item>
        <Form.Item name="status" label="Published" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function CmsListPage() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const { data, isFetching } = useCmsList({ page, perPage });
  const remove = useDeleteCms();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CmsRow | null>(null);
  const [previewing, setPreviewing] = useState<CmsRow | null>(null);

  const onDelete = async (row: CmsRow) => {
    try {
      await remove.mutateAsync(row.id);
      message.success('CMS entry deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>CMS Management</Title>
          <Text type="secondary">Site-wide content blocks (e.g. "Vara Tjänster") rendered on the marketing pages.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        >
          New entry
        </Button>
      </div>

      <Table<CmsRow>
        style={{ marginTop: 16 }}
        rowKey="id"
        loading={isFetching}
        dataSource={data?.data ?? []}
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
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: 'Slug', dataIndex: 'slug', width: 200, render: (v) => <Text code>{v}</Text> },
          { title: 'Title', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 100,
            render: (v: boolean) =>
              v ? <Tag color="success">Published</Tag> : <Tag color="default">Draft</Tag>,
          },
          {
            title: 'Updated',
            dataIndex: 'updatedAt',
            width: 170,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: 'Actions',
            width: 160,
            render: (_, row) => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setPreviewing(row)} />
                <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => setEditing(row)} />
                <Popconfirm title="Delete this CMS entry?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(row)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <CmsModal open={creating} row={null} onClose={() => setCreating(false)} />
      <CmsModal open={editing !== null} row={editing} onClose={() => setEditing(null)} />

      <Modal
        open={previewing !== null}
        title={previewing?.title}
        footer={null}
        onCancel={() => setPreviewing(null)}
        width={760}
      >
        {previewing && (
          <div>
            <Tag>{previewing.slug}</Tag>
            <div
              style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}
              // eslint-disable-next-line react/no-danger -- Super Admin authored content; XSS-safe in this context.
              dangerouslySetInnerHTML={{ __html: previewing.content ?? '' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Form, Input, Modal, Popconfirm, Switch, Table, Tag, Typography, Upload, type UploadFile } from 'antd';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import {
  useCreateTestimonial,
  useDeleteTestimonial,
  useReplaceTestimonialImage,
  useTestimonials,
  useUpdateTestimonial,
  type TestimonialMeta,
  type TestimonialRow,
} from '../../../../lib/api/testimonials';

const { Title, Text } = Typography;

interface ModalProps {
  open: boolean;
  row: TestimonialRow | null;
  onClose: () => void;
}

function TestimonialModal({ open, row, onClose }: ModalProps) {
  const { message } = App.useApp();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const replaceImage = useReplaceTestimonialImage();
  const [form] = Form.useForm<TestimonialMeta>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const isEdit = row !== null;

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      const file = fileList[0]?.originFileObj as File | undefined;

      if (isEdit && row) {
        await update.mutateAsync({ id: row.id, meta: v });
        if (file) await replaceImage.mutateAsync({ id: row.id, file });
        message.success('Testimonial saved.');
      } else {
        await create.mutateAsync({ meta: v, file });
        message.success('Testimonial created.');
      }
      form.resetFields();
      setFileList([]);
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit testimonial #${row.id}` : 'New testimonial'}
      okText={isEdit ? 'Save' : 'Create'}
      confirmLoading={create.isPending || update.isPending || replaceImage.isPending}
      onOk={onSubmit}
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        onClose();
      }}
      destroyOnClose
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          row
            ? {
                name: row.name,
                companyName: row.companyName,
                title: row.title ?? '',
                role: row.role ?? '',
                body: row.body,
                status: row.status,
                sortOrder: row.sortOrder,
              }
            : { status: true, sortOrder: 0 }
        }
      >
        <Form.Item name="name" label="Name" rules={[{ required: true }, { max: 255 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="companyName" label="Company name" rules={[{ required: true }, { max: 255 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="title" label="Title (optional)">
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="role" label="Speaker role (optional)">
          <Input maxLength={255} placeholder="e.g. Operations Manager" />
        </Form.Item>
        <Form.Item name="body" label="Quote / content" rules={[{ required: true }]}>
          <Input.TextArea rows={4} maxLength={20_000} />
        </Form.Item>
        <Form.Item label={isEdit ? 'Replace image (optional)' : 'Photo (optional)'}>
          <Upload
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList.slice(-1))}
            maxCount={1}
            accept="image/*"
          >
            <Button>Choose file…</Button>
          </Upload>
        </Form.Item>
        <Form.Item name="status" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function TestimonialsPage() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const { data, isFetching } = useTestimonials({ page, perPage });
  const remove = useDeleteTestimonial();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TestimonialRow | null>(null);

  const onDelete = async (row: TestimonialRow) => {
    try {
      await remove.mutateAsync(row.id);
      message.success('Testimonial deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Testimonials</Title>
          <Text type="secondary">Customer quotes shown on the marketing site.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        >
          Create Testimonial
        </Button>
      </div>

      <Table<TestimonialRow>
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
          {
            title: 'Photo',
            dataIndex: 'image',
            width: 80,
            render: (v: string | null, row) => (
              <Avatar src={v ?? undefined} shape="square" size={40}>
                {row.name.slice(0, 2).toUpperCase()}
              </Avatar>
            ),
          },
          { title: 'Name', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
          { title: 'Company', dataIndex: 'companyName' },
          { title: 'Quote', dataIndex: 'body', ellipsis: true },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 100,
            render: (v: boolean) =>
              v ? <Tag color="success">Active</Tag> : <Tag color="warning">Inactive</Tag>,
          },
          {
            title: 'Actions',
            width: 130,
            render: (_, row) => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => setEditing(row)} />
                <Popconfirm title="Delete this testimonial?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(row)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <TestimonialModal open={creating} row={null} onClose={() => setCreating(false)} />
      <TestimonialModal open={editing !== null} row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

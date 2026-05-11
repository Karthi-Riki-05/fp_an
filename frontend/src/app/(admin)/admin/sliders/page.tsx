'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Popconfirm, Switch, Table, Tag, Typography, Upload, type UploadFile } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import {
  useCreateSlider,
  useDeleteSlider,
  useReplaceSliderImage,
  useSliders,
  useUpdateSlider,
  type SliderMeta,
  type SliderRow,
} from '../../../../lib/api/sliders';

const { Title, Text } = Typography;

type FormValues = SliderMeta;

interface SliderModalProps {
  open: boolean;
  row: SliderRow | null;
  onClose: () => void;
}

function SliderModal({ open, row, onClose }: SliderModalProps) {
  const { message } = App.useApp();
  const create = useCreateSlider();
  const update = useUpdateSlider();
  const replaceImage = useReplaceSliderImage();
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const isEdit = row !== null;

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      const file = fileList[0]?.originFileObj as File | undefined;

      if (isEdit && row) {
        await update.mutateAsync({ id: row.id, meta: v });
        if (file) await replaceImage.mutateAsync({ id: row.id, file });
        message.success(`Updated slider.`);
      } else {
        if (!file) {
          message.error('Image is required for new sliders.');
          return;
        }
        await create.mutateAsync({ meta: v, file });
        message.success('Slider created.');
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
      title={isEdit ? `Edit slider #${row.id}` : 'New slider'}
      okText={isEdit ? 'Save' : 'Create'}
      confirmLoading={create.isPending || update.isPending || replaceImage.isPending}
      onOk={onSubmit}
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        onClose();
      }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          row
            ? {
                title: row.title ?? '',
                description: row.description ?? '',
                link: row.link ?? '',
                status: row.status,
                sortOrder: row.sortOrder,
              }
            : { status: true, sortOrder: 0 }
        }
      >
        <Form.Item name="title" label="Title">
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} maxLength={1024} />
        </Form.Item>
        <Form.Item name="link" label="Link URL">
          <Input maxLength={512} placeholder="https://..." />
        </Form.Item>
        <Form.Item label={isEdit ? 'Replace image (optional)' : 'Image'} required={!isEdit}>
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

export default function SlidersPage() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const { data, isFetching } = useSliders({ page, perPage });
  const remove = useDeleteSlider();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SliderRow | null>(null);

  const onDelete = async (row: SliderRow) => {
    try {
      await remove.mutateAsync(row.id);
      message.success('Slider deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Slider Management</Title>
          <Text type="secondary">Homepage carousel slides — image, title, link, sort order.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ background: '#01b9d0', borderColor: '#01b9d0' }}
        >
          Add New Slider
        </Button>
      </div>

      <Table<SliderRow>
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
          { title: 'S.No', dataIndex: 'id', width: 70 },
          { title: 'Title', dataIndex: 'title' },
          {
            title: 'Description',
            dataIndex: 'description',
            ellipsis: true,
            render: (v: string | null) => v || <Text type="secondary">—</Text>,
          },
          {
            title: 'Updated',
            dataIndex: 'updatedAt',
            width: 170,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
          },
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
                <Popconfirm title="Delete this slider?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(row)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />

      <SliderModal open={creating} row={null} onClose={() => setCreating(false)} />
      <SliderModal open={editing !== null} row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

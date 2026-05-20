'use client';

import { App, Button, Card, DatePicker, Form, Input, InputNumber, Spin, Space } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { useEditRow, useUpsertJson } from '../../../../../../lib/api/myresult';
import { toApiError } from '../../../../../../lib/api-client';

interface WarningRowDb {
  id: number;
  equipment_id: number;
  notification_text: string;
  from_time: string | null;
  to_time: string | null;
}

interface FormShape {
  equipmentId: number;
  notificationText: string;
  fromTime: dayjs.Dayjs | null;
  toTime: dayjs.Dayjs | null;
}

export default function WarningEditPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const editQ = useEditRow('warning', Number.isFinite(id) ? id : null);
  const upsert = useUpsertJson('warning');
  const [form] = Form.useForm<FormShape>();

  if (editQ.isFetching || !editQ.data) return <Spin />;
  const row = editQ.data.row as unknown as WarningRowDb;

  const initial: FormShape = {
    equipmentId: row.equipment_id,
    notificationText: row.notification_text ?? '',
    fromTime: row.from_time ? dayjs(row.from_time) : null,
    toTime: row.to_time ? dayjs(row.to_time) : null,
  };

  async function onFinish(v: FormShape) {
    try {
      await upsert.mutateAsync({
        id,
        equipmentId: v.equipmentId,
        notificationText: v.notificationText,
        fromTime: v.fromTime ? v.fromTime.toISOString() : null,
        toTime:   v.toTime   ? v.toTime.toISOString()   : null,
      });
      message.success('Saved.');
      router.push('/myresult/warning');
    } catch (err) { message.error(toApiError(err).message); }
  }

  return (
    <Card title={`Edit Warning #${id}`} bordered>
      <Form<FormShape>
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={onFinish}
      >
        <Form.Item name="equipmentId" label="Equipment ID" rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notificationText" label="Notification text" rules={[{ required: true }]}>
          <Input.TextArea rows={3} maxLength={512} />
        </Form.Item>
        <Form.Item name="fromTime" label="From time" rules={[{ required: true }]}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="toTime" label="To time" rules={[{ required: true }]}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Space>
          <Button onClick={() => router.push('/myresult/warning')}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={upsert.isPending}>Save</Button>
        </Space>
      </Form>
    </Card>
  );
}

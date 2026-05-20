'use client';

import { App, Card, Spin } from 'antd';
import dayjs from 'dayjs';
import { useParams, useRouter } from 'next/navigation';
import {
  StopDataForm, stopFormToInput, type StopFormShape,
} from '../../../../../../components/result/StopDataForm';
import { useEditRow, useUpsertMultipart } from '../../../../../../lib/api/myresult';
import { toApiError } from '../../../../../../lib/api-client';

interface StopRowDb {
  id: number;
  flow_id: number; flow_object_key: number; part_id: number;
  work_shift_id: number; work_shift_name: string | null;
  order_no: string | null; quantity: number;
  time: string | null; hours: number; minutes: number; sum_of_time: number;
  stop_type_id: number; reason: number;
  date: string; comment: string | null; picture: string | null;
}

export default function StopEditPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const editQ = useEditRow('stop', Number.isFinite(id) ? id : null);
  const upsert = useUpsertMultipart('stop');

  if (editQ.isFetching || !editQ.data) return <Spin />;
  const row = editQ.data.row as unknown as StopRowDb;

  const initial: Partial<StopFormShape> = {
    partId: row.part_id,
    workShiftId: row.work_shift_id || undefined,
    workShiftName: row.work_shift_name || undefined,
    orderNo: row.order_no ?? '',
    quantity: row.quantity,
    timeHours: row.hours,
    timeMinutes: row.minutes,
    stopTypeId: row.stop_type_id,
    reasonId: row.reason,
    date: row.date ? dayjs(row.date) : null,
    comment: row.comment ?? '',
  };

  async function onSubmit(values: StopFormShape) {
    try {
      const body = stopFormToInput(values) as unknown as Record<string, unknown>;
      await upsert.mutateAsync({ body: { ...body, id }, picture: null });
      message.success('Saved.');
      router.push('/myresult/stop');
    } catch (err) { message.error(toApiError(err).message); }
  }

  return (
    <Card title={`Edit Stop #${id}`} bordered>
      <StopDataForm
        tenantId={1}
        initialValues={initial}
        onSubmit={onSubmit}
        onCancel={() => router.push('/myresult/stop')}
        equipmentId={row.flow_object_key}
        selectedDate={row.date}
        initiallyShowShiftFallback={row.work_shift_id === 0}
      />
    </Card>
  );
}

'use client';

import { App, Card, Spin } from 'antd';
import dayjs from 'dayjs';
import { useParams, useRouter } from 'next/navigation';
import {
  ScrapDataForm, scrapFormToInput, type ScrapFormShape,
} from '../../../../../../components/result/ScrapDataForm';
import { useEditRow, useUpsertMultipart } from '../../../../../../lib/api/myresult';
import { toApiError } from '../../../../../../lib/api-client';

interface ScrapRowDb {
  id: number;
  flow_id: number; flow_object_key: number; part_id: number;
  work_shift_id: number; work_shift_name: string | null;
  order_no: string | null; quantity: number;
  scrap_type_id: number; reason: number;
  date: string; comment: string | null; picture: string | null;
}

export default function ScrapEditPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const editQ = useEditRow('scrap', Number.isFinite(id) ? id : null);
  const upsert = useUpsertMultipart('scrap');

  if (editQ.isFetching || !editQ.data) return <Spin />;
  const row = editQ.data.row as unknown as ScrapRowDb;

  const initial: Partial<ScrapFormShape> = {
    partId: row.part_id,
    workShiftId: row.work_shift_id || undefined,
    workShiftName: row.work_shift_name || undefined,
    orderNo: row.order_no ?? '',
    quantity: row.quantity,
    scrapTypeId: row.scrap_type_id,
    reasonId: row.reason,
    date: row.date ? (dayjs as unknown as (s: string) => unknown)(row.date) as ScrapFormShape['date'] : null,
    comment: row.comment ?? '',
  };

  async function onSubmit(values: ScrapFormShape) {
    try {
      const body = scrapFormToInput(values) as unknown as Record<string, unknown>;
      await upsert.mutateAsync({ body: { ...body, id }, picture: null });
      message.success('Saved.');
      router.push('/myresult/scrap');
    } catch (err) { message.error(toApiError(err).message); }
  }

  return (
    <Card title={`Edit Scrap #${id}`} bordered>
      <ScrapDataForm
        tenantId={1}
        initialValues={initial}
        onSubmit={onSubmit}
        onCancel={() => router.push('/myresult/scrap')}
        equipmentId={row.flow_object_key}
        selectedDate={row.date}
        initiallyShowShiftFallback={row.work_shift_id === 0}
      />
    </Card>
  );
}

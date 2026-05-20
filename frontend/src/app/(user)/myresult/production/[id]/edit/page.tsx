'use client';

import { App, Card, Spin } from 'antd';
import dayjs from 'dayjs';
import { useParams, useRouter } from 'next/navigation';
import {
  ProductionDataForm, productionFormToInput, type ProductionFormShape,
} from '../../../../../../components/result/ProductionDataForm';
import { useEditRow, useUpsertJson } from '../../../../../../lib/api/myresult';
import { toApiError } from '../../../../../../lib/api-client';

interface ProductionRowDb {
  id: number;
  flow_id: number; flow_object_key: number; part_id: number;
  work_shift_id: number; work_shift_name: string | null;
  order_no: string | null;
  work_hours: string | null; part_qty: number | null; planned_qty: number | null;
  date: string; comment: string | null;
}

export default function ProductionEditPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams();
  const id = Number(params?.id);
  const editQ = useEditRow('production', Number.isFinite(id) ? id : null);
  const upsert = useUpsertJson('production');

  if (editQ.isFetching || !editQ.data) return <Spin />;
  const row = editQ.data.row as unknown as ProductionRowDb;

  // workHours is a numeric float (hours) on the form; convert from "HH:MM:SS"
  const wh = row.work_hours ? (() => {
    const [h, m, s] = row.work_hours!.split(':').map(Number);
    return (h || 0) + ((m || 0) / 60) + ((s || 0) / 3600);
  })() : 0;

  const initial: Partial<ProductionFormShape> = {
    partId: row.part_id,
    workShiftId: row.work_shift_id || undefined,
    workShiftName: row.work_shift_name || undefined,
    orderNo: row.order_no ?? '',
    workHours: wh,
    partQty: row.part_qty ?? 0,
    plannedQty: row.planned_qty ?? 0,
    date: row.date ? (dayjs as unknown as (s: string) => unknown)(row.date) as ProductionFormShape['date'] : null,
    comment: row.comment ?? '',
  };

  async function onSubmit(values: ProductionFormShape) {
    try {
      const body = productionFormToInput(values) as unknown as Record<string, unknown>;
      await upsert.mutateAsync({ ...body, id });
      message.success('Saved.');
      router.push('/myresult/production');
    } catch (err) { message.error(toApiError(err).message); }
  }

  return (
    <Card title={`Edit Production #${id}`} bordered>
      <ProductionDataForm
        tenantId={1}
        initialValues={initial}
        onSubmit={onSubmit}
        onCancel={() => router.push('/myresult/production')}
        equipmentId={row.flow_object_key}
        selectedDate={row.date}
        initiallyShowShiftFallback={row.work_shift_id === 0}
      />
    </Card>
  );
}

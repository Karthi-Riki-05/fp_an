'use client';

import { Button, DatePicker, Form, Input, InputNumber, Select, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { usePartsForSelect, useReasonTypes, useReasonsForType } from './EditModalHooks';
import { WorkShiftDualSource } from './WorkShiftDualSource';

export interface ScrapFormShape {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  scrapTypeId?: number;
  reasonId?: number;
  orderNo?: string;
  quantity?: number;
  comment?: string;
  date?: Dayjs | null;
}

export interface ScrapUpdateInput {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  scrapTypeId?: number;
  reasonId?: number;
  orderNo?: string;
  quantity?: number;
  comment?: string;
  date?: string;
}

export function scrapFormToInput(values: ScrapFormShape): ScrapUpdateInput {
  const input: ScrapUpdateInput = {
    partId: values.partId,
    scrapTypeId: values.scrapTypeId,
    reasonId: values.reasonId,
    orderNo: values.orderNo,
    quantity: values.quantity,
    comment: values.comment,
    date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
  };
  if (values.workShiftId !== undefined) input.workShiftId = values.workShiftId;
  else if (values.workShiftName) input.workShiftName = values.workShiftName;
  return input;
}

export interface ScrapDataFormProps {
  initialValues?: Partial<ScrapFormShape>;
  onSubmit: (values: ScrapFormShape) => Promise<void>;
  onCancel?: () => void;
  tenantId: number;
  equipmentId?: number | null;
  selectedDate?: string | null;
  isLoading?: boolean;
  initiallyShowShiftFallback?: boolean;
  submitLabel?: string;
}

export function ScrapDataForm(props: ScrapDataFormProps) {
  const [form] = Form.useForm<ScrapFormShape>();
  const {
    initialValues, onSubmit, onCancel, tenantId, equipmentId, selectedDate,
    isLoading, initiallyShowShiftFallback, submitLabel = 'Save',
  } = props;

  const { data: parts } = usePartsForSelect(tenantId);
  const { data: scrapTypes } = useReasonTypes(tenantId, 'ScrapReason');
  const watchedScrapTypeId = Form.useWatch('scrapTypeId', form);
  const { data: scrapReasons, isLoading: reasonsLoading } = useReasonsForType(
    tenantId, 'scrap-reasons', watchedScrapTypeId ?? null,
  );

  const partOptions = (parts ?? []).map((p) => ({
    value: p.id, label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));
  const scrapTypeOptions = (scrapTypes ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));
  const reasonOptions = (scrapReasons ?? []).map((r) => ({ value: r.id, label: r.name ?? `#${r.id}` }));

  useEffect(() => {
    if (initialValues) {
      const v: ScrapFormShape = {
        ...initialValues,
        date: typeof initialValues.date === 'string' ? dayjs(initialValues.date) : (initialValues.date as Dayjs | null | undefined),
      };
      form.setFieldsValue(v);
    } else {
      form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  async function handleOk() {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      throw err;
    }
  }

  return (
    <Form<ScrapFormShape> form={form} layout="vertical">
      <Form.Item name="partId" label="Part">
        <Select options={partOptions} showSearch optionFilterProp="label" allowClear placeholder="Pick a part" />
      </Form.Item>
      <WorkShiftDualSource
        tenantId={tenantId}
        date={selectedDate ?? null}
        equipmentId={equipmentId ?? null}
        initiallyShowFallback={!!initiallyShowShiftFallback}
      />
      <Form.Item name="scrapTypeId" label="Scrap type" rules={[{ required: true, message: 'Scrap type is required' }]}>
        <Select
          options={scrapTypeOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Pick a scrap type"
          onChange={() => form.setFieldValue('reasonId', undefined)}
        />
      </Form.Item>
      <Form.Item name="reasonId" label="Scrap reason" rules={[{ required: true, message: 'Reason is required' }]}>
        <Select
          options={reasonOptions}
          loading={reasonsLoading}
          disabled={!watchedScrapTypeId || reasonsLoading}
          showSearch
          optionFilterProp="label"
          placeholder={
            watchedScrapTypeId
              ? (reasonOptions.length === 0 && !reasonsLoading ? 'No reasons configured for this type' : 'Pick a reason')
              : 'Pick a scrap type first'
          }
        />
      </Form.Item>
      <Form.Item name="orderNo" label="Order #"><Input maxLength={255} /></Form.Item>
      <Form.Item name="quantity" label="Quantity"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
      <Form.Item name="comment" label="Comment"><Input.TextArea rows={3} maxLength={255} /></Form.Item>
      <Form.Item name="date" label="Date"><DatePicker style={{ width: '100%' }} /></Form.Item>

      <div style={{ textAlign: 'right' }}>
        <Space>
          {onCancel && <Button onClick={onCancel} disabled={isLoading}>Cancel</Button>}
          <Button type="primary" onClick={handleOk} loading={isLoading}>{submitLabel}</Button>
        </Space>
      </div>
    </Form>
  );
}

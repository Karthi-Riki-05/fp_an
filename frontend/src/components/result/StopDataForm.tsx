'use client';

import { Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { usePartsForSelect, useReasonTypes, useReasonsForType } from './EditModalHooks';
import { WorkShiftDualSource } from './WorkShiftDualSource';

export interface StopFormShape {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  stopTypeId?: number;
  reasonId?: number;
  orderNo?: string;
  quantity?: number;
  timeHours?: number;
  timeMinutes?: number;
  comment?: string;
  date?: Dayjs | null;
}

export interface StopUpdateInput {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  stopTypeId?: number;
  reasonId?: number;
  orderNo?: string;
  quantity?: number;
  /** Total minutes; backend splits into hours/minutes/sum_of_time/time. */
  timeMinutes?: number;
  comment?: string;
  date?: string;
}

export function stopFormToInput(values: StopFormShape): StopUpdateInput {
  const hours = Number(values.timeHours ?? 0);
  const minutes = Number(values.timeMinutes ?? 0);
  const totalMinutes = hours * 60 + minutes;
  const input: StopUpdateInput = {
    partId: values.partId,
    stopTypeId: values.stopTypeId,
    reasonId: values.reasonId,
    orderNo: values.orderNo,
    quantity: values.quantity,
    timeMinutes: totalMinutes > 0 ? totalMinutes : undefined,
    comment: values.comment,
    date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
  };
  if (values.workShiftId !== undefined) input.workShiftId = values.workShiftId;
  else if (values.workShiftName) input.workShiftName = values.workShiftName;
  return input;
}

export interface StopDataFormProps {
  initialValues?: Partial<StopFormShape>;
  onSubmit: (values: StopFormShape) => Promise<void>;
  onCancel?: () => void;
  tenantId: number;
  equipmentId?: number | null;
  selectedDate?: string | null;
  isLoading?: boolean;
  initiallyShowShiftFallback?: boolean;
  submitLabel?: string;
}

export function StopDataForm(props: StopDataFormProps) {
  const [form] = Form.useForm<StopFormShape>();
  const {
    initialValues, onSubmit, onCancel, tenantId, equipmentId, selectedDate,
    isLoading, initiallyShowShiftFallback, submitLabel = 'Save',
  } = props;

  const { data: parts } = usePartsForSelect(tenantId);
  const { data: stopTypes } = useReasonTypes(tenantId, 'StopReason');
  const watchedStopTypeId = Form.useWatch('stopTypeId', form);
  const { data: stopReasons, isLoading: reasonsLoading } = useReasonsForType(
    tenantId, 'stop-reasons', watchedStopTypeId ?? null,
  );

  const partOptions = (parts ?? []).map((p) => ({
    value: p.id, label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));
  const stopTypeOptions = (stopTypes ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));
  const reasonOptions = (stopReasons ?? []).map((r) => ({ value: r.id, label: r.name ?? `#${r.id}` }));

  useEffect(() => {
    if (initialValues) {
      const v: StopFormShape = {
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
    <Form<StopFormShape> form={form} layout="vertical">
      <Form.Item name="partId" label="Part">
        <Select options={partOptions} showSearch optionFilterProp="label" allowClear placeholder="Pick a part" />
      </Form.Item>
      <WorkShiftDualSource
        tenantId={tenantId}
        date={selectedDate ?? null}
        equipmentId={equipmentId ?? null}
        initiallyShowFallback={!!initiallyShowShiftFallback}
      />
      <Form.Item name="stopTypeId" label="Stop type" rules={[{ required: true, message: 'Stop type is required' }]}>
        <Select
          options={stopTypeOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Pick a stop type"
          onChange={() => form.setFieldValue('reasonId', undefined)}
        />
      </Form.Item>
      <Form.Item name="reasonId" label="Stop reason" rules={[{ required: true, message: 'Reason is required' }]}>
        <Select
          options={reasonOptions}
          loading={reasonsLoading}
          disabled={!watchedStopTypeId || reasonsLoading}
          showSearch
          optionFilterProp="label"
          placeholder={
            watchedStopTypeId
              ? (reasonOptions.length === 0 && !reasonsLoading ? 'No reasons configured for this type' : 'Pick a reason')
              : 'Pick a stop type first'
          }
        />
      </Form.Item>
      <Form.Item name="orderNo" label="Order #"><Input maxLength={255} /></Form.Item>
      <Form.Item name="quantity" label="Quantity"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="timeHours" label="Hours">
            <InputNumber min={0} addonAfter="h" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="timeMinutes" label="Minutes">
            <InputNumber min={0} max={59} addonAfter="min" style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
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

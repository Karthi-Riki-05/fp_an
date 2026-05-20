'use client';

import { Button, DatePicker, Form, Input, InputNumber, Select, Space } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { usePartsForSelect } from './EditModalHooks';
import { WorkShiftDualSource } from './WorkShiftDualSource';

export interface ProductionFormShape {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  orderNo?: string;
  workHours?: number;
  partQty?: number;
  plannedQty?: number;
  comment?: string;
  date?: Dayjs | null;
}

/** API DTO shape — matches `UpdateProductionInput` in the API hook libs. */
export interface ProductionUpdateInput {
  partId?: number;
  workShiftId?: number;
  workShiftName?: string;
  orderNo?: string;
  workHours?: string;
  partQty?: number;
  plannedQty?: number;
  comment?: string;
  date?: string;
}

export function productionFormToInput(values: ProductionFormShape): ProductionUpdateInput {
  // The dual-source widget enforces XOR; we forward whichever the user picked.
  const input: ProductionUpdateInput = {
    partId: values.partId,
    orderNo: values.orderNo,
    workHours: values.workHours !== undefined ? String(values.workHours) : undefined,
    partQty: values.partQty,
    plannedQty: values.plannedQty,
    comment: values.comment,
    date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
  };
  if (values.workShiftId !== undefined) input.workShiftId = values.workShiftId;
  else if (values.workShiftName) input.workShiftName = values.workShiftName;
  return input;
}

export interface ProductionDataFormProps {
  initialValues?: Partial<ProductionFormShape>;
  onSubmit: (values: ProductionFormShape) => Promise<void>;
  onCancel?: () => void;
  tenantId: number;
  /** Equipment context for the WorkShiftDualSource cascade. */
  equipmentId?: number | null;
  /** Picked date — drives shift schedule lookup in WorkShiftDualSource. */
  selectedDate?: string | null;
  /** Persist-in-progress flag (disables actions, shows spinner). */
  isLoading?: boolean;
  /** Pre-open the fallback (string shift_name) input if the row has a string shift but no FK. */
  initiallyShowShiftFallback?: boolean;
  submitLabel?: string;
}

export function ProductionDataForm(props: ProductionDataFormProps) {
  const [form] = Form.useForm<ProductionFormShape>();
  const {
    initialValues, onSubmit, onCancel, tenantId, equipmentId, selectedDate,
    isLoading, initiallyShowShiftFallback, submitLabel = 'Save',
  } = props;

  const { data: parts } = usePartsForSelect(tenantId);
  const partOptions = (parts ?? []).map((p) => ({
    value: p.id, label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));

  useEffect(() => {
    if (initialValues) {
      // dayjs hydration if the caller passed a YMD string instead of a Dayjs
      const v: ProductionFormShape = {
        ...initialValues,
        date:
          typeof initialValues.date === 'string'
            ? dayjs(initialValues.date)
            : (initialValues.date as Dayjs | null | undefined),
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
      if (err && typeof err === 'object' && 'errorFields' in err) return; // AntD validation
      throw err;
    }
  }

  return (
    <Form<ProductionFormShape> form={form} layout="vertical">
      <Form.Item name="partId" label="Part">
        <Select
          options={partOptions}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder="Pick a part"
        />
      </Form.Item>
      <WorkShiftDualSource
        tenantId={tenantId}
        date={selectedDate ?? null}
        equipmentId={equipmentId ?? null}
        initiallyShowFallback={!!initiallyShowShiftFallback}
      />
      <Form.Item name="orderNo" label="Order #">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="workHours" label="Worked hours">
        <InputNumber min={0} step={0.5} addonAfter="h" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="partQty" label="OK quantity">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="plannedQty" label="Planned quantity">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="comment" label="Comment">
        <Input.TextArea rows={3} maxLength={255} />
      </Form.Item>
      <Form.Item name="date" label="Date">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <div style={{ textAlign: 'right' }}>
        <Space>
          {onCancel && <Button onClick={onCancel} disabled={isLoading}>Cancel</Button>}
          <Button type="primary" onClick={handleOk} loading={isLoading}>{submitLabel}</Button>
        </Space>
      </div>
    </Form>
  );
}

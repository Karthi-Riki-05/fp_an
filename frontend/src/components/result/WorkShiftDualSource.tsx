'use client';

import { Button, Form, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import {
  useShiftScheduleTitles,
  useWorkShiftsForSelect,
} from './EditModalHooks';

const { Text } = Typography;

/**
 * Encapsulates the legacy "work_shift_id OR work_shift_name" dual-source
 * pattern used by all three Result-edit modals (audit RESOLVED vi).
 *
 * Owns two form fields:
 *   workShiftId   — primary <Select> from /admin/work-shifts
 *   workShiftName — secondary <Select> from
 *                   /admin/shift-schedules/titles?date=&equipmentId=
 * Submitting one always clears the other so the backend's XOR rule is
 * respected. The secondary Select is hidden behind a "Or pick from
 * shift schedule…" toggle that auto-expands when the edited row only
 * has workShiftName populated.
 *
 * The parent Form owns the values; this component just orchestrates
 * which one is visible and wires the clear-on-pick behaviour.
 */
export interface WorkShiftDualSourceProps {
  tenantId: number | null | undefined;
  date: string | null | undefined;
  equipmentId: number | null | undefined;
  /** When non-null on mount, force the secondary Select to be visible. */
  initiallyShowFallback?: boolean;
}

export function WorkShiftDualSource({
  tenantId,
  date,
  equipmentId,
  initiallyShowFallback = false,
}: WorkShiftDualSourceProps) {
  const form = Form.useFormInstance();
  const [showFallback, setShowFallback] = useState<boolean>(initiallyShowFallback);

  // Re-sync when the modal opens with a different row.
  useEffect(() => {
    setShowFallback(initiallyShowFallback);
  }, [initiallyShowFallback]);

  const { data: workShifts, isLoading: wsLoading } = useWorkShiftsForSelect(tenantId);
  const { data: titles, isLoading: titlesLoading } = useShiftScheduleTitles(
    tenantId,
    date,
    equipmentId,
  );

  const wsOptions = (workShifts ?? []).map((s) => ({ value: s.id, label: s.name ?? `#${s.id}` }));
  const titleOptions = (titles ?? []).map((t) => ({ value: t.title, label: t.title }));

  return (
    <>
      <Form.Item
        name="workShiftId"
        label="Work shift"
        // Mutually exclusive with workShiftName — clear the other side on change.
      >
        <Select
          options={wsOptions}
          loading={wsLoading}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder="Pick a work shift"
          onChange={(v) => {
            if (v !== undefined) form.setFieldValue('workShiftName', undefined);
          }}
        />
      </Form.Item>
      {!showFallback ? (
        <Form.Item style={{ marginTop: -8 }}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setShowFallback(true)}>
            Or pick from shift schedule…
          </Button>
        </Form.Item>
      ) : (
        <Form.Item
          name="workShiftName"
          label={<Space size={4}>Shift schedule title <Text type="secondary" style={{ fontSize: 11 }}>(fallback)</Text></Space>}
          extra={
            !equipmentId || !date
              ? 'Need a row with equipment + date to load shift schedule titles.'
              : titles?.length === 0
                ? 'No shift schedule events configured for this equipment on this date.'
                : undefined
          }
        >
          <Select
            options={titleOptions}
            loading={titlesLoading}
            disabled={!equipmentId || !date || titlesLoading}
            showSearch
            optionFilterProp="label"
            allowClear
            placeholder="Pick a shift schedule title"
            onChange={(v) => {
              if (v !== undefined) form.setFieldValue('workShiftId', undefined);
            }}
          />
        </Form.Item>
      )}
    </>
  );
}

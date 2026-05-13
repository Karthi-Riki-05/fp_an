'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { workShiftsApi, type WorkShiftRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

/**
 * Working-day options (matches legacy storage: 1=Mon … 7=Sun, CSV in
 * `work_shifts.working_days`).
 */
const WORKING_DAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

function fmtTime(v: string | null) {
  if (!v) return '—';
  // Postgres returns "HH:MM:SS"; trim to HH:MM for display.
  return v.length >= 5 ? v.slice(0, 5) : v;
}

/** Day-number CSV → human label string used in the table column. */
function fmtDaysCsv(v: string | null | undefined): string {
  if (!v) return '—';
  const map: Record<string, string> = {
    '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun',
  };
  return v
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => map[s] ?? s)
    .join(', ');
}

/** Day-number CSV → array of strings for the Checkbox.Group value. */
function csvToArray(v: string | null | undefined): string[] {
  if (!v) return [];
  return v.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export default function WorkShiftsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<WorkShiftRow>
      cardTitle="Work shift"
      addButtonLabel="Add work shift"
      resourceLabel="Work shift"
      scope={scope}
      hooks={workShiftsApi}
      toFormValues={(row) => ({
        name: row.name,
        startTime: fmtTime(row.startTime) === '—' ? '' : fmtTime(row.startTime),
        endTime: fmtTime(row.endTime) === '—' ? '' : fmtTime(row.endTime),
        breakStartTime: fmtTime(row.breakStartTime) === '—' ? '' : fmtTime(row.breakStartTime),
        breakEndTime: fmtTime(row.breakEndTime) === '—' ? '' : fmtTime(row.breakEndTime),
        workingDays: csvToArray(row.workingDays),
      })}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'startTime', title: 'Start', dataIndex: 'startTime', width: 100, render: fmtTime },
        { id: 'endTime', title: 'End', dataIndex: 'endTime', width: 100, render: fmtTime },
        { id: 'breakStartTime', title: 'Break start', dataIndex: 'breakStartTime', width: 110, render: fmtTime },
        { id: 'breakEndTime', title: 'Break end', dataIndex: 'breakEndTime', width: 110, render: fmtTime },
        { id: 'workingDays', title: 'Days', dataIndex: 'workingDays', width: 200, render: fmtDaysCsv },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'startTime', label: 'Start time (HH:MM)', type: 'time' },
        { name: 'endTime', label: 'End time (HH:MM)', type: 'time' },
        // NOTE: backend `work_shifts` currently has single `break_start_time` /
        // `break_end_time` columns. Multi-break Form.List support requires a
        // schema change (legacy stored as `break_times` CSV pairs). Tracked in
        // DROPDOWN_AUDIT.md § Notes — deferred until the schema is extended.
        { name: 'breakStartTime', label: 'Break start (HH:MM)', type: 'time' },
        { name: 'breakEndTime', label: 'Break end (HH:MM)', type: 'time' },
        {
          name: 'workingDays',
          label: 'Working days',
          type: 'checkbox-group',
          options: WORKING_DAY_OPTIONS,
          csv: { separator: ',' },
        },
      ]}
    />
  );
}

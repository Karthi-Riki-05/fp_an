'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { workShiftsApi, type WorkShiftRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

function fmtTime(v: string | null) {
  if (!v) return '—';
  // Postgres returns "HH:MM:SS"; trim to HH:MM for display.
  return v.length >= 5 ? v.slice(0, 5) : v;
}

export default function WorkShiftsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<WorkShiftRow>
      cardTitle="Work Shifts"
      addButtonLabel="Add shift"
      resourceLabel="Work shift"
      scope={scope}
      hooks={workShiftsApi}
      toFormValues={(row) => ({
        name: row.name,
        startTime: fmtTime(row.startTime) === '—' ? '' : fmtTime(row.startTime),
        endTime: fmtTime(row.endTime) === '—' ? '' : fmtTime(row.endTime),
        breakStartTime: fmtTime(row.breakStartTime) === '—' ? '' : fmtTime(row.breakStartTime),
        breakEndTime: fmtTime(row.breakEndTime) === '—' ? '' : fmtTime(row.breakEndTime),
        workingDays: row.workingDays ?? '',
      })}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'startTime', title: 'Start', dataIndex: 'startTime', width: 100, render: fmtTime },
        { id: 'endTime', title: 'End', dataIndex: 'endTime', width: 100, render: fmtTime },
        { id: 'breakStartTime', title: 'Break start', dataIndex: 'breakStartTime', width: 110, render: fmtTime },
        { id: 'breakEndTime', title: 'Break end', dataIndex: 'breakEndTime', width: 110, render: fmtTime },
        { id: 'workingDays', title: 'Days', dataIndex: 'workingDays', width: 160 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'startTime', label: 'Start time (HH:MM)', type: 'time' },
        { name: 'endTime', label: 'End time (HH:MM)', type: 'time' },
        { name: 'breakStartTime', label: 'Break start (HH:MM)', type: 'time' },
        { name: 'breakEndTime', label: 'Break end (HH:MM)', type: 'time' },
        { name: 'workingDays', label: 'Working days (e.g. Mon,Tue,Wed)', type: 'text', maxLength: 50 },
      ]}
    />
  );
}

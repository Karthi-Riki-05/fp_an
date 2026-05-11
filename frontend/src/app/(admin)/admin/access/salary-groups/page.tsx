'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../../lib/api/auth';
import { salaryGroupsApi, type SalaryGroupRow } from '../../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function SalaryGroupsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) {
    return <Text type="secondary">Pick a tenant to manage salary groups.</Text>;
  }

  return (
    <SimpleCrudPage<SalaryGroupRow>
      cardTitle="Salary Group"
      addButtonLabel="Add salary group"
      resourceLabel="Salary group"
      scope={scope}
      hooks={salaryGroupsApi}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'hourlyRate', title: 'Hourly Rate', dataIndex: 'hourlyRate', width: 140 },
        { id: 'info', title: 'Info', dataIndex: 'info' },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'hourlyRate', label: 'Hourly Rate', type: 'number', required: true, min: 0 },
        { name: 'info', label: 'Info', type: 'textarea', maxLength: 512, rows: 3 },
      ]}
      defaultValues={{ hourlyRate: 0 }}
    />
  );
}

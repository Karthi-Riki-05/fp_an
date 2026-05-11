'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../../lib/api/auth';
import { scrapReasonsApi, type ScrapReasonRow } from '../../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function ScrapReasonsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<ScrapReasonRow>
      cardTitle="Scrap Reasons"
      addButtonLabel="Add scrap reason"
      resourceLabel="Scrap reason"
      scope={scope}
      hooks={scrapReasonsApi}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'typeId', title: 'Type ID', dataIndex: 'typeId', width: 100 },
        { id: 'description', title: 'Description', dataIndex: 'description' },
        { id: 'sortOrder', title: 'Sort', dataIndex: 'sortOrder', width: 80 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'typeId', label: 'Type ID', type: 'number', required: true, min: 0 },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 255 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
      ]}
      defaultValues={{ typeId: 0, sortOrder: 0 }}
    />
  );
}

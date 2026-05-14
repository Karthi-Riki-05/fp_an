'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../../lib/api/auth';
import { scrapReasonsApi, typesApi, type ScrapReasonRow } from '../../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function ScrapReasonsPage() {
  const { data: me } = useMe();
  const scope = me ? { tenantId: me.activeTenantId, isAdmin: me.isAdmin } : null;

  // Category options come from Type Management rows with entity=ScrapReason.
  // The ScrapReason.typeId column is a FK into the `type` table.
  const { data: types } = typesApi.useList(
    scope ?? { tenantId: null, isAdmin: false },
    { entity: 'ScrapReason', perPage: 200 },
  );

  if (!me) return null;
  if (!scope?.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const categoryOptions = (types?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));

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
        { id: 'typeName', title: 'Category', dataIndex: 'typeName' },
        { id: 'description', title: 'Description', dataIndex: 'description' },
        { id: 'sortOrder', title: 'Sort', dataIndex: 'sortOrder', width: 80 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'typeId', label: 'Category', type: 'select', required: true, options: categoryOptions },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 255 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
      ]}
      defaultValues={{ sortOrder: 0 }}
    />
  );
}

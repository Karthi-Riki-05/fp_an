'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../../lib/api/auth';
import { stopReasonsApi, typesApi, type StopReasonRow } from '../../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function StopReasonsPage() {
  const { data: me } = useMe();
  const scope = me ? { tenantId: me.activeTenantId, isAdmin: me.isAdmin } : null;

  // Category options come from Type Management rows with entity=StopReason.
  // The StopReason.typeId column is a FK into the `type` table — these are
  // the only valid values. (Previously this dropdown read from /admin/stop-
  // categories which is a separate table; saves were referencing wrong ids.)
  const { data: types } = typesApi.useList(
    scope ?? { tenantId: null, isAdmin: false },
    { entity: 'StopReason', perPage: 200 },
  );

  if (!me) return null;
  if (!scope?.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const categoryOptions = (types?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));

  return (
    <SimpleCrudPage<StopReasonRow>
      cardTitle="Stop Reasons"
      addButtonLabel="Add stop reason"
      resourceLabel="Stop reason"
      scope={scope}
      hooks={stopReasonsApi}
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

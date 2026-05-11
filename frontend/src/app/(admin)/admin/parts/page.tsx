'use client';

import { Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { partsApi, type PartRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function PartsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<PartRow>
      cardTitle="Active Parts"
      addButtonLabel="Add part"
      resourceLabel="Part"
      scope={scope}
      hooks={partsApi}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'partNo', title: 'Part No', dataIndex: 'partNo', width: 140 },
        { id: 'typeId', title: 'Type ID', dataIndex: 'typeId', width: 90 },
        { id: 'purchasePrice', title: 'Purchase', dataIndex: 'purchasePrice', width: 110 },
        { id: 'salesPrice', title: 'Sales', dataIndex: 'salesPrice', width: 110 },
        { id: 'description', title: 'Description', dataIndex: 'description' },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'partNo', label: 'Part number', type: 'text', maxLength: 255 },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
        { name: 'typeId', label: 'Type ID', type: 'number', min: 0 },
        { name: 'purchasePrice', label: 'Purchase price', type: 'number', min: 0 },
        { name: 'salesPrice', label: 'Sales price', type: 'number', min: 0 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
      ]}
      defaultValues={{ typeId: 0, purchasePrice: 0, salesPrice: 0, sortOrder: 0 }}
    />
  );
}

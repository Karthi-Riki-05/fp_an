'use client';

import { Tag, Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { typesApi, type AdminTypeRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

const KIND_OPTIONS = [
  { value: 'NotApplicable', label: 'Not applicable' },
  { value: 'Performance', label: 'Performance' },
  { value: 'Availability', label: 'Availability' },
  { value: 'Quality', label: 'Quality' },
  { value: 'Other', label: 'Other' },
];

const ENTITY_OPTIONS = [
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Content', label: 'Content' },
  { value: 'StopReason', label: 'Stop reason' },
  { value: 'ScrapReason', label: 'Scrap reason' },
  { value: 'Part', label: 'Part' },
  { value: 'Order', label: 'Order' },
];

export default function TypesPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<AdminTypeRow>
      cardTitle="Active Types"
      addButtonLabel="Add Type"
      resourceLabel="Type"
      scope={scope}
      hooks={typesApi}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'kind', title: 'Type', dataIndex: 'kind', width: 140, render: (v: string) => <Tag>{v}</Tag> },
        { id: 'entity', title: 'Entity', dataIndex: 'entity', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
        { id: 'description', title: 'Description', dataIndex: 'description' },
        { id: 'sortOrder', title: 'Sort', dataIndex: 'sortOrder', width: 80 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'kind', label: 'Type', type: 'select', required: true, options: KIND_OPTIONS },
        { name: 'entity', label: 'Entity', type: 'select', required: true, options: ENTITY_OPTIONS },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
        { name: 'icon', label: 'Icon filename', type: 'text', maxLength: 255 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
        { name: 'isActive', label: 'Active', type: 'switch' },
      ]}
      defaultValues={{ kind: 'NotApplicable', entity: 'Equipment', sortOrder: 0, isActive: true }}
    />
  );
}

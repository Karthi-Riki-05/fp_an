'use client';

import { Tag, Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { typesApi, type AdminTypeRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

/**
 * Loss-model categories per DROPDOWN_AUDIT RESOLVED iii:
 *   StopReason  → all four are valid (NotApplicable / Performance / Availability / Quality)
 *   ScrapReason → only Quality and NotApplicable apply
 *   any other entity → the field is hidden entirely.
 * `Other` (previously in new_fp) is not a legacy value and has been dropped.
 */
const KIND_OPTIONS_STOP = [
  { value: 'NotApplicable', label: 'Not applicable' },
  { value: 'Performance',  label: 'Performance' },
  { value: 'Availability', label: 'Availability' },
  { value: 'Quality',      label: 'Quality' },
];

const KIND_OPTIONS_SCRAP = [
  { value: 'NotApplicable', label: 'Not applicable' },
  { value: 'Quality',       label: 'Quality' },
];

const ENTITY_OPTIONS = [
  { value: 'Equipment',   label: 'Equipment' },
  { value: 'StopReason',  label: 'Stop reason' },
  { value: 'ScrapReason', label: 'Scrap reason' },
  { value: 'Part',        label: 'Part' },
  { value: 'Order',       label: 'Order' },
  { value: 'Content',     label: 'Content' },
];

const ENTITIES_WITH_KIND = new Set(['StopReason', 'ScrapReason']);

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
      toFormValues={(row) => ({
        name: row.name,
        entity: row.entity,
        // `kind` is hidden for entities outside StopReason/ScrapReason. Clear
        // it on load so a stale value can't leak into a hidden field.
        kind: ENTITIES_WITH_KIND.has(row.entity) ? row.kind : undefined,
        description: row.description,
        icon: row.icon,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        excludeType: row.excludeType ?? false,
      })}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        { id: 'kind', title: 'Loss category', dataIndex: 'kind', width: 140, render: (v: string, row: AdminTypeRow) => (
          ENTITIES_WITH_KIND.has(row.entity) ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>
        ) },
        { id: 'entity', title: 'Entity', dataIndex: 'entity', width: 130, render: (v: string) => <Tag color="blue">{v}</Tag> },
        { id: 'description', title: 'Description', dataIndex: 'description' },
        { id: 'sortOrder', title: 'Sort', dataIndex: 'sortOrder', width: 80 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'entity', label: 'Entity', type: 'select', required: true, options: ENTITY_OPTIONS },
        {
          name: 'kind',
          label: 'Loss category',
          type: 'select',
          required: true,
          options: KIND_OPTIONS_STOP,
          visibleWhen: (v) => ENTITIES_WITH_KIND.has(String(v.entity ?? '')),
          optionsWhen: (v) => v.entity === 'ScrapReason' ? KIND_OPTIONS_SCRAP : KIND_OPTIONS_STOP,
        },
        {
          name: 'excludeType',
          label: 'Exclude from OEE',
          type: 'switch',
          visibleWhen: (v) => v.entity === 'StopReason',
        },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
        { name: 'icon', label: 'Icon filename', type: 'text', maxLength: 255 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
        { name: 'isActive', label: 'Active', type: 'switch' },
      ]}
      defaultValues={{
        entity: 'Equipment',
        // kind stays unset for the default Equipment entity; user picks it
        // after switching to Stop/Scrap reason.
        sortOrder: 0,
        isActive: true,
        excludeType: false,
      }}
    />
  );
}

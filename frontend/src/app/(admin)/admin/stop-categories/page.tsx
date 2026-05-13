'use client';

import { Tag, Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { stopCategoriesApi, type StopCategoryRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

/**
 * Stop category kinds — sourced from the legacy `stop_category.blade.php`
 * which exposed exactly these four values. The `stop_category` table is
 * distinct from `types` (audit RESOLVED i), so the kind enum stays as
 * its own `StopCategoryKind` rather than being collapsed into the
 * Type.kind enum (which drops `Other` per RESOLVED iii).
 */
const KIND_OPTIONS = [
  { value: 'Performance',  label: 'Performance' },
  { value: 'Availability', label: 'Availability' },
  { value: 'Quality',      label: 'Quality' },
  { value: 'Other',        label: 'Other' },
];

export default function StopCategoriesPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<StopCategoryRow>
      cardTitle="Stop categories"
      addButtonLabel="Add stop category"
      resourceLabel="Stop category"
      scope={scope}
      hooks={stopCategoriesApi}
      toFormValues={(row) => ({
        name: row.name ?? '',
        kind: row.kind,
        description: row.description ?? '',
        icon: row.icon ?? '',
        isActive: row.isActive,
      })}
      columns={[
        { id: 'id',          title: 'S.No',        dataIndex: 'id',          width: 80 },
        { id: 'name',        title: 'Name',        dataIndex: 'name',        filterable: true },
        { id: 'kind',        title: 'Kind',        dataIndex: 'kind',        width: 140, render: (v: string) => <Tag>{v}</Tag> },
        { id: 'description', title: 'Description', dataIndex: 'description', ellipsis: true },
        { id: 'isActive',    title: 'Active',      dataIndex: 'isActive',    width: 90, render: (v: boolean) => v ? <Tag color="success">Yes</Tag> : <Tag>No</Tag> },
      ]}
      fields={[
        { name: 'name',        label: 'Name',                          type: 'text',     required: true, maxLength: 255 },
        { name: 'kind',        label: 'Kind',                          type: 'select',   required: true, options: KIND_OPTIONS },
        { name: 'description', label: 'Description',                   type: 'textarea', maxLength: 512 },
        { name: 'icon',        label: 'Icon filename (optional)',      type: 'text',     maxLength: 255 },
        { name: 'isActive',    label: 'Active',                        type: 'switch' },
      ]}
      defaultValues={{ kind: 'Performance', isActive: true }}
    />
  );
}

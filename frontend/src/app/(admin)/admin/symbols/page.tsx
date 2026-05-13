'use client';

import { Tag, Typography } from 'antd';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { symbolsApi, type SymbolRow } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function SymbolsPage() {
  const { data: me } = useMe();
  if (!me) return null;
  const scope = { tenantId: me.activeTenantId, isAdmin: me.isAdmin };
  if (!scope.tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  return (
    <SimpleCrudPage<SymbolRow>
      cardTitle="Symbols"
      addButtonLabel="Add symbol"
      resourceLabel="Symbol"
      scope={scope}
      hooks={symbolsApi}
      toFormValues={(row) => ({
        name: row.name,
        image: row.image ?? '',
        status: row.status,
        sortOrder: row.sortOrder,
      })}
      columns={[
        { id: 'id', title: 'S.No', dataIndex: 'id', width: 80 },
        { id: 'name', title: 'Name', dataIndex: 'name', filterable: true },
        {
          id: 'image',
          title: 'Image',
          dataIndex: 'image',
          width: 200,
          render: (v: string | null) => v ? <code style={{ fontSize: 11 }}>{v}</code> : <Text type="secondary">—</Text>,
        },
        {
          id: 'status',
          title: 'Status',
          dataIndex: 'status',
          width: 100,
          render: (v: number) => v === 1 ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
        },
        { id: 'sortOrder', title: 'Sort', dataIndex: 'sortOrder', width: 80 },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        // NOTE: Legacy symbol form also had a `type` Select (13 values:
        // Company/Department/Machining/.../Drawings/Programs) and a
        // `description` textarea. New_fp `Symbol` model has neither column —
        // schema migration required to round-trip them. Tracked in
        // DROPDOWN_AUDIT.md.
        { name: 'image', label: 'Image filename', type: 'text', maxLength: 255 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
      ]}
      defaultValues={{ status: 1, sortOrder: 0 }}
    />
  );
}

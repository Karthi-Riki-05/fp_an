'use client';

import { Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { SimpleCrudPage } from '../../../../components/data-table/SimpleCrudPage';
import { useMe } from '../../../../lib/api/auth';
import { partsApi, type PartRow, typesApi } from '../../../../lib/api/admin-crud';

const { Text } = Typography;

export default function PartsPage() {
  const { data: me } = useMe();

  // `useMe` returns `data: undefined` on first render; we still call the
  // types hook here so the hook order stays stable across renders. The
  // hook itself is disabled until tenantId is known.
  const tenantId = me?.activeTenantId ?? null;
  const isAdmin = me?.isAdmin ?? false;
  const scope = { tenantId, isAdmin };

  // Fetch Part-typed types for the typeId select. Backend admin-types
  // supports both filters as of Phase A3.
  const { data: partTypes } = typesApi.useList(scope, {
    entity: 'Part',
    perPage: 200,
    sort: 'sortOrder',
    order: 'asc',
  });

  const typeOptions = useMemo(
    () => (partTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `Type #${t.id}` })),
    [partTypes],
  );

  // Look-up table for rendering the column.
  const typeNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of partTypes?.data ?? []) m.set(t.id, t.name ?? `Type #${t.id}`);
    return m;
  }, [partTypes]);

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant.</Text>;

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
        {
          id: 'typeId',
          title: 'Type',
          dataIndex: 'typeId',
          width: 160,
          render: (v: number) => (v ? <Tag color="blue">{typeNameById.get(v) ?? `#${v}`}</Tag> : <Text type="secondary">—</Text>),
        },
        { id: 'purchasePrice', title: 'Purchase', dataIndex: 'purchasePrice', width: 110 },
        { id: 'salesPrice', title: 'Sales', dataIndex: 'salesPrice', width: 110 },
        { id: 'description', title: 'Description', dataIndex: 'description' },
      ]}
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true, maxLength: 255 },
        { name: 'partNo', label: 'Part number', type: 'text', maxLength: 255 },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
        // typeId is a tenant-scoped Select against /admin/types?entity=Part.
        // Options are loaded at the page level so the SimpleCrudPage select
        // field renders synchronously and edit-mode initialValues match an
        // option (avoids the legacy "shows raw ID" bug).
        { name: 'typeId', label: 'Part type', type: 'select', required: true, options: typeOptions },
        { name: 'purchasePrice', label: 'Purchase price', type: 'number', min: 0 },
        { name: 'salesPrice', label: 'Sales price', type: 'number', min: 0 },
        { name: 'sortOrder', label: 'Sort order', type: 'number', min: 0 },
      ]}
      defaultValues={{ purchasePrice: 0, salesPrice: 0, sortOrder: 0 }}
    />
  );
}

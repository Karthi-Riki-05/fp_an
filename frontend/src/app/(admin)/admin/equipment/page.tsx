'use client';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import {
  useDeleteEquipment,
  useEquipmentDetail,
  useEquipmentList,
  type Equipment,
} from '../../../../lib/api/equipment';
import { typesApi } from '../../../../lib/api/admin-crud';
import EquipmentDetailsView from '../../../../components/equipment/EquipmentDetailsView';
import EquipmentFullEditModal from '../../../../components/equipment/EquipmentFullEditModal';

const { Title } = Typography;

export default function EquipmentListPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = useMemo(
    () => ({ tenantId, isAdmin: me?.isAdmin ?? false }),
    [tenantId, me?.isAdmin],
  );

  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addUnderParent, setAddUnderParent] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);

  const editModalOpen = createOpen || editId !== null || addUnderParent !== null;
  const closeEdit = () => { setCreateOpen(false); setEditId(null); setAddUnderParent(null); };

  // Honor ?openEdit=<id> and ?openAdd=<parentId> deep links from the tree page.
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const e = searchParams.get('openEdit');
    const a = searchParams.get('openAdd');
    if (e) setEditId(Number(e));
    else if (a !== null) setAddUnderParent(Number(a));
    if (e || a !== null) {
      router.replace('/admin/equipment');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: equipmentRows, isLoading: rowsLoading } = useEquipmentList(tenantId);
  const { data: viewDetail, isLoading: viewLoading } = useEquipmentDetail(tenantId, viewId);
  const { data: equipmentTypes } = typesApi.useList(scope, { entity: 'Equipment', perPage: 200, sort: 'sortOrder', order: 'asc' });

  const deleteMut = useDeleteEquipment(tenantId);

  // ── Table data ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = equipmentRows ?? [];
    if (!f) return list;
    return list.filter((r) => (r.name ?? '').toLowerCase().includes(f) || (r.description ?? '').toLowerCase().includes(f));
  }, [equipmentRows, filter]);

  const typeNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of equipmentTypes?.data ?? []) m.set(t.id, t.name ?? `#${t.id}`);
    return m;
  }, [equipmentTypes]);

  const parentNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of equipmentRows ?? []) m.set(r.id, r.name ?? `#${r.id}`);
    return m;
  }, [equipmentRows]);

  const columns: ColumnsType<Equipment> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Parent', dataIndex: 'parentId', key: 'parentId',
      render: (v: number) => (v ? parentNameById.get(v) ?? `#${v}` : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: 'Type', dataIndex: 'typeId', key: 'typeId',
      render: (v: number) => (v ? <Tag>{typeNameById.get(v) ?? `#${v}`}</Tag> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Sort', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'right' },
    {
      title: 'Status', dataIndex: 'isActive', key: 'isActive', width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'active' : 'inactive'}</Tag>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 130, align: 'center',
      render: (_, row) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#01b9d0' }} />} onClick={() => setViewId(row.id)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => setEditId(row.id)} />
          </Tooltip>
          <Popconfirm
            title={`Delete ${row.name}?`}
            description="Soft-delete — production data is preserved."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try { await deleteMut.mutateAsync(row.id); message.success('Equipment deleted.'); }
              catch (err) { message.error(toApiError(err).message); }
            }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </span>
      ),
    },
  ];

  if (!me) return null;
  if (!tenantId) return <Typography.Text type="secondary">Pick a tenant.</Typography.Text>;

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Equipment' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Equipment</Title>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add equipment
          </Button>
        </Space>
      </div>

      <Card
        styles={{ body: { padding: 0 } }}
        title={
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="Filter by name or description…"
            allowClear
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        }
      >
        <Table<Equipment>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          size="middle"
          loading={rowsLoading}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'], showTotal: (t) => `${t} items` }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <EquipmentFullEditModal
        open={editModalOpen}
        editingId={editId}
        addUnderParentId={addUnderParent}
        scope={scope}
        onClose={closeEdit}
      />

      <Modal
        open={viewId !== null}
        title={viewDetail ? `Equipment details — ${viewDetail.name}` : 'Equipment details'}
        onCancel={() => setViewId(null)}
        footer={[
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => { const id = viewId; setViewId(null); if (id !== null) setEditId(id); }}
          >
            Edit
          </Button>,
          <Button key="close" onClick={() => setViewId(null)}>Close</Button>,
        ]}
        destroyOnClose
        width={680}
      >
        {viewLoading || !viewDetail ? <Skeleton active /> : <EquipmentDetailsView detail={viewDetail} scope={scope} />}
      </Modal>
    </div>
  );
}

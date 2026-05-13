'use client';

import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  TreeSelect,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import { typesApi } from '../../../../lib/api/admin-crud';
import { useEquipmentTree, type EquipmentTreeNode } from '../../../../lib/api/equipment';
import {
  useCreateFolder,
  useDeleteFolder,
  useFolderList,
  useUpdateFolder,
  type FolderInput,
  type FolderRow,
} from '../../../../lib/api/admin-folders';

const { Title, Text } = Typography;

interface FormShape {
  name: string;
  equipmentId?: number;
  folderType?: number;
}

function treeToTreeSelect(nodes: EquipmentTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    value: n.id,
    title: n.name,
    children: n.children?.length ? treeToTreeSelect(n.children) : undefined,
  }));
}

export default function FoldersPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = useMemo(
    () => ({ tenantId, isAdmin: me?.isAdmin ?? false }),
    [tenantId, me?.isAdmin],
  );

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormShape>();

  const listParams = useMemo(
    () => ({ page, perPage, search: search || undefined, order: 'desc' as const }),
    [page, perPage, search],
  );
  const { data, isFetching } = useFolderList(tenantId, listParams);
  const { data: tree } = useEquipmentTree(tenantId);

  // folder_type → types where entity='Content' (per RESOLVED ii)
  const { data: contentTypes } = typesApi.useList(scope, { entity: 'Content', perPage: 200 });

  const folderTypeOptions = (contentTypes?.data ?? []).map((t) => ({ value: t.id, label: t.name ?? `#${t.id}` }));
  const treeData = tree ? treeToTreeSelect(tree) : [];

  const createMut = useCreateFolder(tenantId);
  const updateMut = useUpdateFolder(tenantId);
  const deleteMut = useDeleteFolder(tenantId);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        equipmentId: editing.equipmentId || undefined,
        folderType: editing.folderType || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: FolderInput = {
        name: values.name,
        equipmentId: Number(values.equipmentId ?? 0),
        folderType: Number(values.folderType ?? 0),
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        message.success('Folder updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Folder created.');
      }
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id);
      message.success('Folder deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const columns: ColumnsType<FolderRow> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Equipment',
      dataIndex: 'equipmentName',
      key: 'equipmentName',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Folder type',
      dataIndex: 'folderTypeName',
      key: 'folderTypeName',
      width: 160,
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, row: FolderRow) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => { setEditing(row); setModalOpen(true); }} />
          </Tooltip>
          <Popconfirm
            title={`Delete folder "${row.name}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(row.id)}
          >
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Folders' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Folders</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          Add folder
        </Button>
      </div>

      <Card
        bodyStyle={{ padding: 0 }}
        title={
          <Input
            size="small"
            prefix={<SearchOutlined />}
            placeholder="Filter by name…"
            allowClear
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 360 }}
          />
        }
      >
        <Table<FolderRow>
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.data ?? []}
          size="middle"
          pagination={{
            current: page,
            pageSize: perPage,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (t) => `${t} folders`,
            onChange: (p, ps) => { setPage(p); setPerPage(ps); },
          }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit folder "${editing.name}"` : 'Add folder'}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        width={520}
        maskClosable={false}
      >
        <Form<FormShape> form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input maxLength={255} autoFocus />
          </Form.Item>
          <Form.Item name="folderType" label="Folder type" rules={[{ required: true, message: 'Folder type is required' }]}>
            <Select
              options={folderTypeOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select folder type"
            />
          </Form.Item>
          <Form.Item name="equipmentId" label="Equipment" rules={[{ required: true, message: 'Equipment is required' }]}>
            <TreeSelect
              treeData={treeData}
              showSearch
              treeNodeFilterProp="title"
              placeholder="Select equipment in the tree"
              treeDefaultExpandAll={false}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

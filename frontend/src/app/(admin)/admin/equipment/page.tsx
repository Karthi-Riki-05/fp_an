'use client';

import {
  AppstoreOutlined,
  ClusterOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  ImportOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tree,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------------- *
 * Mock data — Phase 4a is design-only. Phase 4b binds these to the existing
 * /api/v1/equipment endpoint using the useEquipmentList hook.
 * ------------------------------------------------------------------------- */

interface EquipmentRow {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  typeName: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

const MOCK_TREE: DataNode[] = [
  {
    title: 'Production',
    key: 'p',
    icon: <ClusterOutlined />,
    children: [
      {
        title: 'Machining Line 1',
        key: 'p-l1',
        children: [
          { title: 'CNC-01', key: 'p-l1-cnc01', icon: <AppstoreOutlined /> },
          { title: 'CNC-02', key: 'p-l1-cnc02', icon: <AppstoreOutlined /> },
        ],
      },
      {
        title: 'Assembly Line 1',
        key: 'p-a1',
        children: [
          { title: 'Robot-A', key: 'p-a1-robot-a', icon: <AppstoreOutlined /> },
          { title: 'Press-1', key: 'p-a1-press-1', icon: <AppstoreOutlined /> },
        ],
      },
    ],
  },
  {
    title: 'Logistics',
    key: 'l',
    icon: <ClusterOutlined />,
    children: [
      { title: 'Forklift-1', key: 'l-fl1', icon: <AppstoreOutlined /> },
    ],
  },
];

const MOCK_ROWS: EquipmentRow[] = [
  { id: 1, name: 'CNC-01',    parentId: 11, parentName: 'Machining Line 1', typeName: 'Drilling Machine', description: 'Main drilling station', sortOrder: 10, isActive: true },
  { id: 2, name: 'CNC-02',    parentId: 11, parentName: 'Machining Line 1', typeName: 'Drilling Machine', description: 'Backup drilling station', sortOrder: 20, isActive: true },
  { id: 3, name: 'Robot-A',   parentId: 12, parentName: 'Assembly Line 1',  typeName: 'Robot',           description: 'Pick & place', sortOrder: 10, isActive: true },
  { id: 4, name: 'Press-1',   parentId: 12, parentName: 'Assembly Line 1',  typeName: 'Press',           description: 'Stamping press 50T', sortOrder: 20, isActive: false },
  { id: 5, name: 'Forklift-1',parentId: 20, parentName: 'Logistics',        typeName: 'Forklift',        description: 'In-house transport', sortOrder: 10, isActive: true },
];

/* ------------------------------------------------------------------------- */

export default function EquipmentListPage() {
  const { message, modal } = App.useApp();
  const [tree, setTree] = useState<DataNode[]>(MOCK_TREE);
  const [filter, setFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<EquipmentRow>();

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return MOCK_ROWS;
    return MOCK_ROWS.filter((r) =>
      [r.name, r.typeName, r.parentName ?? '', r.description].some((s) =>
        s.toLowerCase().includes(f),
      ),
    );
  }, [filter]);

  const columns: ColumnsType<EquipmentRow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Parent', dataIndex: 'parentName', key: 'parentName' },
    { title: 'Type', dataIndex: 'typeName', key: 'typeName', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Sort', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'right' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active: boolean) => (
        <Tag
          color={active ? 'success' : 'default'}
          icon={active ? undefined : undefined}
          aria-label={active ? 'Active' : 'Inactive'}
        >
          {active ? 'active' : 'inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (val, row) => row.isActive === val,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center',
      render: (_, row) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view',   icon: <EyeOutlined />,   label: 'View' },
              { key: 'edit',   icon: <EditOutlined />, label: 'Edit' },
              { type: 'divider' },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: () =>
                  modal.confirm({
                    title: `Delete ${row.name}?`,
                    content: 'This will soft-delete the equipment. Production data referencing it is preserved.',
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: () => message.success(`(mock) deleted ${row.name}`),
                  }),
              },
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={`Actions for ${row.name}`} />
        </Dropdown>
      ),
    },
  ];

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      message.success(`(mock) created ${values.name}`);
      setCreateOpen(false);
      form.resetFields();
    } catch {
      // validation errors render inline
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { title: <Link href="/admin">Admin</Link> },
          { title: 'Equipment' },
        ]}
        style={{ marginBottom: 12 }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Equipment
          </Title>
          <Text type="secondary">Tree of equipment + filterable list view</Text>
        </div>
        <Space wrap>
          <Button icon={<ImportOutlined />}>Import</Button>
          <Button icon={<ExportOutlined />}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Add equipment
          </Button>
        </Space>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: 16,
          alignItems: 'start',
        }}
        className="fp-equipment-grid"
      >
        <Card
          size="small"
          title="Equipment tree"
          bodyStyle={{ padding: 8, maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}
        >
          <Tree
            showIcon
            treeData={tree}
            defaultExpandAll
            blockNode
            draggable
            onDrop={() => message.info('(mock) drag-to-reorder will save in Phase 4b')}
          />
        </Card>

        <Card
          bodyStyle={{ padding: 0 }}
          title={
            <Input
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Filter by name, type, parent…"
              allowClear
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          }
        >
          <Table<EquipmentRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            size="middle"
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '25', '50'],
              showTotal: (total) => `${total} items`,
            }}
            scroll={{ x: 'max-content' }}
            sticky
          />
        </Card>
      </div>

      <Modal
        title="Add equipment"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        okText="Create"
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ isActive: true, sortOrder: 0 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required.' }]}
          >
            <Input placeholder="e.g. CNC-03" autoFocus />
          </Form.Item>
          <Form.Item name="parentName" label="Parent equipment">
            <Input placeholder="(optional)" />
          </Form.Item>
          <Form.Item name="typeName" label="Type">
            <Input placeholder="e.g. Drilling Machine" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
          <Space size="middle" wrap>
            <Form.Item name="sortOrder" label="Sort order">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <style jsx>{`
        @media (max-width: 991px) {
          :global(.fp-equipment-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

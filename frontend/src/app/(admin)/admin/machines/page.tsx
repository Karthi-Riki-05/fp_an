'use client';

import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  UnlockOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient, toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import { EquipmentTreeSelect } from '../../../../components/equipment/EquipmentTreeSelect';
import {
  useCreateMachine,
  useDeleteMachine,
  useDeleteMachineFile,
  useMachineFileList,
  useMachineList,
  useToggleMachineLock,
  useUpdateMachine,
  useUpdateMachineFile,
  useUploadMachineFile,
  type MachineRow,
} from '../../../../lib/api/admin-machines';

const { Title, Text } = Typography;

interface FormShape {
  name: string;
  equipmentId?: number;
  folderId?: number;
  isLocked?: boolean;
}

interface FolderRow { id: number; name: string }

export default function MachinesPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const headers = me?.isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MachineRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormShape>();

  const listParams = useMemo(
    () => ({ page, perPage, search: search || undefined }),
    [page, perPage, search],
  );
  const { data, isFetching } = useMachineList(tenantId, listParams);

  // Watch the equipment Select so the folder Select can cascade.
  const watchedEquipmentId = Form.useWatch('equipmentId', form);

  // Folder list cascades on equipmentId. Re-uses the C7 endpoint.
  const { data: folderResp } = useQuery({
    queryKey: ['folders-by-equipment', tenantId, watchedEquipmentId],
    queryFn: async () =>
      (await apiClient.get<{ data: FolderRow[]; total: number }>('/admin/folders', {
        params: { equipmentId: watchedEquipmentId, perPage: 200 },
        headers,
      })).data,
    enabled: !!tenantId && !!watchedEquipmentId,
    staleTime: 10_000,
  });
  const folderOptions = (folderResp?.data ?? []).map((f) => ({ value: f.id, label: f.name }));

  const createMut = useCreateMachine(tenantId);
  const updateMut = useUpdateMachine(tenantId);
  const deleteMut = useDeleteMachine(tenantId);
  const toggleMut = useToggleMachineLock(tenantId);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.machineName ?? '',
        equipmentId: editing.equipmentId || undefined,
        folderId: editing.folderId || undefined,
        isLocked: editing.isLocked,
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

  // Clear folder when equipment changes — folder list cascades off equipmentId.
  const onEquipmentChange = (val: number | undefined) => {
    form.setFieldsValue({ equipmentId: val, folderId: undefined });
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        name: values.name,
        equipmentId: Number(values.equipmentId ?? 0),
        folderId: Number(values.folderId ?? 0),
        isLocked: values.isLocked ?? false,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        message.success('Machine updated.');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Machine created.');
      }
      closeModal();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(toApiError(err).message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant.</Text>;

  const columns: ColumnsType<MachineRow> = [
    { title: 'S.No', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Machine name', dataIndex: 'machineName', key: 'machineName' },
    {
      title: 'Equipment',
      dataIndex: 'equipmentName',
      key: 'equipmentName',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Folder',
      dataIndex: 'folderName',
      key: 'folderName',
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Locked',
      dataIndex: 'isLocked',
      key: 'isLocked',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="warning" icon={<LockOutlined />}>Locked</Tag> : <Tag icon={<UnlockOutlined />}>Open</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string | null) => v ? new Date(v).toLocaleString() : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, row: MachineRow) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} onClick={() => { setEditing(row); setModalOpen(true); }} />
          </Tooltip>
          <Tooltip title={row.isLocked ? 'Unlock' : 'Lock'}>
            <Button
              type="text"
              size="small"
              icon={row.isLocked ? <UnlockOutlined /> : <LockOutlined />}
              onClick={async () => {
                try { await toggleMut.mutateAsync(row.id); message.success(row.isLocked ? 'Unlocked.' : 'Locked.'); }
                catch (err) { message.error(toApiError(err).message); }
              }}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete machine "${row.machineName}"?`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try { await deleteMut.mutateAsync(row.id); message.success('Machine deleted.'); }
              catch (err) { message.error(toApiError(err).message); }
            }}
          >
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ title: <Link href="/admin">Admin</Link> }, { title: 'Machines' }]} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Machines (file manager)</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          Add machine
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
        <Table<MachineRow>
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.data ?? []}
          size="middle"
          expandable={{
            expandedRowRender: (row) => <MachineFileSection tenantId={tenantId} machine={row} />,
          }}
          pagination={{
            current: page,
            pageSize: perPage,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50'],
            showTotal: (t) => `${t} machines`,
            onChange: (p, ps) => { setPage(p); setPerPage(ps); },
          }}
          scroll={{ x: 'max-content' }}
          sticky
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit machine "${editing.machineName}"` : 'Add machine'}
        onCancel={closeModal}
        onOk={onSubmit}
        okText={editing ? 'Save changes' : 'Create'}
        confirmLoading={submitting}
        destroyOnClose
        width={560}
        maskClosable={false}
      >
        <Form<FormShape> form={form} layout="vertical" preserve={false}>
          <Form.Item name="equipmentId" label="Equipment" rules={[{ required: true, message: 'Equipment is required' }]}>
            <EquipmentTreeSelect tenantId={tenantId} placeholder="Pick an equipment" onChange={onEquipmentChange} />
          </Form.Item>
          <Form.Item name="folderId" label="Folder" rules={[{ required: true, message: 'Folder is required' }]}>
            <Select
              options={folderOptions}
              showSearch
              optionFilterProp="label"
              placeholder={watchedEquipmentId ? (folderOptions.length === 0 ? 'No folders configured for this equipment' : 'Pick a folder') : 'Pick an equipment first'}
              disabled={!watchedEquipmentId}
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input maxLength={255} autoFocus />
          </Form.Item>
          <Form.Item name="isLocked" valuePropName="checked">
            <Checkbox>Lock this machine</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Files sub-section (expandable row) ─────────────────────────────────────

interface MachineFileSectionProps {
  tenantId: number;
  machine: MachineRow;
}

function MachineFileSection({ tenantId, machine }: MachineFileSectionProps) {
  const { message } = App.useApp();
  const { data: files, isLoading } = useMachineFileList(tenantId, machine.id);
  const uploadMut = useUploadMachineFile(tenantId);
  const updateFileMut = useUpdateMachineFile(tenantId);
  const deleteFileMut = useDeleteMachineFile(tenantId);

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        await uploadMut.mutateAsync({ machineId: machine.id, file, isLocked: false });
        message.success(`Uploaded ${file.name}`);
      } catch (err) {
        message.error(toApiError(err).message);
      }
      // Returning false prevents AntD's default XHR upload — our hook does it via axios.
      return false;
    },
  };

  return (
    <div style={{ padding: '8px 0 8px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Text strong>Files</Text>
        <Upload {...uploadProps}>
          <Button size="small" icon={<UploadOutlined />} loading={uploadMut.isPending}>
            Upload new version
          </Button>
        </Upload>
      </div>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={files ?? []}
        pagination={false}
        columns={[
          {
            title: 'Filename',
            dataIndex: 'filename',
            key: 'filename',
            render: (v: string) => (
              <a href={`/uploads/${v}`} target="_blank" rel="noreferrer">
                {v.split('/').pop()}
              </a>
            ),
            ellipsis: true,
          },
          { title: 'Type', dataIndex: 'filetype', key: 'filetype', width: 90, render: (v: string) => <Tag>{v}</Tag> },
          { title: 'Uploaded by', dataIndex: 'uploadedByName', key: 'uploadedByName', width: 160, render: (v: string) => v || <Text type="secondary">—</Text> },
          { title: 'When', dataIndex: 'uploadedAt', key: 'uploadedAt', width: 170, render: (v: string | null) => v ? new Date(v).toLocaleString() : '—' },
          {
            title: 'Locked',
            dataIndex: 'isLocked',
            key: 'isLocked',
            width: 110,
            render: (v: boolean, row) => (
              <Button
                size="small"
                type="text"
                icon={v ? <LockOutlined /> : <UnlockOutlined />}
                onClick={async () => {
                  try {
                    await updateFileMut.mutateAsync({ id: row.id, input: { isLocked: !v } });
                  } catch (err) {
                    message.error(toApiError(err).message);
                  }
                }}
              >
                {v ? 'Locked' : 'Open'}
              </Button>
            ),
          },
          {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, row) => (
              <Popconfirm
                title="Delete this file version?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try { await deleteFileMut.mutateAsync({ id: row.id, machineId: machine.id }); message.success('File deleted.'); }
                  catch (err) { message.error(toApiError(err).message); }
                }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </div>
  );
}

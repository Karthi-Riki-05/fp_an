'use client';

import { App, Button, DatePicker, Form, Modal, Popconfirm, Select, Table, Typography, Input } from 'antd';
import { DeleteOutlined, EditOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { useMe } from '../../../../../lib/api/auth';
import {
  useWarningList,
  useUpdateWarning,
  useDeleteWarning,
  type WarningRow,
} from '../../../../../lib/api/admin-results';
import { useEquipmentList } from '../../../../../lib/api/equipment';
import { DateRangeStrip } from '../../../../../components/result/DateRangeStrip';
import { toApiError } from '../../../../../lib/api-client';

const { Title, Text } = Typography;

interface EditFormShape {
  equipmentId?: number;
  fromTime?: Dayjs;
  toTime?: Dayjs;
  notificationText?: string;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function WarningPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const [form] = Form.useForm<EditFormShape>();

  const today = todayYMD();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [editing, setEditing] = useState<WarningRow | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = me?.activeTenantId;

  const { data, isFetching } = useWarningList(tenantId, { page, perPage, from, to });
  const updateWarning = useUpdateWarning(tenantId);
  const deleteWarning = useDeleteWarning(tenantId);
  const { data: equipmentList } = useEquipmentList(tenantId ?? null);

  const equipmentOptions = useMemo(
    () => (equipmentList ?? []).map((e) => ({ value: e.id, label: e.name ?? `#${e.id}` })),
    [equipmentList],
  );

  // Watch fromTime/toTime so the modal shows the recomputed duration live.
  const watchedFrom = Form.useWatch('fromTime', form);
  const watchedTo = Form.useWatch('toTime', form);
  const computedDurationSec = useMemo(() => {
    if (!watchedFrom || !watchedTo) return null;
    const diff = (watchedTo as Dayjs).diff(watchedFrom as Dayjs, 'second');
    return diff > 0 ? diff : 0;
  }, [watchedFrom, watchedTo]);

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant first.</Text>;

  function handleRangeChange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setPage(1);
  }

  function openEdit(row: WarningRow) {
    setEditing(row);
    form.setFieldsValue({
      equipmentId: row.equipmentId ?? undefined,
      fromTime: row.fromTimestamp ? dayjs(row.fromTimestamp) : undefined,
      toTime:   row.toTimestamp   ? dayjs(row.toTimestamp)   : undefined,
      notificationText: row.notificationText ?? '',
    });
  }

  async function handleEditSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await updateWarning.mutateAsync({
        id: editing!.id,
        input: {
          equipmentId: values.equipmentId,
          fromTime: values.fromTime ? (values.fromTime as Dayjs).toISOString() : undefined,
          toTime:   values.toTime   ? (values.toTime as Dayjs).toISOString()   : undefined,
          notificationText: values.notificationText,
        },
      });
      message.success('Warning updated.');
      setEditing(null);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // validation error
      message.error(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: WarningRow) {
    try {
      await deleteWarning.mutateAsync(row.id);
      message.success('Warning deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  }

  const PER_PAGE_OPTIONS = [
    { value: 10,   label: 'Show 10 entries' },
    { value: 25,   label: 'Show 25 entries' },
    { value: 50,   label: 'Show 50 entries' },
    { value: 9999, label: 'Show All' },
  ];

  const columns = [
    { title: 'S.No', dataIndex: 'id', width: 70 },
    {
      title: 'Equipment Name',
      dataIndex: 'equipmentName',
      ellipsis: true,
      render: (v: unknown) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      width: 110,
      render: (v: number | null) => fmtDuration(v),
    },
    {
      title: 'Notification text',
      dataIndex: 'notificationText',
      ellipsis: true,
      render: (v: unknown) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'From timestamp',
      dataIndex: 'fromTimestamp',
      width: 170,
      render: fmtDateTime,
    },
    {
      title: 'To timestamp',
      dataIndex: 'toTimestamp',
      width: 170,
      render: fmtDateTime,
    },
    {
      title: 'Actions',
      width: 100,
      render: (_: unknown, row: WarningRow) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ color: '#01b9d0' }} />}
            title="Edit"
            onClick={() => openEdit(row)}
          />
          <Popconfirm
            title="Delete this warning?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="Delete" />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: '0 0 12px' }}>Warning log</Title>

      <DateRangeStrip label="Date Range" value={{ from, to }} onChange={handleRangeChange} />

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
        <Select
          value={perPage}
          onChange={(v) => { setPerPage(v); setPage(1); }}
          options={PER_PAGE_OPTIONS}
          style={{ width: 160 }}
          size="small"
        />
        <div style={{ flex: 1 }} />
        <Button
          icon={<FileExcelOutlined />}
          style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
          size="small"
          onClick={() => message.info('Export not yet implemented')}
        >
          Excel
        </Button>
      </div>

      <Table<WarningRow>
        rowKey="id"
        loading={isFetching}
        dataSource={data?.data ?? []}
        columns={columns}
        scroll={{ x: 'max-content' }}
        size="small"
        pagination={{
          current: page,
          pageSize: perPage === 9999 ? (data?.total ?? 50) : perPage,
          total: data?.total ?? 0,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} records`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Edit modal — RESOLVED v: edits equipId + from/to time; duration is computed. */}
      <Modal
        open={editing !== null}
        title={`Edit Warning #${editing?.id ?? ''}`}
        onCancel={() => setEditing(null)}
        onOk={handleEditSave}
        okText="Save"
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Equipment" name="equipmentId" rules={[{ required: true, message: 'Equipment is required' }]}>
            <Select
              options={equipmentOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select equipment"
            />
          </Form.Item>
          <Form.Item
            label="From timestamp"
            name="fromTime"
            rules={[{ required: true, message: 'From timestamp is required' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="To timestamp"
            name="toTime"
            rules={[
              { required: true, message: 'To timestamp is required' },
              {
                validator: (_, value: Dayjs | undefined) => {
                  const fromVal = form.getFieldValue('fromTime') as Dayjs | undefined;
                  if (!value || !fromVal) return Promise.resolve();
                  return value.isAfter(fromVal)
                    ? Promise.resolve()
                    : Promise.reject(new Error('To timestamp must be after From'));
                },
              },
            ]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          {/* Duration is read-only — server recomputes from from/to and stores it. */}
          <Form.Item label="Duration (computed)">
            <Input
              value={computedDurationSec === null ? '—' : fmtDuration(computedDurationSec)}
              disabled
            />
          </Form.Item>
          <Form.Item label="Notification text" name="notificationText">
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

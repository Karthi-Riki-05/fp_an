'use client';

import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { App, Button, Modal, Popconfirm, Select, Switch, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toApiError } from '../../../../lib/api-client';
import { useMe } from '../../../../lib/api/auth';
import {
  useDeleteFeedback,
  useFeedbackList,
  useUpdateFeedback,
  type FeedbackRow,
} from '../../../../lib/api/feedback';
import { useTenantsList } from '../../../../lib/api/tenants';

const { Title, Text } = Typography;

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Resolved', color: 'default' },
  1: { label: 'Open', color: 'processing' },
  2: { label: 'In progress', color: 'gold' },
};

export default function FeedbackPage() {
  const { data: me } = useMe();
  const { message } = App.useApp();
  const tenants = useTenantsList({ enabled: !!me?.isAdmin });

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [tenantFilter, setTenantFilter] = useState<number | undefined>(undefined);
  const [previewing, setPreviewing] = useState<FeedbackRow | null>(null);

  const { data, isFetching } = useFeedbackList({
    page,
    perPage,
    tenantId: tenantFilter,
    sort: 'createdAt',
    order: 'desc',
  });
  const remove = useDeleteFeedback();
  const update = useUpdateFeedback();

  if (!me) return null;

  const onDelete = async (row: FeedbackRow) => {
    try {
      await remove.mutateAsync(row.id);
      message.success('Feedback deleted.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onSetStatus = async (row: FeedbackRow, status: number) => {
    try {
      await update.mutateAsync({ id: row.id, input: { status } });
      message.success(`Marked as ${STATUS_LABELS[status]?.label ?? status}.`);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const onToggleVisibility = async (row: FeedbackRow) => {
    try {
      await update.mutateAsync({ id: row.id, input: { visibleToTenant: !row.visibleToTenant } });
      message.success(row.visibleToTenant ? 'Hidden from tenant.' : 'Shared with tenant.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Feedback</Title>
          <Text type="secondary">
            {me.isAdmin
              ? 'Customer feedback across all tenants. Filter by tenant if you need to focus.'
              : 'Public feedback shared with your company.'}
          </Text>
        </div>
        {me.isAdmin && (
          <Select
            allowClear
            placeholder="All tenants"
            style={{ minWidth: 220 }}
            value={tenantFilter}
            onChange={(v) => {
              setTenantFilter(v);
              setPage(1);
            }}
            options={(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        )}
      </div>

      <Table<FeedbackRow>
        style={{ marginTop: 16 }}
        rowKey="id"
        loading={isFetching}
        dataSource={data?.data ?? []}
        pagination={{
          current: page,
          pageSize: perPage,
          total: data?.total ?? 0,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPerPage(ps);
          },
        }}
        columns={[
          { title: 'S.No', dataIndex: 'id', width: 70 },
          {
            title: 'Date',
            dataIndex: 'createdAt',
            width: 170,
            render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: 'Feedback',
            dataIndex: 'body',
            ellipsis: true,
            render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
          },
          {
            title: 'Company',
            dataIndex: 'tenantNameSnap',
            width: 200,
            render: (v: string) => v || <Text type="secondary">—</Text>,
          },
          {
            title: 'User',
            dataIndex: 'userNameSnap',
            width: 200,
            render: (v: string, row) => v || row.userEmailSnap || <Text type="secondary">—</Text>,
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            render: (v: number, row) =>
              me.isAdmin ? (
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={v}
                  onChange={(next) => onSetStatus(row, next)}
                  options={Object.entries(STATUS_LABELS).map(([k, s]) => ({ value: Number(k), label: s.label }))}
                />
              ) : (
                <Tag color={STATUS_LABELS[v]?.color}>{STATUS_LABELS[v]?.label ?? v}</Tag>
              ),
          },
          ...(me.isAdmin
            ? [{
                title: 'Visible to tenant',
                dataIndex: 'visibleToTenant',
                width: 140,
                render: (v: boolean, row: FeedbackRow) => (
                  <Switch checked={v} onChange={() => onToggleVisibility(row)} />
                ),
              }]
            : []),
          {
            title: 'Actions',
            width: 110,
            render: (_, row) => (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#01b9d0' }} />} onClick={() => setPreviewing(row)} />
                {me.isAdmin && (
                  <Popconfirm title="Delete this feedback?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(row)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </span>
            ),
          },
        ]}
      />

      <Modal
        open={previewing !== null}
        title={`Feedback #${previewing?.id ?? ''}`}
        footer={null}
        onCancel={() => setPreviewing(null)}
        width={620}
      >
        {previewing && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">From: </Text>
              <strong>{previewing.userNameSnap || previewing.userEmailSnap || 'Unknown user'}</strong>
              {previewing.tenantNameSnap && (
                <span style={{ marginLeft: 8 }}>
                  <Text type="secondary">·</Text> <Tag>{previewing.tenantNameSnap}</Tag>
                </span>
              )}
            </div>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
              {dayjs(previewing.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 6, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {previewing.body}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

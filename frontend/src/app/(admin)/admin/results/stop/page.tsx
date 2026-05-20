'use client';

import { App, Button, Checkbox, Modal, Select, Table, Typography } from 'antd';
import { EditOutlined, FileExcelOutlined, PaperClipOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useMe } from '../../../../../lib/api/auth';
import {
  useStopList,
  useUpdateStop,
  type StopRow,
} from '../../../../../lib/api/admin-results';
import { DateRangeStrip } from '../../../../../components/result/DateRangeStrip';
import {
  StopDataForm,
  stopFormToInput,
  type StopFormShape,
} from '../../../../../components/result/StopDataForm';
import { toApiError } from '../../../../../lib/api-client';

const { Title, Text } = Typography;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

export default function StopPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId;

  const today = todayYMD();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [editing, setEditing] = useState<StopRow | null>(null);

  const { data, isFetching } = useStopList(tenantId, {
    page, perPage, from, to,
    include_excluded: includeExcluded ? '1' : '0',
  });
  const updateMut = useUpdateStop(tenantId);

  const initialValues: Partial<StopFormShape> | undefined = editing ? (() => {
    const hours = editing.hours ?? (editing.sumOfTime ? Math.floor(editing.sumOfTime / 60) : undefined);
    const minutes = editing.minutes ?? (editing.sumOfTime ? editing.sumOfTime % 60 : undefined);
    return {
      partId: editing.partId ?? undefined,
      workShiftId: editing.workShiftId && editing.workShiftId > 0 ? editing.workShiftId : undefined,
      workShiftName: editing.workShiftId && editing.workShiftId > 0 ? undefined : editing.shiftName ?? undefined,
      stopTypeId: editing.stopTypeId ?? undefined,
      reasonId: editing.reasonId ?? undefined,
      orderNo: editing.orderNo ?? '',
      quantity: editing.quantity ?? undefined,
      timeHours: hours,
      timeMinutes: minutes,
      comment: editing.comment ?? '',
      date: editing.selectedDate ? dayjs(editing.selectedDate) : null,
    };
  })() : undefined;

  async function handleSubmit(values: StopFormShape) {
    try {
      await updateMut.mutateAsync({ id: editing!.id, input: stopFormToInput(values) });
      message.success('Stop row updated.');
      setEditing(null);
    } catch (err) {
      message.error(toApiError(err).message);
    }
  }

  if (!me) return null;
  if (!tenantId) return <Text type="secondary">Pick a tenant first.</Text>;

  const PER_PAGE_OPTIONS = [
    { value: 10, label: 'Show 10 entries' },
    { value: 25, label: 'Show 25 entries' },
    { value: 50, label: 'Show 50 entries' },
    { value: 9999, label: 'Show All' },
  ];

  const columns = [
    { title: 'S No', dataIndex: 'id', width: 70 },
    { title: 'Flödesnamn', dataIndex: 'flowName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Utrustningsbenämning', dataIndex: 'equipmentName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Artikelnummer', dataIndex: 'partNumber', width: 130, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Artikelnamn', dataIndex: 'partName', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Skift-benämning', dataIndex: 'shiftName', width: 130, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Ordernummer', dataIndex: 'orderNo', width: 120, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Antal', dataIndex: 'quantity', width: 80, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Tid', dataIndex: 'time', width: 80, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Summa tid', dataIndex: 'sumOfTime', width: 110, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Förlustmodellkategori', dataIndex: 'lossCategory', width: 170, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Stoptyp', dataIndex: 'stopType', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Stopporsak', dataIndex: 'stopReason', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Kommentar', dataIndex: 'comment', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Valt datum', dataIndex: 'selectedDate', width: 110, render: fmtDate },
    { title: 'Stop tidsstämpel', dataIndex: 'stopTimestamp', width: 170, render: fmtDateTime },
    { title: 'Restart tidsstämpel', dataIndex: 'restartTimestamp', width: 180, render: fmtDateTime },
    { title: 'Skapad datum', dataIndex: 'createdAt', width: 170, render: fmtDateTime },
    { title: 'Skapad av', dataIndex: 'createdBy', width: 140, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    {
      title: 'Bilaga',
      dataIndex: 'attachment',
      width: 80,
      render: (v: unknown) => v ? (
        <a href={String(v)} target="_blank" rel="noreferrer"><PaperClipOutlined /></a>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      width: 80,
      render: (_: unknown, row: StopRow) => (
        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} title="Edit" onClick={() => setEditing(row)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: '0 0 12px' }}>Registrerade stopp</Title>
      <DateRangeStrip value={{ from, to }} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      <div style={{ marginTop: 12 }}>
        <Checkbox checked={includeExcluded} onChange={(e) => { setIncludeExcluded(e.target.checked); setPage(1); }}>
          Visa även exkluderade kategorier
        </Checkbox>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}>
        <Select value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} options={PER_PAGE_OPTIONS} style={{ width: 160 }} size="small" />
        <div style={{ flex: 1 }} />
        <Button icon={<FileExcelOutlined />} style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} size="small"
          onClick={() => message.info('Export not yet implemented')}>Excel</Button>
      </div>
      <Table<StopRow>
        rowKey="id" loading={isFetching} dataSource={data?.data ?? []} columns={columns}
        scroll={{ x: 'max-content' }} size="small"
        pagination={{
          current: page,
          pageSize: perPage === 9999 ? (data?.total ?? 10) : perPage,
          total: data?.total ?? 0, showSizeChanger: false,
          showTotal: (total) => `Total ${total} records`,
          onChange: (p) => setPage(p),
        }}
      />
      <Modal
        open={editing !== null}
        title={`Edit stop row #${editing?.id ?? ''}`}
        onCancel={() => setEditing(null)}
        footer={null}
        width={560} destroyOnClose maskClosable={false}
      >
        {editing && (
          <StopDataForm
            tenantId={tenantId}
            equipmentId={editing.equipmentId}
            selectedDate={editing.selectedDate ? String(editing.selectedDate).slice(0, 10) : null}
            initialValues={initialValues}
            initiallyShowShiftFallback={
              !!(editing && (!editing.workShiftId || editing.workShiftId === 0) && editing.shiftName)
            }
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            isLoading={updateMut.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

'use client';

import { App, Button, Modal, Select, Table, Typography } from 'antd';
import { EditOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useMe } from '../../../../../lib/api/auth';
import {
  useProductionList,
  useUpdateProduction,
  type ProductionRow,
} from '../../../../../lib/api/admin-results';
import { DateRangeStrip } from '../../../../../components/result/DateRangeStrip';
import {
  ProductionDataForm,
  productionFormToInput,
  type ProductionFormShape,
} from '../../../../../components/result/ProductionDataForm';
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

export default function ProductionPage() {
  const { message } = App.useApp();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId;

  const today = todayYMD();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editing, setEditing] = useState<ProductionRow | null>(null);

  const { data, isFetching } = useProductionList(tenantId, { page, perPage, from, to });
  const updateMut = useUpdateProduction(tenantId);

  const initialValues: Partial<ProductionFormShape> | undefined = editing ? {
    partId: editing.partId ?? undefined,
    workShiftId: editing.workShiftId && editing.workShiftId > 0 ? editing.workShiftId : undefined,
    workShiftName: editing.workShiftId && editing.workShiftId > 0 ? undefined : editing.shiftName ?? undefined,
    orderNo: editing.orderNo ?? '',
    workHours: editing.workedHours !== null && editing.workedHours !== undefined ? Number(editing.workedHours) : undefined,
    partQty: editing.okPartsQty ?? undefined,
    plannedQty: editing.plannedQty ?? undefined,
    comment: editing.comment ?? '',
    date: editing.selectedDate ? dayjs(editing.selectedDate) : null,
  } : undefined;

  async function handleSubmit(values: ProductionFormShape) {
    try {
      await updateMut.mutateAsync({ id: editing!.id, input: productionFormToInput(values) });
      message.success('Production row updated.');
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
    { title: 'Arbetad tid', dataIndex: 'workedHours', width: 110, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'OK-delar', dataIndex: 'okPartsQty', width: 90, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Planerat antal', dataIndex: 'plannedQty', width: 120, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Kommentar', dataIndex: 'comment', ellipsis: true, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    { title: 'Valt datum', dataIndex: 'selectedDate', width: 110, render: fmtDate },
    { title: 'Skapad datum', dataIndex: 'createdAt', width: 170, render: fmtDateTime },
    { title: 'Skapad av', dataIndex: 'createdBy', width: 140, render: (v: unknown) => v ?? <Text type="secondary">—</Text> },
    {
      title: 'Actions',
      width: 80,
      render: (_: unknown, row: ProductionRow) => (
        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#01b9d0' }} />} title="Edit" onClick={() => setEditing(row)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ margin: '0 0 12px' }}>Produktionsdata</Title>
      <DateRangeStrip value={{ from, to }} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
        <Select value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} options={PER_PAGE_OPTIONS} style={{ width: 160 }} size="small" />
        <div style={{ flex: 1 }} />
        <Button icon={<FileExcelOutlined />} style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} size="small"
          onClick={() => message.info('Export not yet implemented')}>Excel</Button>
      </div>
      <Table<ProductionRow>
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
        title={`Edit production row #${editing?.id ?? ''}`}
        onCancel={() => setEditing(null)}
        footer={null}
        width={560} destroyOnClose maskClosable={false}
      >
        {editing && (
          <ProductionDataForm
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

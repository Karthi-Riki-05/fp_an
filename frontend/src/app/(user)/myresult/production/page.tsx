'use client';

import { App, Button, Select, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useProductionList, type ProductionRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';
import { useUnitsList } from '../../../../lib/api/units';
import { toApiError } from '../../../../lib/api-client';
import {
  useSaveProduction,
  useEquipmentParts,
  useEquipmentOrders,
  useEquipmentFlow,
  currentShiftName,
  todayLocal,
} from '../../../../lib/api/operator-logging';

const BRAND = '#01b9d0';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';

/** Functional mobile quick-entry: machine + qty stepper + wired submit. */
function ProductionQuickEntry() {
  const { message } = App.useApp();
  const { data: units } = useUnitsList();
  const saveProduction = useSaveProduction();

  const [machineId, setMachineId] = useState<number | null>(null);
  const [partId, setPartId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [qty, setQty] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    if (machineId == null && units && units.length > 0) setMachineId(units[0].id);
  }, [units, machineId]);

  const machine = units?.find((u) => u.id === machineId) ?? null;
  const equipmentId = machine?.equipmentId ?? null;
  const { data: parts } = useEquipmentParts(equipmentId);
  const { data: orders } = useEquipmentOrders(equipmentId);
  const { data: flows } = useEquipmentFlow(equipmentId);

  const order = orders?.find((o) => o.id === orderId) ?? null;
  // Prefer the selected order's flow; else the equipment's first flow.
  const flowId = (order?.flowId && order.flowId > 0) ? order.flowId : (flows?.[0]?.id ?? 0);

  const step = (d: number) => setQty((q) => Math.max(0, q + d));

  const onMachineChange = (v: number) => {
    setMachineId(v);
    setPartId(null);
    setOrderId(null);
  };

  const onSubmit = async () => {
    if (!machine || !equipmentId) { message.warning('Select a machine first'); return; }
    if (qty <= 0) { message.warning('Quantity must be greater than 0'); return; }
    try {
      await saveProduction.mutateAsync({
        equipmentId,
        flowId,
        partId: partId ?? 0,
        orderNo: order?.orderNr ?? '',
        date: todayLocal(),
        partQty: qty,
        workShiftName: currentShiftName(),
        workHours: '',
      });
      message.success('Production logged ✓');
      setTodayTotal((t) => t + qty);
      setQty(0);
    } catch (err) {
      message.error(toApiError(err).message || 'Failed to log production');
    }
  };

  const roundBtn = (label: string, onClick: () => void): React.ReactNode => (
    <button type="button" onClick={onClick}
      style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, border: `2px solid ${BRAND}`, background: 'white', color: BRAND, fontFamily: 'var(--font-poppins)', fontSize: 24, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: '12px 12px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#8c8c8c' }}>Quick Production Entry</span>
        <span style={{ fontSize: 10, color: '#8c8c8c' }}>{currentShiftName()} · today {todayTotal}</span>
      </div>
      <div style={{ background: 'white', borderRadius: 10, boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0', padding: 16 }}>
        {/* Machine selector */}
        <Select
          value={machineId ?? undefined}
          onChange={onMachineChange}
          placeholder="Select a machine"
          style={{ width: '100%', marginBottom: 10 }}
          options={(units ?? []).map((u) => ({ value: u.id, label: u.unitName || u.equipmentName || `Machine ${u.id}` }))}
        />

        {/* Part Number + Work Order pickers */}
        <Select
          value={partId ?? undefined}
          onChange={setPartId}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={parts?.length ? 'Part Number' : 'No parts for this machine'}
          disabled={!parts?.length}
          style={{ width: '100%', marginBottom: 10 }}
          options={(parts ?? []).map((p) => ({ value: p.id, label: `${p.partNo} · ${p.name}` }))}
        />
        <Select
          value={orderId ?? undefined}
          onChange={setOrderId}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={orders?.length ? 'Work Order' : 'No orders for this machine'}
          disabled={!orders?.length}
          style={{ width: '100%', marginBottom: 14 }}
          options={(orders ?? []).map((o) => ({ value: o.id, label: o.orderNr }))}
        />

        {/* Big +/- quantity control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          {roundBtn('−', () => step(-1))}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 40, fontWeight: 800, color: '#262626', lineHeight: 1 }}>{qty}</div>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8c8c8c', marginTop: 4 }}>Good Parts</div>
          </div>
          {roundBtn('+', () => step(1))}
        </div>

        {/* +10 / +50 chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[10, 50].map((n) => (
            <button key={n} type="button" onClick={() => step(n)}
              style={{ minHeight: 38, borderRadius: 8, border: '1px solid #d9d9d9', background: '#fafafa', color: '#262626', cursor: 'pointer', fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700 }}>
              +{n}
            </button>
          ))}
        </div>

        {/* Brand gradient submit */}
        <button type="button" disabled={qty <= 0 || saveProduction.isPending} onClick={onSubmit}
          style={{
            width: '100%', minHeight: 50, borderRadius: 10, border: 'none',
            background: qty > 0 ? `linear-gradient(135deg, #00768D, ${BRAND})` : '#c5c5c5',
            color: 'white', cursor: qty > 0 && !saveProduction.isPending ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-poppins)', fontSize: 13, fontWeight: 700,
          }}>
          {saveProduction.isPending ? 'Saving…' : '✓ Log Production'}
        </button>
        <div style={{ fontSize: 10, color: '#8c8c8c', textAlign: 'center', marginTop: 6 }}>
          {machine ? `${machine.unitName || machine.equipmentName} · ${todayLocal()} · flow ${flowId || '—'}` : 'Select a machine to log production.'}
        </div>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

const COLUMNS: MyColumn<ProductionRow>[] = [
  { key: 'rowNum',        title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'flowName',      title: 'Flow name',       sqlCol: 'fd.name' },
  { key: 'equipmentName', title: 'Equipment Name',  sqlCol: 'e.name' },
  { key: 'partNumber',    title: 'Part number',     sqlCol: 'p.part_no' },
  { key: 'partName',      title: 'Part Name',       sqlCol: 'p.name' },
  { key: 'shiftName',     title: 'Shift Name',      sqlCol: 'pd.work_shift_name' },
  { key: 'orderNo',       title: 'Order NR',        sqlCol: 'pd.order_no' },
  { key: 'workedHours',   title: 'Worked Hours',    sqlCol: 'pd.work_hours' },
  { key: 'okPartsQty',    title: 'Ok Parts Qty',    sqlCol: 'pd.part_qty' },
  { key: 'plannedQty',    title: 'Planned Qty',     sqlCol: 'pd.planned_qty' },
  { key: 'comment',       title: 'Comment',         sqlCol: 'pd.comment' },
  { key: 'selectedDate',  title: 'Selected date',   sqlCol: 'pd.date',       render: (r) => fmt(r.selectedDate) },
  { key: 'createdAt',     title: 'Created date',    sqlCol: 'pd.created_at', render: (r) => fmt(r.createdAt) },
  { key: 'createdBy',     title: 'Created by',      sqlCol: 'u.name' },
];

export default function ProductionPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.production;
  const deleteMut = useDeleteRow('production');

  const listQ = useProductionList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    show_my_entries: s.showMyEntries ? '1' : '0',
    filters: s.filters,
    order: s.order,
  });

  return (
    <>
      <ProductionQuickEntry />
      <ResultsTable<ProductionRow>
        tab="production"
        columns={COLUMNS}
        data={listQ.data}
        loading={listQ.isFetching}
        renderActions={(r) => r.canEdit ? (
          <Space size={4}>
            <Link href={`/myresult/production/${r.id}/edit`}><Button size="small" type="text" icon={<EditOutlined />} /></Link>
            <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : null}
      />
    </>
  );
}

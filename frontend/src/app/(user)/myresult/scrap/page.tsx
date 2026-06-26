'use client';

import { App, Button, Select, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useScrapList, type ScrapRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';
import { useUnitsList } from '../../../../lib/api/units';
import { toApiError } from '../../../../lib/api-client';
import { useEquipmentScrapReasons, useSaveScrap, currentShiftName, todayLocal } from '../../../../lib/api/operator-logging';

const BRAND = '#01b9d0';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';

/** Functional scrap-logger: machine + scrap reason + qty stepper + submit. */
function ScrapLogger() {
  const { message } = App.useApp();
  const { data: units } = useUnitsList();
  const saveScrap = useSaveScrap();

  const [machineId, setMachineId] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ typeId: number; reasonId: number } | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (machineId == null && units && units.length > 0) setMachineId(units[0].id);
  }, [units, machineId]);

  const machine = units?.find((u) => u.id === machineId) ?? null;
  const equipmentId = machine?.equipmentId ?? null;
  const { data: reasonCats } = useEquipmentScrapReasons(equipmentId);

  const reasonOptions = useMemo(
    () =>
      (reasonCats ?? []).flatMap((c) =>
        c.reasons.map((r) => ({ value: `${c.typeId}-${r.id}`, label: `${c.typeName} · ${r.name}`, typeId: c.typeId, reasonId: r.id })),
      ),
    [reasonCats],
  );

  const step = (d: number) => setQty((q) => Math.max(1, q + d));

  const onSubmit = async () => {
    if (!machine || !equipmentId) { message.warning('Select a machine first'); return; }
    if (!selected) { message.warning('Pick a scrap reason'); return; }
    if (qty <= 0) { message.warning('Quantity must be greater than 0'); return; }
    try {
      await saveScrap.mutateAsync({
        equipmentId,
        date: todayLocal(),
        scrapTypeId: selected.typeId,
        scrapReasonId: selected.reasonId,
        quantity: qty,
        workShiftName: currentShiftName(),
      });
      message.success('Scrap logged ✓');
      setSelected(null);
      setQty(1);
    } catch (err) {
      message.error(toApiError(err).message || 'Failed to log scrap');
    }
  };

  const roundBtn = (label: string, onClick: () => void): React.ReactNode => (
    <button type="button" onClick={onClick}
      style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, border: `2px solid ${BRAND}`, background: 'white', color: BRAND, fontFamily: 'var(--font-poppins)', fontSize: 22, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: '12px 12px 4px' }}>
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#8c8c8c', marginBottom: 6 }}>Log Scrap</div>
      <div style={{ background: 'white', borderRadius: 10, boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0', padding: 16 }}>
        {/* Machine selector */}
        <Select
          value={machineId ?? undefined}
          onChange={(v) => { setMachineId(v); setSelected(null); }}
          placeholder="Select a machine"
          style={{ width: '100%', marginBottom: 12 }}
          options={(units ?? []).map((u) => ({ value: u.id, label: u.unitName || u.equipmentName || `Machine ${u.id}` }))}
        />

        {/* Scrap reason selector */}
        <Select
          value={selected ? `${selected.typeId}-${selected.reasonId}` : undefined}
          onChange={(v) => {
            const o = reasonOptions.find((x) => x.value === v);
            setSelected(o ? { typeId: o.typeId, reasonId: o.reasonId } : null);
          }}
          placeholder={reasonOptions.length ? 'Select a scrap reason' : 'No scrap reasons configured'}
          disabled={reasonOptions.length === 0}
          style={{ width: '100%', marginBottom: 14 }}
          options={reasonOptions.map((o) => ({ value: o.value, label: o.label }))}
        />

        {/* Quantity stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          {roundBtn('−', () => step(-1))}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 36, fontWeight: 800, color: '#262626', lineHeight: 1 }}>{qty}</div>
            <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#8c8c8c', marginTop: 4 }}>Scrap Qty</div>
          </div>
          {roundBtn('+', () => step(1))}
        </div>

        {/* Submit */}
        <button type="button" disabled={!selected || saveScrap.isPending} onClick={onSubmit}
          style={{
            width: '100%', minHeight: 50, borderRadius: 10, border: 'none',
            background: selected ? `linear-gradient(135deg, #00768D, ${BRAND})` : '#c5c5c5',
            color: 'white', cursor: selected && !saveScrap.isPending ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-poppins)', fontSize: 13, fontWeight: 700,
          }}>
          {saveScrap.isPending ? 'Saving…' : '✓ Log Scrap'}
        </button>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

const COLUMNS: MyColumn<ScrapRow>[] = [
  { key: 'rowNum',        title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'flowName',      title: 'Flow name',       sqlCol: 'fd.name' },
  { key: 'equipmentName', title: 'Equipment Name',  sqlCol: 'e.name' },
  { key: 'partNumber',    title: 'Part number',     sqlCol: 'p.part_no' },
  { key: 'partName',      title: 'Part Name',       sqlCol: 'p.name' },
  { key: 'shiftName',     title: 'Shift Name',      sqlCol: 'sd.work_shift_name' },
  { key: 'orderNo',       title: 'Order NR',        sqlCol: 'sd.order_no' },
  { key: 'quantity',      title: 'Quantity',        sqlCol: 'sd.quantity' },
  { key: 'scrapType',     title: 'Scrap type',      sqlCol: 't.name' },
  { key: 'scrapReason',   title: 'Scrap reason',    sqlCol: 'sr.name' },
  { key: 'comment',       title: 'Comment',         sqlCol: 'sd.comment' },
  { key: 'selectedDate',  title: 'Selected date',   sqlCol: 'sd.date',       render: (r) => fmt(r.selectedDate) },
  { key: 'createdAt',     title: 'Created date',    sqlCol: 'sd.created_at', render: (r) => fmt(r.createdAt) },
  { key: 'createdBy',     title: 'Created by',      sqlCol: 'u.name' },
  { key: 'attachment',    title: 'Attachment',                                render: (r) => r.attachment ? <a href={r.attachment} target="_blank" rel="noreferrer">📎</a> : null },
];

export default function ScrapPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.scrap;
  const deleteMut = useDeleteRow('scrap');

  const listQ = useScrapList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    show_my_entries: s.showMyEntries ? '1' : '0',
    filters: s.filters,
    order: s.order,
  });

  return (
    <>
      <ScrapLogger />
      <ResultsTable<ScrapRow>
        tab="scrap"
        columns={COLUMNS}
        data={listQ.data}
        loading={listQ.isFetching}
        renderActions={(r) => r.canEdit ? (
          <Space size={4}>
            <Link href={`/myresult/scrap/${r.id}/edit`}><Button size="small" type="text" icon={<EditOutlined />} /></Link>
            <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : null}
      />
    </>
  );
}

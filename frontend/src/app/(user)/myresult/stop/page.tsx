'use client';

import { App, Button, Select, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useStopList, type StopRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';
import { useUnitsList } from '../../../../lib/api/units';
import { useLiveMachines } from '../../../../hooks/useLiveMachine';
import { toApiError } from '../../../../lib/api-client';
import {
  useEquipmentStopReasons,
  useEquipmentFlow,
  useSaveStop,
  currentShiftName,
  todayLocal,
} from '../../../../lib/api/operator-logging';

const BRAND = '#01b9d0';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';

// Icon hint per stop category name (the API has no icon field).
function categoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('mech')) return '🔧';
  if (n.includes('elec')) return '⚡';
  if (n.includes('material') || n.includes('jam')) return '📦';
  if (n.includes('break') || n.includes('plan')) return '☕';
  if (n.includes('change') || n.includes('setup')) return '🔄';
  if (n.includes('quality')) return '🎯';
  return '⚙️';
}

function elapsed(fromIso: string | null, now: number): { label: string; minutes: number } {
  if (!fromIso) return { label: '00:00:00', minutes: 0 };
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return { label: '00:00:00', minutes: 0 };
  let s = Math.max(0, Math.floor((now - start) / 1000));
  const totalMin = Math.floor(s / 60);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: `${pad(h)}:${pad(m)}:${pad(s)}`, minutes: totalMin };
}

/** Functional stop-logger: machine selector + live banner + reason grid + submit. */
function StopLogger() {
  const { message } = App.useApp();
  const { data: units } = useUnitsList();
  const live = useLiveMachines();
  const saveStop = useSaveStop();

  const [machineId, setMachineId] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ typeId: number; reasonId: number } | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Auto-select the first machine once the list loads.
  useEffect(() => {
    if (machineId == null && units && units.length > 0) setMachineId(units[0].id);
  }, [units, machineId]);

  const machine = units?.find((u) => u.id === machineId) ?? null;
  const equipmentId = machine?.equipmentId ?? null;
  const { data: reasonCats } = useEquipmentStopReasons(equipmentId);
  const { data: flows } = useEquipmentFlow(equipmentId);
  const flowId = flows?.[0]?.id ?? 0;

  // Flatten categories → individual reason buttons (carry the parent typeId).
  const reasonButtons = useMemo(
    () =>
      (reasonCats ?? []).flatMap((c) =>
        c.reasons.map((r) => ({ typeId: c.typeId, reasonId: r.id, label: r.name, icon: categoryIcon(c.typeName) })),
      ),
    [reasonCats],
  );

  // Active IoT stop (socket store) → red banner + live timer.
  const active = useMemo(() => {
    for (const m of Object.values(live)) if (m.openStop) return m;
    return null;
  }, [live]);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const activeName = active
    ? (units?.find((u) => u.id === active.machineId)?.unitName
        ?? units?.find((u) => u.id === active.machineId)?.equipmentName
        ?? `Machine ${active.machineId}`)
    : null;
  const timer = elapsed(active?.openStop?.startTime ?? null, now);

  const onSubmit = async () => {
    if (!machine || !equipmentId) { message.warning('Select a machine first'); return; }
    if (!selected) { message.warning('Pick a stop reason'); return; }
    try {
      await saveStop.mutateAsync({
        equipmentId,
        flowId,
        date: todayLocal(),
        stopTypeId: selected.typeId,
        stopReasonId: selected.reasonId,
        timeMinutes: active ? timer.minutes : 0,
        comment: comment.trim(),
        workShiftName: currentShiftName(),
      });
      message.success('Stop logged ✓');
      setSelected(null);
      setComment('');
      setShowComment(false);
    } catch (err) {
      message.error(toApiError(err).message || 'Failed to log stop');
    }
  };

  return (
    <div style={{ paddingTop: 12 }}>
      {/* Machine selector */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#8c8c8c', marginBottom: 6 }}>Machine</div>
        <Select
          value={machineId ?? undefined}
          onChange={(v) => { setMachineId(v); setSelected(null); }}
          placeholder="Select a machine"
          style={{ width: '100%' }}
          options={(units ?? []).map((u) => ({ value: u.id, label: u.unitName || u.equipmentName || `Machine ${u.id}` }))}
        />
      </div>

      {/* Active-stop banner (red) when IoT reports an open stop */}
      {active ? (
        <div style={{ background: 'linear-gradient(135deg, #dd4b39, #b71c1c)', borderRadius: 10, margin: '0 12px 12px', padding: 16, color: 'white' }}>
          <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 18, fontWeight: 800, textTransform: 'uppercase' }}>⚠️ {activeName} STOPPED</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Detected via IoT</div>
          <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 30, fontWeight: 800, letterSpacing: 2, marginTop: 10 }}>{timer.label}</div>
        </div>
      ) : null}

      {/* Reason grid (real, per-equipment) */}
      {reasonButtons.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px', marginBottom: 10 }}>
          {reasonButtons.map((r) => {
            const isSel = selected?.reasonId === r.reasonId && selected?.typeId === r.typeId;
            return (
              <button key={`${r.typeId}-${r.reasonId}`} type="button"
                onClick={() => setSelected(isSel ? null : { typeId: r.typeId, reasonId: r.reasonId })}
                style={{
                  background: isSel ? 'rgba(1,185,208,0.08)' : 'white',
                  border: `2px solid ${isSel ? BRAND : '#d9d9d9'}`,
                  borderRadius: 10, minHeight: 80, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 6,
                }}>
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <span style={{ fontFamily: 'var(--font-poppins)', fontSize: 10, fontWeight: 600, color: '#262626', textAlign: 'center' }}>{r.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 10, margin: '0 12px 10px', padding: '14px 16px', boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0' }}>
          <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>No stop reasons configured</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
            {machine ? 'This machine has no stop reasons set up. ' : 'Select a machine. '}
            Admin can configure them under Settings, or classify IoT stops in{' '}
            <Link href="/myresult/unregistered" style={{ color: BRAND }}>unregistered stops</Link>.
          </div>
        </div>
      )}

      {/* Optional comment */}
      {showComment ? (
        <div style={{ padding: '0 12px', marginBottom: 10 }}>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" rows={2}
            style={{ width: '100%', borderRadius: 10, border: '1px solid #d9d9d9', padding: 10, fontSize: 12, resize: 'vertical' }} />
        </div>
      ) : null}

      {/* Action strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '0 12px', marginBottom: 16 }}>
        <button type="button" disabled
          style={{ minHeight: 52, borderRadius: 10, border: '1px solid #d9d9d9', background: 'white', color: '#8c8c8c', cursor: 'not-allowed', fontFamily: 'var(--font-poppins)', fontSize: 10, fontWeight: 600 }}>
          📷 Photo
        </button>
        <button type="button" onClick={() => setShowComment((v) => !v)}
          style={{ minHeight: 52, borderRadius: 10, border: `1px solid ${showComment ? BRAND : '#d9d9d9'}`, background: 'white', color: '#262626', cursor: 'pointer', fontFamily: 'var(--font-poppins)', fontSize: 10, fontWeight: 600 }}>
          💬 Comment
        </button>
        <button type="button" disabled={!selected || saveStop.isPending} onClick={onSubmit}
          style={{
            minHeight: 52, borderRadius: 10, border: 'none',
            background: selected ? `linear-gradient(135deg, #00768D, ${BRAND})` : '#c5c5c5',
            color: 'white', cursor: selected && !saveStop.isPending ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-poppins)', fontSize: 10, fontWeight: 700,
          }}>
          {saveStop.isPending ? '…' : '✓ Submit'}
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

const COLUMNS: MyColumn<StopRow>[] = [
  { key: 'rowNum',           title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'flowName',         title: 'Flow name',       sqlCol: 'fd.name' },
  { key: 'equipmentName',    title: 'Equipment Name',  sqlCol: 'e.name' },
  { key: 'partNumber',       title: 'Part number',     sqlCol: 'p.part_no' },
  { key: 'partName',         title: 'Part Name',       sqlCol: 'p.name' },
  { key: 'shiftName',        title: 'Shift Name',      sqlCol: 'sd.work_shift_name' },
  { key: 'orderNo',          title: 'Order NR',        sqlCol: 'sd.order_no' },
  { key: 'quantity',         title: 'Quantity',        sqlCol: 'sd.quantity' },
  { key: 'time',             title: 'Time',            sqlCol: 'sd.time' },
  { key: 'sumOfTime',        title: 'Sum of time',     sqlCol: 'sd.sum_of_time' },
  { key: 'lossCategory',     title: 'Loss model category', sqlCol: 't.type' },
  { key: 'stopType',         title: 'Stop type',       sqlCol: 't.name' },
  { key: 'stopReason',       title: 'Stop reason',     sqlCol: 'sr.name' },
  { key: 'comment',          title: 'Comment',         sqlCol: 'sd.comment' },
  { key: 'selectedDate',     title: 'Selected date',   sqlCol: 'sd.date', render: (r) => fmt(r.selectedDate) },
  { key: 'stopTimestamp',    title: 'Stop timestamp',  sqlCol: 'sd.stop_timestamp',    render: (r) => fmt(r.stopTimestamp) },
  { key: 'restartTimestamp', title: 'Restart timestamp', sqlCol: 'sd.restart_timestamp', render: (r) => fmt(r.restartTimestamp) },
  { key: 'createdAt',        title: 'Created date',    sqlCol: 'sd.created_at',        render: (r) => fmt(r.createdAt) },
  { key: 'createdBy',        title: 'Created by',      sqlCol: 'u.name' },
  { key: 'attachment',       title: 'Attachment',                                       render: (r) => r.attachment ? <a href={r.attachment} target="_blank" rel="noreferrer">📎</a> : null },
];

export default function StopPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.stop;
  const deleteMut = useDeleteRow('stop');

  const listQ = useStopList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    show_my_entries: s.showMyEntries ? '1' : '0',
    exclude_type: s.excludeType ? '1' : '0',
    filters: s.filters,
    order: s.order,
  });

  return (
    <>
      <StopLogger />
      <ResultsTable<StopRow>
        tab="stop"
        columns={COLUMNS}
        data={listQ.data}
        loading={listQ.isFetching}
        showStopExtras
        renderActions={(r) => r.canEdit ? (
          <Space size={4}>
            <Link href={`/myresult/stop/${r.id}/edit`}><Button size="small" type="text" icon={<EditOutlined />} /></Link>
            <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ) : null}
      />
    </>
  );
}

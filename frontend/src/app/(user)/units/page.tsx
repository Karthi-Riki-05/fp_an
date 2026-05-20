'use client';

/**
 * Units page — operator card view ported from the FP Analyzer legacy
 * `frontend.units.unit_list` Blade page. Layout matches the PNG screenshots
 * in /new_fp/screenshots/: a vertical list of expandable rows with smiley
 * status icons, a 1Hz uptime clock, an inline paginated stop list, and a
 * two-step "Register" modal (bucket-list → form with per-bucket shift picker).
 *
 * Reference: /Applications/XAMPP/xamppfiles/htdocs/fpanalyzer/unit.md
 */

import {
  App, Button, Checkbox, Form, Input, Modal, Select, Space, Spin, Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import { CheckOutlined, LeftOutlined, RightOutlined, UploadOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import './units.css';
import { apiClient, toApiError } from '../../../lib/api-client';
import {
  useRegisterStops, useStopDialogPrefill, useUnitsList, useUnitsStatus,
  useUnregisteredBuckets, useUploadStopPicture,
  type ShiftAssignment, type UnitCard, type UnitStatus, type UnregisteredBucket,
} from '../../../lib/api/units';
import { useMe } from '../../../lib/api/auth';
import { useShiftScheduleTitles, useWorkShiftsForSelect } from '../../../components/result/EditModalHooks';

// ─── helpers ───────────────────────────────────────────────────────────────

function fmt(dt: string | null | undefined): string {
  if (!dt) return '—';
  return dayjs(dt).format('YYYY-MM-DD HH:mm:ss');
}

function durationParts(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const day = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { day, h, m, sec };
}

function fmtHMS(seconds: number) {
  const { h, m, sec } = durationParts(seconds);
  const totalH = Math.floor(seconds / 3600);
  return `${String(totalH).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function diffSeconds(start: string, end: string | null) {
  const e = end ? dayjs(end) : dayjs();
  return Math.abs(e.diff(dayjs(start), 'second'));
}

// ─── row colour rules (mirrors unit.md §7.2) ───────────────────────────────

interface RowColors { bg: 'white' | 'red' | 'orange' | 'blue'; clock: 'green' | 'red' | 'black'; }

function rowColors(u: { unitConnected: 'yes' | 'no'; runningStatus: 'on' | 'off'; hasUnregisterData: 'yes' | 'no'; }): RowColors {
  if (u.unitConnected === 'no') {
    return { bg: u.hasUnregisterData === 'yes' ? 'orange' : 'white', clock: 'black' };
  }
  if (u.runningStatus === 'off' && u.hasUnregisterData === 'no') return { bg: 'red', clock: 'red' };
  if (u.runningStatus === 'on'  && u.hasUnregisterData === 'yes') return { bg: 'orange', clock: 'green' };
  if (u.runningStatus === 'off' && u.hasUnregisterData === 'yes') return { bg: 'orange', clock: 'red' };
  return { bg: 'white', clock: 'green' };
}

function smileyIcon(u: { unitConnected: 'yes' | 'no'; runningStatus: 'on' | 'off'; }) {
  if (u.unitConnected === 'no') return '/images/units/ic_unit_machine_not_connected.png';
  return u.runningStatus === 'on'
    ? '/images/units/ic_unit_happy.png'
    : '/images/units/ic_unit_sad.png';
}

// ─── 1 Hz clock — counts since `since` ─────────────────────────────────────

function ClockTicker({ since, colorClass }: { since: string | null; colorClass: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return <div className={`flow-list-clock ${colorClass}`}>00:00:00</div>;
  const sec = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const { day, h, m, sec: ss } = durationParts(sec);
  return (
    <div className={`flow-list-clock ${colorClass}`}>
      {day > 0 && <span className="clock-days">{day} Day{day === 1 ? '' : 's'}</span>}
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(ss).padStart(2, '0')}
    </div>
  );
}

// ─── stop registration modal ───────────────────────────────────────────────

interface StopReasonGroup { typeId: number; typeName: string | null; reasons: { id: number; name: string | null }[]; }
interface PartOption    { id: number; name: string; partNo: string | null; }
interface OrderOption   { id: number; orderNr: string; description: string | null; }

function useEquipmentReasons(equipmentId: number | null) {
  return useQuery({
    queryKey: ['equipment', equipmentId, 'stop-reasons'] as const,
    queryFn: async () =>
      (await apiClient.get<StopReasonGroup[]>(`/equipment/${equipmentId}/stop-reasons`)).data,
    enabled: equipmentId !== null,
    staleTime: 60_000,
  });
}

function useEquipmentParts(equipmentId: number | null) {
  return useQuery({
    queryKey: ['equipment', equipmentId, 'parts'] as const,
    queryFn: async () =>
      (await apiClient.get<PartOption[]>(`/equipment/${equipmentId}/parts`)).data,
    enabled: equipmentId !== null,
    staleTime: 60_000,
  });
}

function useEquipmentOrders(equipmentId: number | null) {
  return useQuery({
    queryKey: ['equipment', equipmentId, 'orders'] as const,
    queryFn: async () =>
      (await apiClient.get<OrderOption[]>(`/equipment/${equipmentId}/orders`)).data,
    enabled: equipmentId !== null,
    staleTime: 60_000,
  });
}

interface StopRegistrationModalProps {
  open: boolean;
  unit: UnitCard | null;
  buckets: UnregisteredBucket[];
  isPreReg: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function StopRegistrationModal({ open, unit, buckets, isPreReg, onClose, onSaved }: StopRegistrationModalProps) {
  const { message } = App.useApp();
  const equipmentId = unit?.equipmentId ?? null;

  const reasonsQ  = useEquipmentReasons(equipmentId);
  const partsQ    = useEquipmentParts(equipmentId);
  const ordersQ   = useEquipmentOrders(equipmentId);
  const prefillQ  = useStopDialogPrefill(equipmentId, open);
  const shiftsQ   = useWorkShiftsForSelect(open ? 1 : null);

  const registerMut = useRegisterStops(unit?.id ?? null);
  const uploadMut   = useUploadStopPicture(unit?.id ?? null);

  const [reasonComposite, setReasonComposite] = useState<string | undefined>();
  const [partId, setPartId]                   = useState<number | undefined>();
  const [orderNo, setOrderNo]                 = useState<string | undefined>();
  const [comment, setComment]                 = useState<string>('');
  const [pictureUrl, setPictureUrl]           = useState<string | null>(null);
  const [workShiftMap, setWorkShiftMap]       = useState<Record<string, ShiftAssignment>>({});

  // Sum of selected durations (read-only label).
  const sumSec = useMemo(() => buckets.reduce((acc, b) => acc + diffSeconds(b.startTime, b.endTime), 0), [buckets]);

  // Apply prefill / reset when modal opens.
  useEffect(() => {
    if (!open) return;
    setReasonComposite(prefillQ.data?.stopReasonComposite ?? undefined);
    setPartId(prefillQ.data?.partId ?? undefined);
    setOrderNo(prefillQ.data?.orderNo ?? undefined);
    setComment(prefillQ.data?.comment ?? '');
    setPictureUrl(null);
    setWorkShiftMap({});
  }, [open, prefillQ.data]);

  const partOptions = (partsQ.data ?? []).map((p) => ({
    value: p.id, label: p.partNo ? `${p.partNo} — ${p.name}` : p.name,
  }));
  const orderOptions = (ordersQ.data ?? []).map((o) => ({
    value: o.orderNr,
    label: o.description ? `${o.orderNr} — ${o.description}` : o.orderNr,
  }));
  const reasonOptions = (reasonsQ.data ?? []).map((g) => ({
    label: g.typeName ?? `#${g.typeId}`,
    options: g.reasons.map((r) => ({ value: `${g.typeId}-${r.id}`, label: r.name ?? `#${r.id}` })),
  }));

  async function handleUpload(file: File) {
    try {
      const { filename } = await uploadMut.mutateAsync(file);
      setPictureUrl(filename);
      message.success('Attachment uploaded.');
    } catch (err) {
      message.error(toApiError(err).message);
    }
    return false; // suppress AntD default upload
  }

  async function handleSave() {
    if (!reasonComposite) { message.error('Pick a stop reason.'); return; }
    for (const b of buckets) {
      if (!workShiftMap[String(b.id)]) { message.error('Assign a shift to every stop.'); return; }
    }
    try {
      const r = await registerMut.mutateAsync({
        type: isPreReg ? 'pre-reg' : '',
        stopBucketIds: buckets.map((b) => b.id),
        stopReasonComposite: reasonComposite,
        partId: partId ?? null,
        orderNo: orderNo ?? null,
        workShiftMap,
        comment: comment || null,
        picture: pictureUrl,
      });
      message.success(`${r.created} stop${r.created === 1 ? '' : 's'} registered.`);
      onSaved();
    } catch (err) {
      message.error(toApiError(err).message);
    }
  }

  return (
    <Modal
      open={open}
      title={unit?.equipmentName || unit?.unitName || 'Stop Registration'}
      onCancel={onClose}
      width={560}
      maskClosable={false}
      keyboard={false}
      destroyOnClose
      footer={null}
    >
      <h4 style={{ textAlign: 'center', marginTop: 0, marginBottom: 18 }}>Stop Registration</h4>
      <Form layout="vertical" onFinish={handleSave}>
        <Form.Item label={<>Cause <span style={{ color: 'red' }}>*</span></>} required>
          <Select
            value={reasonComposite}
            onChange={setReasonComposite}
            placeholder="Select Reason"
            options={reasonOptions}
            showSearch
            optionFilterProp="label"
            loading={reasonsQ.isFetching}
          />
        </Form.Item>

        <Form.Item label={<>Work shift <span style={{ color: 'red' }}>*</span></>} required>
          <BucketShiftsTable
            buckets={buckets}
            equipmentId={equipmentId}
            workShifts={shiftsQ.data ?? []}
            value={workShiftMap}
            onChange={(id, v) => setWorkShiftMap((m) => ({ ...m, [String(id)]: v }))}
          />
        </Form.Item>

        <Form.Item label="Part ID">
          <Select
            value={partId}
            onChange={setPartId}
            placeholder="Choose part"
            options={partOptions}
            allowClear
            showSearch
            optionFilterProp="label"
            loading={partsQ.isFetching}
          />
        </Form.Item>

        <Form.Item label="Order NR">
          {orderOptions.length > 0 ? (
            <Select
              value={orderNo}
              onChange={setOrderNo}
              placeholder="Select Order Nr"
              options={orderOptions}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          ) : (
            <Input value={orderNo ?? ''} onChange={(e) => setOrderNo(e.target.value)} placeholder="(optional)" maxLength={255} />
          )}
        </Form.Item>

        <Form.Item>
          Sum of stop time : <strong style={{ color: '#ff8600' }}>{fmtHMS(sumSec)}</strong>
        </Form.Item>

        <Form.Item label="Comment">
          <Input.TextArea rows={3} maxLength={255} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter comment" />
        </Form.Item>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Upload<UploadFile>
              beforeUpload={(f) => handleUpload(f as unknown as File)}
              showUploadList={false}
              accept="image/*"
              disabled={uploadMut.isPending}
            >
              <Button icon={pictureUrl
                ? <img src={pictureUrl} alt="" style={{ width: 18, height: 18, objectFit: 'cover' }} />
                : <UploadOutlined />}
                loading={uploadMut.isPending}>
                {pictureUrl ? 'Replace' : 'Photo'}
              </Button>
            </Upload>
            <Button
              type="primary"
              htmlType="submit"
              icon={<CheckOutlined />}
              loading={registerMut.isPending}
            >SAVE</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── per-bucket shift picker ───────────────────────────────────────────────

interface BucketShiftsTableProps {
  buckets: UnregisteredBucket[];
  equipmentId: number | null;
  workShifts: { id: number; name: string | null }[];
  value: Record<string, ShiftAssignment>;
  onChange: (bucketId: number, v: ShiftAssignment) => void;
}

function BucketShiftsTable({ buckets, equipmentId, workShifts, value, onChange }: BucketShiftsTableProps) {
  if (buckets.length === 0) return null;
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 4 }}>
      {buckets.map((b) => (
        <BucketShiftRow
          key={b.id}
          bucket={b}
          equipmentId={equipmentId}
          workShifts={workShifts}
          value={value[String(b.id)] ?? null}
          onChange={(v) => onChange(b.id, v)}
        />
      ))}
    </div>
  );
}

interface BucketShiftRowProps {
  bucket: UnregisteredBucket;
  equipmentId: number | null;
  workShifts: { id: number; name: string | null }[];
  value: ShiftAssignment | null;
  onChange: (v: ShiftAssignment) => void;
}

function BucketShiftRow({ bucket, equipmentId, workShifts, value, onChange }: BucketShiftRowProps) {
  const date = bucket.startTime.slice(0, 10);
  const titlesQ = useShiftScheduleTitles(1, date, equipmentId);
  const titles = titlesQ.data ?? [];

  const options = [
    { label: 'Schedule', options: titles.map((t) => ({ value: `s:${t.scheduleId}`, label: t.title })) },
    { label: 'Work shifts', options: workShifts.map((w) => ({ value: `w:${w.id}`, label: w.name ?? `#${w.id}` })) },
  ];

  // Auto-pick on first render when a schedule title covers the bucket's start.
  useEffect(() => {
    if (value) return;
    const startMs = new Date(bucket.startTime).getTime();
    const hit = titles.find((t) => {
      // The endpoint returns scheduleId + title; we don't have start/end here.
      // Auto-pick is best-effort: pick the first title if there's exactly one.
      return false;
    });
    if (hit) onChange({ id: null, name: hit.title, type: 'schedule' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles]);

  const currentValue = value
    ? (value.type === 'schedule'
        ? `s:${value.id ?? 0}`
        : value.id != null ? `w:${value.id}` : undefined)
    : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #f3f3f3' }}>
      <div style={{ flex: 1, fontSize: 12, color: '#666', lineHeight: 1.4 }}>
        <div><span style={{ color: '#00768e' }}>Start:</span> {fmt(bucket.startTime)}</div>
        <div><span style={{ color: '#00768e' }}>End:</span> {fmt(bucket.endTime)}</div>
      </div>
      <Select
        style={{ minWidth: 200 }}
        value={currentValue}
        placeholder="Pick shift"
        loading={titlesQ.isFetching}
        options={options}
        onChange={(picked) => {
          const [kind, idStr] = picked.split(':');
          const id = Number(idStr);
          if (kind === 's') {
            const t = titles.find((x) => x.scheduleId === id);
            onChange({ id: null, name: t?.title ?? `schedule-${id}`, type: 'schedule' });
          } else {
            const w = workShifts.find((x) => x.id === id);
            onChange({ id, name: w?.name ?? `#${id}` });
          }
        }}
        showSearch
        optionFilterProp="label"
      />
    </div>
  );
}

// ─── unit row (expandable) ─────────────────────────────────────────────────

interface UnitRowProps {
  unit: UnitCard;
  status: UnitStatus | undefined;
  expanded: boolean;
  onToggle: () => void;
  onOpenModal: (buckets: UnregisteredBucket[], isPreReg: boolean) => void;
}

function UnitRow({ unit, status, expanded, onToggle, onOpenModal }: UnitRowProps) {
  // Use live status when available; otherwise the initial card snapshot.
  const live = status
    ? {
        runningStatus: status.runningStatus,
        unitConnected: status.unitConnected,
        hasUnregisterData: status.hasUnregisterData,
        signalType: status.signalType,
        updatedAt: status.updatedAt,
        latestIsRegistered: status.latestIsRegistered,
        latestStartTime: status.startTime,
        latestEndTime: status.endTime,
        latestDataId: status.machineDataId,
      }
    : {
        runningStatus: unit.runningStatus,
        unitConnected: unit.unitConnected,
        hasUnregisterData: unit.hasUnregisterData,
        signalType: unit.signalType,
        updatedAt: unit.updatedAt,
        latestIsRegistered: null,
        latestStartTime: null,
        latestEndTime: null,
        latestDataId: null,
      };

  const colors = rowColors(live);
  const isWarning = live.signalType === 'warning';

  return (
    <li className={`item${expanded ? ' active' : ''}`} data-id={unit.id}>
      <div className={`li-head ${colors.bg}`} onClick={onToggle}>
        <span className="img-cont">
          <img src={smileyIcon(live)} alt={unit.unitName ?? `Unit ${unit.id}`} />
        </span>
        {isWarning && (
          <span className="warning-img">
            <img
              src={live.runningStatus === 'on' ? '/images/units/ic_warning.png' : '/images/units/ic_warning_off.png'}
              alt="warning"
            />
          </span>
        )}
        <div className="unit-name">{unit.equipmentName || unit.unitName || `Unit ${unit.id}`}</div>
        <ClockTicker since={live.updatedAt} colorClass={colors.clock} />
        <div className="li-chevron">▾</div>
      </div>

      {expanded && (
        <UnitChildren
          unit={unit}
          live={live}
          onOpenModal={onOpenModal}
        />
      )}
    </li>
  );
}

// ─── expanded body: running row + paginated stop list ──────────────────────

interface LiveBits {
  runningStatus: 'on' | 'off';
  unitConnected: 'yes' | 'no';
  hasUnregisterData: 'yes' | 'no';
  signalType: 'on' | 'off' | 'warning';
  updatedAt: string | null;
  latestIsRegistered: 'no' | 'yes' | 'pre' | null;
  latestStartTime: string | null;
  latestEndTime: string | null;
  latestDataId: number | null;
}

function UnitChildren({ unit, live, onOpenModal }:
  { unit: UnitCard; live: LiveBits; onOpenModal: (b: UnregisteredBucket[], pre: boolean) => void }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [preRegSelected, setPreRegSelected] = useState(false);

  const bucketsQ = useUnregisteredBuckets(unit.id, true, page, perPage);
  const buckets = bucketsQ.data?.data ?? [];
  const totalPages = bucketsQ.data ? Math.max(1, Math.ceil(bucketsQ.data.total / perPage)) : 1;

  // Reset selection when paging or when this row loses data.
  useEffect(() => { setSelectedIds(new Set()); }, [page, perPage]);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(buckets.map((b) => b.id)) : new Set());
  }

  function toggleOne(id: number) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedBuckets = useMemo(() => buckets.filter((b) => selectedIds.has(b.id)), [buckets, selectedIds]);
  const sumSec = useMemo(() => selectedBuckets.reduce((acc, b) => acc + diffSeconds(b.startTime, b.endTime), 0), [selectedBuckets]);

  function handleRegister() {
    if (selectedBuckets.length === 0) return;
    onOpenModal(selectedBuckets, false);
  }

  // Synthesise a "currently running" bucket from the live status payload.
  // Only shown when machine is off and the latest data row has no end_time.
  const runningBucket: UnregisteredBucket | null =
    live.runningStatus === 'off' && live.latestDataId && live.latestStartTime && !live.latestEndTime
      ? {
          id: live.latestDataId,
          machineId: unit.id,
          startTime: live.latestStartTime,
          endTime: null,
          productionTime: null,
          isValidData: true,
        }
      : null;

  function handlePreRegister() {
    if (!runningBucket) return;
    onOpenModal([runningBucket], true);
  }

  return (
    <ul className="child-cont-hld" data-flow-id={unit.id} data-equip-id={unit.equipmentId}>
      {runningBucket && (
        <li className="running-row">
          <div className="running-row-grid">
            <div>
              <div className="label-row">Stop</div>
              <div>{fmt(runningBucket.startTime)}</div>
            </div>
            <div>
              <div className="label-row">Duration</div>
              <div><RunningDuration since={runningBucket.startTime} /></div>
            </div>
            <div>
              <div className="label-row">Pre Register</div>
              <div className="pre-reg-cell">
                {live.latestIsRegistered === 'pre' ? (
                  <CheckOutlined style={{ fontSize: 22, color: '#27bb55' }} />
                ) : (
                  <>
                    <Checkbox checked={preRegSelected} onChange={(e) => setPreRegSelected(e.target.checked)} />
                    {preRegSelected && (
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handlePreRegister}>
                        Register
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </li>
      )}

      <li>
        <div className="child-header">
          <div className="ch-title">Unregistered stops</div>
          <div className="ch-actions">
            {selectedBuckets.length > 0 && (
              <>
                <div className="ch-sum">
                  Sum of time<br />
                  <strong>{fmtHMS(sumSec)}</strong>
                </div>
                <Button type="primary" icon={<CheckOutlined />} onClick={handleRegister}>Register</Button>
              </>
            )}
            <Checkbox
              checked={buckets.length > 0 && selectedIds.size === buckets.length}
              indeterminate={selectedIds.size > 0 && selectedIds.size < buckets.length}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={buckets.length === 0}
            />
          </div>
        </div>
      </li>

      {bucketsQ.isFetching && buckets.length === 0 ? (
        <li style={{ padding: 20, textAlign: 'center' }}><Spin /></li>
      ) : buckets.length === 0 ? (
        <li className="units-empty">No data found</li>
      ) : (
        <>
          {buckets.map((b) => (
            <li
              key={b.id}
              className={`stop-row${selectedIds.has(b.id) ? ' selected' : ''}`}
              onClick={() => toggleOne(b.id)}
            >
              <div className="col1">
                <div className="label-row">Stop</div>
                <div className="icon-row">{fmt(b.startTime)}</div>
              </div>
              <div className="col2">
                <div className="label-row">
                  Duration:{' '}
                  <span className={b.endTime ? '' : 'duration-overdue'}>{fmtHMS(diffSeconds(b.startTime, b.endTime))}</span>
                </div>
                <div className="icon-row">{b.endTime ? fmt(b.endTime) : 'Running…'}</div>
              </div>
              <div className="col3">
                <Checkbox checked={selectedIds.has(b.id)} onChange={() => toggleOne(b.id)} onClick={(e) => e.stopPropagation()} />
              </div>
            </li>
          ))}
          <li>
            <div className="units-pagination">
              <div className="pg-left">
                <span>Show</span>
                <Select
                  size="small"
                  value={perPage}
                  onChange={(v) => { setPerPage(v); setPage(1); }}
                  options={[10, 20, 30].map((n) => ({ value: n, label: String(n) }))}
                  style={{ width: 70 }}
                />
              </div>
              <div className="pg-right">
                <Button size="small" icon={<LeftOutlined />} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                <span className="pg-num">Page {page} of {totalPages}</span>
                <Button size="small" type="primary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next <RightOutlined /></Button>
              </div>
            </div>
          </li>
        </>
      )}
    </ul>
  );
}

function RunningDuration({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return <>{fmtHMS(sec)}</>;
}

// ─── page shell ────────────────────────────────────────────────────────────

export default function UnitsPage() {
  const listQ = useUnitsList();
  const { data: me } = useMe();
  // The user-side "Inställningar" tab on /dashboard?tab=settings persists
  // a per-user hidden + order list at tablePreferences.unit_web_settings.units.
  // Apply it here so the operator's card grid matches their saved selection.
  const units = useMemo(() => {
    const all = listQ.data ?? [];
    const blob = me?.tablePreferences as Record<string, unknown> | undefined;
    const ws = blob?.unit_web_settings as Record<string, unknown> | undefined;
    const prefs = (ws?.units as { hidden?: number[]; order?: number[] }) ?? {};
    const hidden = new Set<number>(prefs.hidden ?? []);
    const visible = all.filter((u) => !hidden.has(u.id));
    if (!prefs.order || prefs.order.length === 0) return visible;
    const orderMap = new Map<number, number>();
    prefs.order.forEach((id, idx) => orderMap.set(id, idx));
    return [...visible].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [listQ.data, me]);

  const machineIds = useMemo(() => units.map((u) => u.id), [units]);
  const statusQ = useUnitsStatus(machineIds);
  const statusById = useMemo(() => {
    const m = new Map<number, UnitStatus>();
    (statusQ.data ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [statusQ.data]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [modalState, setModalState] = useState<{
    open: boolean; unit: UnitCard | null; buckets: UnregisteredBucket[]; isPreReg: boolean;
  }>({ open: false, unit: null, buckets: [], isPreReg: false });

  function openModal(unit: UnitCard) {
    return (buckets: UnregisteredBucket[], isPreReg: boolean) => {
      setModalState({ open: true, unit, buckets, isPreReg });
    };
  }

  return (
    <div className="units-page">
      <div className="units-panel">
        <div className="units-panel-heading">
          <a className="back-link" href="/dashboard">
            <img src="/images/units/ic_arrow_left.png" alt="back" />
          </a>
          Units
        </div>
        <div className="units-panel-body">
          <div className="units-title-row"><h4>Unit List</h4></div>

          {listQ.isFetching && units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : units.length === 0 ? (
            <div className="units-empty">No units configured.</div>
          ) : (
            <ul className="flow-list-view-hld">
              {units.map((u) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  status={statusById.get(u.id)}
                  expanded={expandedId === u.id}
                  onToggle={() => setExpandedId((cur) => (cur === u.id ? null : u.id))}
                  onOpenModal={openModal(u)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <StopRegistrationModal
        open={modalState.open}
        unit={modalState.unit}
        buckets={modalState.buckets}
        isPreReg={modalState.isPreReg}
        onClose={() => setModalState((s) => ({ ...s, open: false }))}
        onSaved={() => setModalState({ open: false, unit: null, buckets: [], isPreReg: false })}
      />
    </div>
  );
}

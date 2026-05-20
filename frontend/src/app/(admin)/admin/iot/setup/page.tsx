'use client';

import {
  CloseCircleOutlined,
  GoldOutlined,
  SmileFilled,
  WarningFilled,
} from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  Col,
  Collapse,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tree,
  Typography,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient, toApiError } from '../../../../../lib/api-client';
import { useMe } from '../../../../../lib/api/auth';
import type { EquipmentTreeNode } from '../../../../../lib/api/equipment';

const { Title, Text } = Typography;

// ─── Constants ───────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  on: 'ON Signal',
  off: 'OFF Signal',
  warning: 'Warning Signal',
};

const SIGNAL_OPTIONS = [
  { value: 'on', label: 'ON Signal' },
  { value: 'off', label: 'OFF Signal' },
  { value: 'warning', label: 'Warning Signal' },
];

/**
 * Per DROPDOWN_AUDIT RESOLVED ix the canonical counter date-filter set is
 * the legacy 9-value list (with the spelling typo `yestarday` corrected to
 * `yesterday`). We still accept `yestarday` on read for back-compat with
 * any pre-migration data, but always write `yesterday` going forward.
 */
const DATE_FILTER_OPTIONS = [
  { value: 'today',          label: 'Today' },
  { value: 'yesterday',      label: 'Yesterday' },
  { value: 'this_week',      label: 'This week' },
  { value: 'week_to_week',   label: 'Week to week' },
  { value: 'previous_week',  label: 'Previous week' },
  { value: 'this_month',     label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'this_year',      label: 'This year' },
  { value: 'previous_year',  label: 'Previous year' },
];

/** Normalise a legacy stored value to the canonical form. */
function normaliseDateFilter(v: string | null | undefined): string {
  if (!v) return 'today';
  if (v === 'yestarday') return 'yesterday';
  return v;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfiguredUnit {
  id: number;
  unitName: string;
  signalType: string | null;
  filterTime: number | null;
  filterTimeOn: number | null;
  customNotificationText: string | null;
  notificationDefault: boolean | null;
  installationDate: string | null;
  pinNo: string | null;
  lastOnline: string | null;
  runningStatus: string | null;
  parentId: number | null;
  isAutoRegistered: string | null;
  autoRegisteredData: string | null;
  counterDetails: string | null;
  equipmentId: number | null;
  equipmentName: string | null;
}

interface UnconfiguredUnit {
  id: number;
  unitName: string;
  signalType: string | null;
  lastOnline: string | null;
  runningStatus: string | null;
  equipmentId: number | null;
}

interface CounterChild {
  id: number;
  unitName: string;
  counterDetails: string | null;
}

interface CounterDetailsObj {
  date_filter?: string;
  part_per_hour?: number;
  target_product?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

function parseCounterDetails(raw: string | null | undefined): CounterDetailsObj | null {
  const obj = parseJson(raw);
  if (!obj) return null;
  return obj as CounterDetailsObj;
}

function toTreeData(nodes: EquipmentTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.name,
    children: n.children?.length ? toTreeData(n.children) : undefined,
  }));
}

function statusDot(unit: ConfiguredUnit) {
  if (unit.runningStatus === 'on') {
    return <SmileFilled style={{ color: '#52c41a', marginRight: 6 }} />;
  }
  if (unit.signalType === 'warning' || unit.runningStatus === 'off') {
    return <WarningFilled style={{ color: '#faad14', marginRight: 6 }} />;
  }
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#bfbfbf', marginRight: 6, verticalAlign: 'middle' }} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EquipmentPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (equipmentId: number) => void;
  treeData: DataNode[];
  loading: boolean;
}

function EquipmentPickerModal({ open, onClose, onSelect, treeData, loading }: EquipmentPickerModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  function handleOk() {
    if (selected !== null) {
      onSelect(selected);
      setSelected(null);
    }
  }

  return (
    <Modal
      title="Select equipment"
      open={open}
      onCancel={() => { setSelected(null); onClose(); }}
      onOk={handleOk}
      okButtonProps={{ disabled: selected === null }}
      okText="Assign"
      destroyOnClose
      width={480}
    >
      {loading ? (
        <Spin />
      ) : (
        <Tree
          treeData={treeData}
          selectedKeys={selected !== null ? [selected] : []}
          onSelect={(keys) => setSelected(keys.length ? Number(keys[0]) : null)}
          defaultExpandAll
          blockNode
        />
      )}
    </Modal>
  );
}

// ─── Counter child row ────────────────────────────────────────────────────────

interface CounterRowProps {
  child: CounterChild;
  headers: Record<string, string> | undefined;
  onSaved: () => void;
}

function CounterRow({ child, headers, onSaved }: CounterRowProps) {
  const { message } = App.useApp();
  const parsed = parseCounterDetails(child.counterDetails);

  const [dateFilter, setDateFilter] = useState<string>(normaliseDateFilter(parsed?.date_filter));
  const [partPerHour, setPartPerHour] = useState<number>(parsed?.part_per_hour ?? 0);
  const [targetProduct, setTargetProduct] = useState<number>(parsed?.target_product ?? 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      await apiClient.patch(
        `/admin/iot/units/${child.id}/counter-settings`,
        { dateFilter, partPerHour, targetProduct },
        { headers },
      );
    },
    onSuccess: () => { message.success('Counter settings saved'); onSaved(); },
    onError: (err) => { message.error(toApiError(err).message); },
  });

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
      <Text strong style={{ minWidth: 120 }}>{child.unitName}</Text>
      <Select
        size="small"
        value={dateFilter}
        onChange={setDateFilter}
        options={DATE_FILTER_OPTIONS}
        style={{ width: 110 }}
      />
      <InputNumber
        size="small"
        value={partPerHour}
        onChange={(v) => setPartPerHour(v ?? 0)}
        placeholder="Parts/hr"
        min={0}
        style={{ width: 100 }}
      />
      <InputNumber
        size="small"
        value={targetProduct}
        onChange={(v) => setTargetProduct(v ?? 0)}
        placeholder="Target"
        min={0}
        style={{ width: 100 }}
      />
      <Button size="small" type="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
        Save
      </Button>
    </div>
  );
}

// ─── Configured unit panel body ───────────────────────────────────────────────

interface UnitPanelProps {
  unit: ConfiguredUnit;
  headers: Record<string, string> | undefined;
  onOpenEquipPicker: (unitId: number) => void;
  onRemoveEquipment: (unitId: number) => void;
}

/** Grouped stop-reason response shape returned by /admin/iot/stop-reasons?equipmentId= */
interface GroupedReason {
  typeId: number;
  typeName: string;
  reasons: Array<{ id: number; name: string }>;
}

function UnitPanel({ unit, headers, onOpenEquipPicker, onRemoveEquipment }: UnitPanelProps) {
  const { message } = App.useApp();
  const qc = useQueryClient();

  // Local state for editable fields
  const [signalType, setSignalType] = useState<string>(unit.signalType ?? 'on');
  const [filterTime, setFilterTime] = useState<number | null>(unit.filterTime ?? null);
  const [filterTimeOn, setFilterTimeOn] = useState<number | null>(unit.filterTimeOn ?? null);
  const [notifText, setNotifText] = useState<string>(unit.customNotificationText ?? '');
  const [notifDefault, setNotifDefault] = useState<boolean>(Boolean(unit.notificationDefault));
  // RESOLVED iv: equipment-scoped, grouped reason/flow options.
  const equipmentId = unit.equipmentId;

  // Equipment-scoped reason list. Returns either the legacy grouped shape
  // (when equipmentId is set) or the tenant-wide flat list as a fallback.
  const causeQuery = useQuery({
    queryKey: ['iot-stop-reasons-eq', equipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<GroupedReason[]>(
        `/admin/iot/stop-reasons${equipmentId ? `?equipmentId=${equipmentId}` : ''}`,
        { headers },
      );
      return data;
    },
    enabled: !!equipmentId,
    staleTime: 60_000,
  });

  // Equipment-filtered flow-designs (only flows whose nodeDataArray
  // contains the unit's equipment).
  const flowsQuery = useQuery({
    queryKey: ['iot-flow-designs-eq', equipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<Array<{ id: number; name: string }>>(
        `/admin/iot/flow-designs${equipmentId ? `?equipmentId=${equipmentId}` : ''}`,
        { headers },
      );
      return data;
    },
    enabled: !!equipmentId,
    staleTime: 60_000,
  });

  // Group the cause query into AntD <Select> optgroup option-set shape.
  // The /admin/iot/stop-reasons endpoint returns the grouped shape when
  // equipmentId is supplied (Phase A4) — the flat fallback path is only
  // hit by the unconfigured case which we don't render here.
  const causeOptions = (causeQuery.data ?? []).map((g) => ({
    label: g.typeName,
    options: g.reasons.map((r) => ({ value: `${g.typeId}-${r.id}`, label: r.name })),
  }));

  const flowOptions = (flowsQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }));

  // Counter children — loaded when panel is first expanded
  const [counterExpanded, setCounterExpanded] = useState(false);
  const counterQuery = useQuery({
    queryKey: ['counter-children', unit.id],
    queryFn: async () => {
      const { data } = await apiClient.get<CounterChild[]>(`/admin/iot/units/${unit.id}/counter-children`, { headers });
      return data;
    },
    enabled: counterExpanded,
    staleTime: 30_000,
  });

  const patchSettings = useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      await apiClient.patch(`/admin/iot/units/${unit.id}/settings`, dto, { headers });
    },
    onError: (err) => { message.error(toApiError(err).message); },
  });

  const testNotifMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/admin/iot/units/${unit.id}/test-notification`, {}, { headers });
      return data;
    },
    onSuccess: (data: { message?: string }) => { message.success(data?.message ?? 'Test notification sent'); },
    onError: (err) => { message.error(toApiError(err).message); },
  });

  const autoData = parseJson(unit.autoRegisteredData) as Record<string, unknown> | null;
  const initialAutoStopLimit = autoData?.time_limit ?? autoData?.stop_time_limit ?? null;
  const [isAutoRegistered, setIsAutoRegistered] = useState<boolean>(unit.isAutoRegistered === 'yes');
  const [autoStopLimit, setAutoStopLimit] = useState<number | null>(
    initialAutoStopLimit === null ? null : Number(initialAutoStopLimit),
  );
  // Legacy `log_warning` lives on the machines column; we mirror it client-side
  // so the conditional warning checkbox below can drive PATCH /settings.
  const [logWarning, setLogWarning] = useState<boolean>(
    Boolean((unit as unknown as { logWarning?: boolean }).logWarning),
  );

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' };
  const labelStyle: React.CSSProperties = { minWidth: 180, fontWeight: 500, color: '#555' };

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* 2-column layout mirrors the legacy expanded panel:
          left column = unit + signal + filter + notification config;
          right column = auto-stop registration + counters + actions.   */}
      <Row gutter={[24, 0]}>
        {/* ── Left column ─────────────────────────────────────────── */}
        <Col xs={24} lg={14}>
          <div style={rowStyle}>
            <span style={labelStyle}>Installation Date</span>
            <Text type="secondary">{unit.installationDate ?? '—'}</Text>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Input Number</span>
            <Text type="secondary">{unit.pinNo ?? '—'}</Text>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Equipment Name</span>
            <Text>{unit.equipmentName ?? '—'}</Text>
            <Button
              size="small"
              type="link"
              style={{ padding: 0 }}
              onClick={() => onOpenEquipPicker(unit.id)}
            >
              Change Equipment
            </Button>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Signal Type</span>
            <Select
              size="small"
              value={signalType}
              options={SIGNAL_OPTIONS}
              style={{ width: 160 }}
              onChange={(v) => {
                setSignalType(v);
                patchSettings.mutate({ signalType: v });
              }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Filter Time (sec)</span>
            <InputNumber
              size="small"
              min={0}
              value={filterTime}
              style={{ width: 120 }}
              onChange={(v) => setFilterTime(v)}
              onBlur={() => { if (filterTime !== null) patchSettings.mutate({ filterTime }); }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Filter Time On (sec)</span>
            <InputNumber
              size="small"
              min={0}
              value={filterTimeOn}
              style={{ width: 120 }}
              onChange={(v) => setFilterTimeOn(v)}
              onBlur={() => { if (filterTimeOn !== null) patchSettings.mutate({ filterTimeOn }); }}
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Notification Text</span>
            <Input
              size="small"
              maxLength={100}
              value={notifText}
              style={{ width: 280 }}
              onChange={(e) => setNotifText(e.target.value)}
              onBlur={() => patchSettings.mutate({ customNotificationText: notifText })}
            />
            <Checkbox
              checked={notifDefault}
              onChange={(e) => {
                setNotifDefault(e.target.checked);
                patchSettings.mutate({ notificationDefault: e.target.checked });
              }}
              style={{ marginLeft: 8 }}
            >
              Use default
            </Checkbox>
          </div>
          {signalType === 'warning' && (
            <div style={rowStyle}>
              <span style={labelStyle}>Log Warning</span>
              <Checkbox
                checked={logWarning}
                onChange={(e) => {
                  setLogWarning(e.target.checked);
                  patchSettings.mutate({ logWarning: e.target.checked });
                }}
              />
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle} />
            <Button
              size="small"
              onClick={() => testNotifMut.mutate()}
              loading={testNotifMut.isPending}
            >
              Send test notification
            </Button>
          </div>
        </Col>

        {/* ── Right column — Auto Stop Registration + Cause + Flow ── */}
        <Col xs={24} lg={10}>
          <div style={{
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}>
            <div style={rowStyle}>
              <Checkbox
                checked={isAutoRegistered}
                onChange={(e) => {
                  setIsAutoRegistered(e.target.checked);
                  patchSettings.mutate({ isAutoRegistered: e.target.checked });
                }}
              >
                <strong>Auto Stop Registration</strong>
              </Checkbox>
              {unit.isAutoRegistered === 'yes' && <Tag color="green">Active</Tag>}
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Time Limit (min)</span>
              <InputNumber
                size="small"
                min={1}
                disabled={!isAutoRegistered}
                value={autoStopLimit}
                style={{ width: 100 }}
                onChange={(v) => setAutoStopLimit(v)}
                onBlur={() => {
                  if (autoStopLimit !== null) patchSettings.mutate({ autoStopTimeLimit: autoStopLimit });
                }}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Cause</span>
              <Select
                size="small"
                allowClear
                placeholder={equipmentId
                  ? (causeQuery.isLoading ? 'Loading…' : (causeOptions.length === 0 ? 'No causes for this equipment' : 'Select cause…'))
                  : 'Assign equipment first'}
                loading={causeQuery.isLoading}
                disabled={!isAutoRegistered || !equipmentId || causeQuery.isLoading}
                options={causeOptions}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
              />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Flow Name</span>
              <Select
                size="small"
                allowClear
                placeholder={equipmentId
                  ? (flowsQuery.isLoading ? 'Loading…' : (flowOptions.length === 0 ? 'No flows reference this equipment' : 'Select flow…'))
                  : 'Assign equipment first'}
                loading={flowsQuery.isLoading}
                disabled={!isAutoRegistered || !equipmentId || flowsQuery.isLoading}
                options={flowOptions}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* Counter children section */}
      <div style={{ marginTop: 12 }}>
        <Collapse
          size="small"
          onChange={(keys) => setCounterExpanded(keys.length > 0)}
          items={[{
            key: 'counter',
            label: 'Counter Inputs',
            children: counterQuery.isLoading ? (
              <Spin size="small" />
            ) : (counterQuery.data?.length ?? 0) === 0 ? (
              <Text type="secondary">No counter inputs linked.</Text>
            ) : (
              <div>
                {(counterQuery.data ?? []).map((child) => (
                  <CounterRow
                    key={child.id}
                    child={child}
                    headers={headers}
                    onSaved={() => qc.invalidateQueries({ queryKey: ['counter-children', unit.id] })}
                  />
                ))}
              </div>
            ),
          }]}
        />
      </div>

      {/* Remove equipment assignment */}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Button
          danger
          size="small"
          icon={<CloseCircleOutlined />}
          onClick={() => onRemoveEquipment(unit.id)}
        >
          Remove equipment assignment
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetupUnitsPage() {
  const { data: me } = useMe();
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  // Equipment picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState<number | null>(null);

  if (!me) return <Spin style={{ display: 'block', marginTop: 40 }} />;

  const tenantId = me.activeTenantId;
  if (!tenantId) return <Text type="secondary">Pick a tenant first.</Text>;

  const headers = me.isAdmin && tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;

  // ── Data queries ──────────────────────────────────────────────────────────

  const unitsQuery = useQuery({
    queryKey: ['iot-units', tenantId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ configured: ConfiguredUnit[]; unconfigured: UnconfiguredUnit[] }>(
        '/admin/iot/units',
        { headers },
      );
      return data;
    },
    // 5-sec live status poll — matches the legacy `startUpdateMachineStatus`
    // interval. `refetchInterval` keeps the panel headers (status icon +
    // runningStatus label) fresh without re-mounting any form state.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });

  // RESOLVED iv: per-unit cause/flow queries now live inside UnitPanel where
  // we know the unit's equipmentId. The previous tenant-wide flat queries
  // were a regression vs. legacy and are removed.

  const equipTreeQuery = useQuery({
    queryKey: ['equipment-tree', tenantId],
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentTreeNode[]>('/equipment/tree', { headers });
      return data;
    },
    enabled: pickerOpen,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const assignEquipMut = useMutation({
    mutationFn: async ({ unitId, equipmentId }: { unitId: number; equipmentId: number }) => {
      await apiClient.post(`/admin/iot/units/${unitId}/equipment`, { equipmentId }, { headers });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot-units', tenantId] });
      message.success('Equipment assigned');
      setPickerOpen(false);
      setPickerTargetId(null);
    },
    onError: (err) => { message.error(toApiError(err).message); },
  });

  const removeEquipMut = useMutation({
    mutationFn: async (unitId: number) => {
      await apiClient.delete(`/admin/iot/units/${unitId}/equipment`, { headers });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot-units', tenantId] });
      message.success('Equipment assignment removed');
    },
    onError: (err) => { message.error(toApiError(err).message); },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openEquipPicker(unitId: number) {
    setPickerTargetId(unitId);
    setPickerOpen(true);
  }

  function handleEquipSelect(equipmentId: number) {
    if (pickerTargetId === null) return;
    assignEquipMut.mutate({ unitId: pickerTargetId, equipmentId });
  }

  function handleRemoveEquipment(unitId: number) {
    modal.confirm({
      title: 'Remove equipment assignment?',
      content: 'This will unlink the equipment from this unit. The machine record itself is not deleted.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: async () => { await removeEquipMut.mutateAsync(unitId); },
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  const configured = unitsQuery.data?.configured ?? [];
  const unconfigured = unitsQuery.data?.unconfigured ?? [];
  const treeData = equipTreeQuery.data ? toTreeData(equipTreeQuery.data) : [];

  // ── Configured tab — Collapse panels ─────────────────────────────────────

  const collapseItems = configured.map((unit) => {
    const signalLabel = SIGNAL_LABELS[unit.signalType ?? ''] ?? unit.signalType ?? '—';
    return {
      key: String(unit.id),
      // Match the legacy panel header: <icon> name — Input - <pin> — signal
      // on the left, live status icon hard-right. AntD's `Collapse` puts
      // its caret as a sibling of `label`, so we use a flex row to push
      // the status icon to the end without breaking the click target.
      label: (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Space>
            <GoldOutlined />
            <span style={{ fontWeight: 500 }}>{unit.unitName}</span>
            <span style={{ color: '#999' }}>Input - {unit.pinNo ?? '—'}</span>
            <span style={{ color: '#13c2c2' }}>{signalLabel}</span>
          </Space>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
            {statusDot(unit)}
            <span style={{ fontSize: 12, color: '#666', textTransform: 'uppercase' }}>
              {unit.runningStatus ?? '—'}
            </span>
          </span>
        </div>
      ),
      children: (
        <UnitPanel
          unit={unit}
          headers={headers}
          onOpenEquipPicker={openEquipPicker}
          onRemoveEquipment={handleRemoveEquipment}
        />
      ),
    };
  });

  // ── Unconfigured tab — accordion (matches legacy `unconfigured_unit.blade.php`)

  const unconfiguredCollapseItems = unconfigured.map((unit) => ({
    key: String(unit.id),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Space>
          <GoldOutlined />
          <span style={{ fontWeight: 500 }}>{unit.unitName}</span>
          <span style={{ color: '#999' }}>
            Input - {(unit as unknown as { pinNo?: string }).pinNo ?? '—'}
          </span>
        </Space>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
          {unit.lastOnline ? `last seen ${new Date(unit.lastOnline).toLocaleString()}` : 'never seen'}
        </span>
      </div>
    ),
    children: (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ minWidth: 180, fontWeight: 500, color: '#555' }}>Last Online</span>
          <Text type="secondary">{unit.lastOnline ? new Date(unit.lastOnline).toLocaleString() : '—'}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ minWidth: 180, fontWeight: 500, color: '#555' }}>Equipment</span>
          <Text type="secondary">(not assigned)</Text>
          <Button
            size="small"
            type="primary"
            onClick={() => openEquipPicker(unit.id)}
            style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
          >
            Add Equipment
          </Button>
        </div>
      </div>
    ),
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Setup units</Title>

      <Tabs
        defaultActiveKey="configured"
        items={[
          {
            key: 'configured',
            label: `Configured unit (${configured.length})`,
            children: unitsQuery.isLoading ? (
              <Spin style={{ display: 'block', marginTop: 24 }} />
            ) : configured.length === 0 ? (
              <Text type="secondary">No configured units found.</Text>
            ) : (
              <Collapse
                accordion={false}
                items={collapseItems}
                style={{ background: 'transparent' }}
              />
            ),
          },
          {
            key: 'unconfigured',
            label: `Unconfigured units (${unconfigured.length})`,
            children: unitsQuery.isLoading ? (
              <Spin style={{ display: 'block', marginTop: 24 }} />
            ) : unconfigured.length === 0 ? (
              <Text type="secondary">No unconfigured units. Newly-pinged IoT inputs will appear here.</Text>
            ) : (
              <Collapse
                accordion={false}
                items={unconfiguredCollapseItems}
                style={{ background: 'transparent' }}
              />
            ),
          },
        ]}
      />

      <EquipmentPickerModal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTargetId(null); }}
        onSelect={handleEquipSelect}
        treeData={treeData}
        loading={equipTreeQuery.isLoading}
      />
    </div>
  );
}

'use client';

/**
 * Dashboard Creator — React port of legacy fpanalyzer
 * `/admin/board/dashboardCreator` (BoardController::creator + creator.blade.php).
 *
 * Legacy used jQuery UI: `.draggable({ connectToSortable: '...' })`
 * on each widget, `.sortable()` on the canvas, `.resizable({ handles: 'n,s,e,w,se' })`
 * on each placed slot. We use `react-grid-layout` — same interaction
 * model (drag from sidebar, free placement, free resize), zero jQuery.
 *
 * Slot data on save mirrors the legacy `dashboards.slot_data` shape so
 * Phase B back-ports / dual-tenant reads stay 1:1:
 *
 *   [
 *     {
 *       slot_id: 0,                        // ordinal in the dashboard
 *       w_id: 12,                          // dashboard_widgets.id (or -1/-2 for unit_list/text-editor)
 *       slot_w: 33.3,                      // width % — derived from item.w / 12 cols
 *       slot_h: 320,                       // px — derived from item.h * rowHeight
 *       title_hide?: boolean,
 *       title_custom?: string,
 *       slot_type?: 'unit_list' | 'text-editor',
 *       slot_data?: string                 // unit_list: csv ids; text-editor: base64
 *     }
 *   ]
 *
 * Visual styling (white tiles + grey rail + grid-texture canvas)
 * mirrors the legacy `creator.blade.php` CSS (`background:url('/images/grid_texture.png')`,
 * `box-shadow: 1px 1px 5px #c1c1c1`).
 */

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// react-grid-layout v2.x is a hooks-based rewrite. We pull from its
// `legacy` subpath which preserves the v1 `WidthProvider(Responsive)`
// HOC API + the v1 droppable handshake (droppable-element source class
// + `isDroppable` + `onDrop(layout, item, e)`). The v2 modern API uses
// a different drop protocol that didn't catch drops in our setup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _RGL_RAW = require('react-grid-layout/legacy');
const RGL = _RGL_RAW.WidthProvider ? _RGL_RAW : (_RGL_RAW.default ?? _RGL_RAW);
const ResponsiveGridLayout = RGL.WidthProvider(RGL.Responsive);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}
type Layout = LayoutItem;

import { apiClient } from '../../../../../lib/api-client';
import { useMe } from '../../../../../lib/api/auth';
import { useEquipmentList } from '../../../../../lib/api/equipment';

const { Title, Text } = Typography;

// ── Types (wire-compatible with legacy slot_data) ─────────────────────────

interface WidgetRow {
  id: number;
  boardId: number;
  title: string;
  imgPath: string;
  settings: string;
  createdAt: string;
}

type SlotType = 'unit_list' | 'text-editor';

interface SlotMeta {
  /** Unique grid-layout key — `slot-<n>`. */
  i: string;
  w_id: number;
  slot_type?: SlotType;
  slot_data?: string;
  title_hide?: boolean;
  title_custom?: string;
}

interface BoardRow {
  id: number;
  name: string;
  slotData: string | null;
  totalSlots: number;
}

// Sentinel w_ids for the two special sidebar items.
const W_UNIT_LIST = -1;
const W_TEXT_EDITOR = -2;

// Grid config — 12 cols (legacy was Bootstrap 12-col).
const COLS = { lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 };
const ROW_HEIGHT = 30;
const DEFAULT_W = 4;   // 4/12 = 33% — legacy default slot_w
const DEFAULT_H = 10;  // 10 * 30px = 300px ≈ legacy default 320px
const MIN_W = 3;
const MIN_H = 4;

export default function DashboardCreatorPage() {
  const search = useSearchParams();
  const editId = search.get('id') ? Number(search.get('id')) : null;
  const router = useRouter();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [name, setName] = useState('');
  const [layout, setLayout] = useState<Layout[]>([]);
  /** Per-slot metadata keyed by Layout.i. */
  const [slotMetaById, setSlotMetaById] = useState<Map<string, SlotMeta>>(new Map());
  const [editingTitleFor, setEditingTitleFor] = useState<string | null>(null);
  const [editingUnitsFor, setEditingUnitsFor] = useState<string | null>(null);
  const [editingTextFor, setEditingTextFor] = useState<string | null>(null);
  // Tracks the most recent sidebar item to be dragged, so onDrop can
  // attribute the new layout item to the right widget. react-grid-layout
  // gives us the layoutItem + e.dataTransfer but not the widget id
  // (HTML5 drag wraps the source element).
  const draggingRef = useRef<{ w_id: number } | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────
  const widgetsQ = useQuery({
    queryKey: ['admin-board-widgets'],
    queryFn: async () => (await apiClient.get<WidgetRow[]>('/admin/boards/widgets')).data,
  });
  const boardQ = useQuery({
    queryKey: ['admin-board', editId],
    queryFn: async () => (await apiClient.get<BoardRow>(`/admin/boards/${editId}`)).data,
    enabled: editId !== null,
  });

  // Hydrate state from an existing dashboard.
  useEffect(() => {
    if (!boardQ.data) return;
    setName(boardQ.data.name);
    try {
      const parsed = boardQ.data.slotData ? JSON.parse(boardQ.data.slotData) : [];
      if (!Array.isArray(parsed)) return;
      const layoutNext: Layout[] = [];
      const metaNext = new Map<string, SlotMeta>();
      parsed.forEach((s: Record<string, unknown>, idx: number) => {
        const i = `slot-${idx}`;
        const slot_w = Number(s.slot_w ?? 33.3);
        const slot_h = Number(s.slot_h ?? 320);
        const w = Math.max(MIN_W, Math.round((slot_w / 100) * 12));
        const h = Math.max(MIN_H, Math.round(slot_h / ROW_HEIGHT));
        layoutNext.push({ i, x: (idx * w) % 12, y: Math.floor(idx / 3) * h, w, h, minW: MIN_W, minH: MIN_H });
        metaNext.set(i, {
          i,
          w_id: Number(s.w_id ?? s.widgetId ?? 0),
          slot_type: s.slot_type === 'unit_list' || s.slot_type === 'text-editor' ? s.slot_type as SlotType : undefined,
          slot_data: typeof s.slot_data === 'string' ? s.slot_data : undefined,
          title_hide: typeof s.title_hide === 'boolean' ? s.title_hide : (s.showTitle === false),
          title_custom: typeof s.title_custom === 'string' ? s.title_custom : (typeof s.title === 'string' ? s.title : undefined),
        });
      });
      setLayout(layoutNext);
      setSlotMetaById(metaNext);
    } catch { /* ignore parse error — fresh empty canvas */ }
  }, [boardQ.data]);

  const widgetById = useMemo(() => {
    const m = new Map<number, WidgetRow>();
    for (const w of widgetsQ.data ?? []) m.set(w.id, w);
    return m;
  }, [widgetsQ.data]);

  // ── Drop from sidebar onto the canvas ──────────────────────────────────
  // react-grid-layout fires `onDrop(layout, layoutItem, _event)` when an
  // HTML5-draggable element with class `droppable-element` lands on the
  // grid. We use draggingRef to know which sidebar item produced the drop.

  // Stable reference returned every render so RGL's effect doesn't
  // keep treating it as a "changed dependency".
  const onDropDragOver = useCallback(() => ({ w: DEFAULT_W, h: DEFAULT_H }), []);

  const onDrop = useCallback((newLayout: Layout[], layoutItem: Layout | undefined) => {
    // eslint-disable-next-line no-console
    console.log('[creator] onDrop fired — dragged=', draggingRef.current, 'layoutItem=', layoutItem);
    const dragged = draggingRef.current;
    draggingRef.current = null;
    if (!dragged || !layoutItem) {
      // eslint-disable-next-line no-console
      console.warn('[creator] onDrop early-return — dragged or layoutItem missing');
      return;
    }
    const i = `slot-${Date.now()}`;
    const dropped: Layout = { ...layoutItem, i, w: DEFAULT_W, h: DEFAULT_H, minW: MIN_W, minH: MIN_H };
    setLayout([...newLayout.filter((l) => l.i !== layoutItem.i), dropped]);
    const slot_type: SlotType | undefined =
      dragged.w_id === W_UNIT_LIST ? 'unit_list'
      : dragged.w_id === W_TEXT_EDITOR ? 'text-editor'
      : undefined;
    setSlotMetaById((curr) => {
      const next = new Map(curr);
      next.set(i, { i, w_id: dragged.w_id, ...(slot_type ? { slot_type } : {}) });
      return next;
    });
  }, []);

  // RGL's internal effects depend on `onLayoutChange` and `onDrop`
  // function identity (lines 741+: `useEffect([..., onLayoutChange, ...])`)
  // — every render of the parent creates new function refs → the effect
  // re-runs → it calls onLayoutChange → we setLayout → re-render → new
  // function refs → loop. `useCallback` keeps the references stable so
  // the effect only fires when its real layout deps actually change.
  // Plus a deep-equal guard inside setLayout for belt-and-braces.
  const onLayoutChange = useCallback((next: Layout[]) => {
    setLayout((curr) => {
      if (curr.length !== next.length) return next;
      for (let i = 0; i < curr.length; i++) {
        const ai = curr[i]; const bi = next[i];
        if (ai.i !== bi.i || ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h) return next;
      }
      return curr;
    });
  }, []);

  function removeSlot(i: string) {
    setLayout((curr) => curr.filter((l) => l.i !== i));
    setSlotMetaById((curr) => { const n = new Map(curr); n.delete(i); return n; });
  }

  function updateMeta(i: string, patch: Partial<SlotMeta>) {
    setSlotMetaById((curr) => {
      const existing = curr.get(i);
      if (!existing) return curr;
      const next = new Map(curr);
      next.set(i, { ...existing, ...patch });
      return next;
    });
  }

  // ── Save — serialize layout + meta into legacy slot_data shape ─────────

  const saveMut = useMutation({
    mutationFn: async () => {
      // Sort by visual order: row then column.
      const sorted = [...layout].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const slots = sorted.map((l, idx) => {
        const meta = slotMetaById.get(l.i);
        return {
          slot_id: idx,
          w_id: meta?.w_id ?? 0,
          slot_w: Math.round((l.w / 12) * 1000) / 10,
          slot_h: l.h * ROW_HEIGHT,
          title_hide: meta?.title_hide ?? false,
          title_custom: meta?.title_custom,
          slot_type: meta?.slot_type,
          slot_data: meta?.slot_data,
        };
      });
      const payload = { name, slotData: slots, totalSlots: slots.length };
      if (editId) {
        const { data } = await apiClient.patch<BoardRow>(`/admin/boards/${editId}`, payload);
        return data;
      }
      const { data } = await apiClient.post<BoardRow>('/admin/boards', payload);
      return data;
    },
    onSuccess: () => {
      message.success(editId ? 'Dashboard updated' : 'Dashboard created');
      qc.invalidateQueries({ queryKey: ['admin-boards'] });
      router.push('/admin/boards');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Save failed';
      message.error(msg);
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────

  // Stable layouts reference per `layout` change — without useMemo the
  // object is recreated each render and RGL re-syncs every time.
  const layoutsMap = useMemo(
    () => ({ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }),
    [layout],
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Space size="middle">
          <Link href="/admin/boards" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
            <ArrowLeftOutlined />
          </Link>
          <Title level={3} style={{ margin: 0 }}>{editId ? 'Edit dashboard' : 'Dashboard Creator'}</Title>
        </Space>
        <Space>
          <Input
            placeholder="Dashboard Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 280 }}
          />
          <Button
            type="primary"
            onClick={() => {
              if (!name.trim()) { message.warning('Pick a dashboard name first'); return; }
              if (layout.length === 0) { message.warning('Drop at least one widget into the canvas'); return; }
              saveMut.mutate();
            }}
            loading={saveMut.isPending}
          >Save</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* ── Left rail (legacy `.dashboard_widgets`, bg #d7ddde) ──────── */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            background: '#d7ddde',
            borderRadius: 6,
            padding: 12,
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>Dashboard Widgets</Text>
            <Link href="/admin/boards/graph-widgets">
              <Button size="small" icon={<PlusOutlined />} type="link">New</Button>
            </Link>
          </div>

          <SidebarCard
            w_id={W_UNIT_LIST}
            label="Unit List"
            icon={<UnorderedListOutlined style={{ fontSize: 20 }} />}
            onDragStart={() => { draggingRef.current = { w_id: W_UNIT_LIST }; }}
          />
          <SidebarCard
            w_id={W_TEXT_EDITOR}
            label="Text Editor"
            icon={<FileTextOutlined style={{ fontSize: 20 }} />}
            onDragStart={() => { draggingRef.current = { w_id: W_TEXT_EDITOR }; }}
          />
          <div style={{ borderTop: '1px dashed #b5b5b5', margin: '8px 0' }} />

          {widgetsQ.isLoading ? <Skeleton active /> :
            (widgetsQ.data ?? []).length === 0 ? (
              <Empty description="No widgets yet">
                <Link href="/admin/boards/graph-widgets"><Button size="small" type="primary">Open Graph Widgets</Button></Link>
              </Empty>
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {(widgetsQ.data ?? []).map((w) => (
                  <SidebarCard
                    key={w.id}
                    w_id={w.id}
                    label={w.title}
                    imgPath={w.imgPath}
                    onDragStart={() => { draggingRef.current = { w_id: w.id }; }}
                  />
                ))}
              </Space>
            )
          }
        </div>

        {/* ── Canvas (legacy `#dashboard_creator` with grid-texture bg) ── */}
        <Card
          title="Dashboard"
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          styles={{
            body: {
              padding: 8,
              minHeight: 600,
              background: '#f5f5f5',
              backgroundImage:
                'linear-gradient(rgba(180,180,180,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(180,180,180,0.18) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            },
          }}
        >
          <ResponsiveGridLayout
            className="layout"
            // CRITICAL: the GridLayout's `<div>` gets `style.height =
            // containerHeight` where containerHeight comes from the
            // tallest item. When the layout is empty the height
            // collapses to 0, the drag-over HTML5 events never fire
            // (because there's no hittable area), and `onDrop` never
            // runs. `minHeight` keeps a draggable target visible even
            // when no slots are placed yet.
            style={{ minHeight: 560 }}
            layouts={layoutsMap}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            isDroppable
            onDrop={onDrop}
            // Even the v1-compat `legacy` entry wraps v2's hooks-based
            // GridLayout internally — that GridLayout REQUIRES
            // onDropDragOver to provide the placeholder size, otherwise
            // the drop never registers. Returning `{w, h}` is the
            // documented signature.
            onDropDragOver={onDropDragOver}
            onLayoutChange={onLayoutChange}
            draggableHandle=".slot-drag-handle"
            margin={[10, 10]}
            compactType={null}
            preventCollision={false}
            resizeHandles={['s', 'e', 'w', 'n', 'se']}
            droppingItem={{ i: '__dropping', w: DEFAULT_W, h: DEFAULT_H }}
          >
            {layout.map((item) => {
              const meta = slotMetaById.get(item.i);
              if (!meta) return null;
              const widget = !meta.slot_type ? widgetById.get(meta.w_id) ?? null : null;
              const titleText = meta.title_custom
                || widget?.title
                || (meta.slot_type === 'unit_list' ? 'Unit List' : meta.slot_type === 'text-editor' ? 'Text' : '');
              return (
                <div key={item.i} data-grid={item}>
                  <SlotTile
                    meta={meta}
                    widget={widget}
                    titleText={titleText}
                    onEditTitle={() => setEditingTitleFor(item.i)}
                    onEditUnits={() => setEditingUnitsFor(item.i)}
                    onEditText={() => setEditingTextFor(item.i)}
                    onRemove={() => removeSlot(item.i)}
                  />
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </Card>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <EditTitleModal
        slotId={editingTitleFor}
        slotMetaById={slotMetaById}
        widgetById={widgetById}
        onClose={() => setEditingTitleFor(null)}
        onSave={(i, patch) => { updateMeta(i, patch); setEditingTitleFor(null); }}
      />
      <UnitListModal
        slotId={editingUnitsFor}
        slotMetaById={slotMetaById}
        tenantId={me?.activeTenantId ?? null}
        onClose={() => setEditingUnitsFor(null)}
        onSave={(i, slot_data) => { updateMeta(i, { slot_data }); setEditingUnitsFor(null); }}
      />
      <TextEditorModal
        slotId={editingTextFor}
        slotMetaById={slotMetaById}
        onClose={() => setEditingTextFor(null)}
        onSave={(i, slot_data) => { updateMeta(i, { slot_data }); setEditingTextFor(null); }}
      />
    </div>
  );
}

// ─── Sidebar card (HTML5 draggable, react-grid-layout droppable-element) ──

function SidebarCard({
  w_id, label, imgPath, icon, onDragStart,
}: {
  w_id: number; label: string; imgPath?: string; icon?: React.ReactNode;
  onDragStart: () => void;
}) {
  return (
    <div
      className="droppable-element"
      draggable={true}
      onDragStart={(e) => {
        // react-grid-layout v2 listens for the standard HTML5 onDragOver
        // on its grid container; the source element just needs to fire
        // a real dragstart (which requires `draggable=true` + `setData()`).
        e.dataTransfer.setData('text/plain', String(w_id));
        e.dataTransfer.effectAllowed = 'copy';
        // eslint-disable-next-line no-console
        console.log('[creator] dragstart w_id=', w_id);
        onDragStart();
      }}
      onDragEnd={() => {
        // eslint-disable-next-line no-console
        console.log('[creator] dragend');
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 4,
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {imgPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgPath}
          alt=""
          width={36}
          height={36}
          style={{ objectFit: 'contain' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
      ) : icon ? (
        <span style={{ color: '#13c2c2', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
      ) : null}
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Slot tile rendered inside the grid ───────────────────────────────────

function SlotTile({
  meta, widget, titleText, onEditTitle, onEditUnits, onEditText, onRemove,
}: {
  meta: SlotMeta;
  widget: WidgetRow | null;
  titleText: string;
  onEditTitle: () => void;
  onEditUnits: () => void;
  onEditText: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        background: '#fff',
        boxShadow: '1px 1px 5px #c1c1c1',     // legacy `.dashboard_slot_item`
        border: '2px solid transparent',
        borderRadius: 6,
        position: 'relative',
        padding: 12,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Drag handle row — react-grid-layout picks up dragging from any
          element with class `slot-drag-handle`. Putting it on the title
          gives the same feel as legacy (title bar = drag affordance). */}
      <div
        className="slot-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 24,
          cursor: 'move',
          paddingBottom: 4,
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 8,
        }}
      >
        {!meta.title_hide ? (
          <Text strong style={{ fontSize: 13, textAlign: 'center' }}>{titleText}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>⋮ drag</Text>
        )}
      </div>

      {/* Top-right action buttons (don't trigger drag) */}
      <Space
        size={2}
        style={{ position: 'absolute', top: 4, right: 4, zIndex: 5 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button size="small" type="text" icon={<EditOutlined />} onClick={onEditTitle} title="Edit title" />
        {meta.slot_type === 'unit_list' ? (
          <Button size="small" type="text" onClick={onEditUnits}>Units</Button>
        ) : null}
        {meta.slot_type === 'text-editor' ? (
          <Button size="small" type="text" onClick={onEditText}>Text</Button>
        ) : null}
        <Button size="small" type="text" icon={<DeleteOutlined />} danger onClick={onRemove} />
      </Space>

      {/* Body */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, overflow: 'hidden' }}>
        {meta.slot_type === 'unit_list' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {meta.slot_data
              ? `${meta.slot_data.split(',').filter(Boolean).length} unit(s) selected`
              : '(no units — click Units)'}
          </Text>
        ) : meta.slot_type === 'text-editor' ? (
          <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap', textAlign: 'center' }}>
            {(() => {
              if (!meta.slot_data) return '(empty — click Text)';
              try { return atob(meta.slot_data).slice(0, 200); } catch { return meta.slot_data.slice(0, 200); }
            })()}
          </Text>
        ) : widget ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={widget.imgPath || '/images/dashboard/chart_bar.png'}
            alt=""
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>(widget id {meta.w_id} not found)</Text>
        )}
      </div>
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────

function EditTitleModal({
  slotId, slotMetaById, widgetById, onClose, onSave,
}: {
  slotId: string | null;
  slotMetaById: Map<string, SlotMeta>;
  widgetById: Map<number, WidgetRow>;
  onClose: () => void;
  onSave: (i: string, patch: Partial<SlotMeta>) => void;
}) {
  const meta = slotId ? slotMetaById.get(slotId) ?? null : null;
  const widget = meta && !meta.slot_type ? widgetById.get(meta.w_id) ?? null : null;
  const [hide, setHide] = useState(false);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (meta) {
      setHide(!!meta.title_hide);
      setCustom(meta.title_custom ?? widget?.title ?? '');
    }
  }, [meta, widget]);

  return (
    <Modal title="Edit Widget Title" open={!!slotId} onCancel={onClose}
      onOk={() => slotId && onSave(slotId, { title_hide: hide, title_custom: custom.trim() || undefined })}
      okText="Save"
    >
      <Form layout="vertical">
        <Form.Item>
          <Checkbox checked={!hide} onChange={(e) => setHide(!e.target.checked)}>Show Widget Title</Checkbox>
        </Form.Item>
        <Form.Item label="Enter Widget Title">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)}
            placeholder={widget?.title ?? 'Widget title'} disabled={hide} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function UnitListModal({
  slotId, slotMetaById, tenantId, onClose, onSave,
}: {
  slotId: string | null;
  slotMetaById: Map<string, SlotMeta>;
  tenantId: number | null;
  onClose: () => void;
  onSave: (i: string, slot_data: string) => void;
}) {
  const meta = slotId ? slotMetaById.get(slotId) ?? null : null;
  const [selected, setSelected] = useState<number[]>([]);
  const equipmentQ = useEquipmentList(tenantId);

  useEffect(() => {
    if (meta?.slot_data) {
      setSelected(meta.slot_data.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0));
    } else {
      setSelected([]);
    }
  }, [meta]);

  const options = (equipmentQ.data ?? []).map((eq) => ({ value: eq.id, label: eq.name }));

  return (
    <Modal title="Unit List" open={!!slotId} onCancel={onClose}
      onOk={() => slotId && onSave(slotId, selected.join(','))}
      okText="Save"
    >
      {equipmentQ.isLoading ? <Skeleton active /> : (
        <Checkbox.Group
          value={selected}
          onChange={(vals) => setSelected(vals as number[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}
        >
          {options.length === 0 ? <Empty description="No equipment / units configured" /> : null}
          {options.map((o) => <Checkbox key={o.value} value={o.value}>{o.label}</Checkbox>)}
        </Checkbox.Group>
      )}
    </Modal>
  );
}

function TextEditorModal({
  slotId, slotMetaById, onClose, onSave,
}: {
  slotId: string | null;
  slotMetaById: Map<string, SlotMeta>;
  onClose: () => void;
  onSave: (i: string, slot_data: string) => void;
}) {
  const meta = slotId ? slotMetaById.get(slotId) ?? null : null;
  const [text, setText] = useState('');

  useEffect(() => {
    if (meta?.slot_data) {
      try { setText(atob(meta.slot_data)); } catch { setText(meta.slot_data); }
    } else {
      setText('');
    }
  }, [meta]);

  return (
    <Modal title="Text Editor" open={!!slotId} onCancel={onClose}
      onOk={() => slotId && onSave(slotId, btoa(unescape(encodeURIComponent(text))))}
      okText="Save"
    >
      <Input.TextArea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text — supports basic HTML"
      />
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
        Persisted as base64 HTML — wire-compatible with legacy <code>slot_data</code>.
      </Text>
    </Modal>
  );
}

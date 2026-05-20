'use client';

/**
 * Date Range Strip — faithful React port of the legacy fpanalyzer.se
 * `backend/board/date_range_slider.blade.php` widget.
 *
 * Legacy stack:
 *   - `datepicker.min.js` (vanilla js-datepicker) — calendar popups for
 *     the From/To chips
 *   - jQuery UI `.resizable()` + `.draggable()` — the green overlay handle
 *     with W (west) + E (east) grab edges
 *   - Custom JS state machine with SLIDER_TYPE ∈ DAY|WEEK|MONTH|YEAR and
 *     `shrink()`/`expand()` setTimeout loops that auto-switched zoom when
 *     tiles compressed past MIN_CELL_W (40px) or expanded past MAX_CELL_W
 *     (180px).
 *
 * Behaviours preserved:
 *   1. Horizontal day/week/month/quarter strip with white tiles on light
 *      grey body, teal 15px accent columns, dark grey left panel.
 *   2. Draggable range overlay (`#resizable` in legacy) — drag west edge
 *      to move From, east edge to move To, body to slide the whole range.
 *   3. Zoom out / zoom in: range > 7 tiles → bump SLIDER_TYPE up; < 1 →
 *      bump down. Auto-zoom keeps the range visible.
 *   4. Auto-scroll while dragging near edges (legacy `SLIDER_LOOP`).
 *   5. From/To AntD DatePicker chips replace the legacy datepicker.min.js
 *      popups on click.
 *
 * The component is API-compatible with the previous version
 *   <DateRangeStrip value={{from,to}} onChange={(f,t)=>…} />
 * so all 14 existing call sites pick up the new look unchanged.
 */

import { DatePicker, Select } from 'antd';
import { LeftOutlined, RightOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// ── Date math ──────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayYMD(): string { return toYMD(new Date()); }
function addDays(s: string, n: number): string {
  const d = fromYMD(s); d.setDate(d.getDate() + n); return toYMD(d);
}
function daysBetween(a: string, b: string): number {
  return Math.round((fromYMD(b).getTime() - fromYMD(a).getTime()) / 86400000);
}
function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function firstOfMonth(ref: Date): Date { return new Date(ref.getFullYear(), ref.getMonth(), 1); }
function lastOfMonth(ref: Date): Date { return new Date(ref.getFullYear(), ref.getMonth() + 1, 0); }
function startOfQuarter(ref: Date): Date {
  return new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3, 1);
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Zoom-level config ──────────────────────────────────────────────────────
//
// Mirrors legacy SLIDER_T_DAY|WEEK|MONTH|YEAR (the legacy "YEAR" actually
// renders one tile per quarter; we keep that semantics).

type ZoomType = 'day' | 'week' | 'month' | 'quarter';

interface ZoomCfg {
  /** Days per tile (1 / 7 / ~30 / ~91). Used for px-to-date math. */
  days: number;
  /** Bumps the start date by exactly one tile (so the strip rounds cleanly). */
  next: (d: Date) => Date;
  prev: (d: Date) => Date;
  /** Snaps an arbitrary date down to the start of the tile that contains it. */
  snapStart: (d: Date) => Date;
  /** Renders one tile's content (top label + big middle + bottom). */
  renderTile: (d: Date) => { top: string; middle: string; bottom: string };
}

const ZOOM: Record<ZoomType, ZoomCfg> = {
  day: {
    days: 1,
    next:      (d) => { const x = new Date(d); x.setDate(x.getDate() + 1); return x; },
    prev:      (d) => { const x = new Date(d); x.setDate(x.getDate() - 1); return x; },
    snapStart: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    renderTile: (d) => ({
      top: DAY_NAMES[d.getDay()],
      middle: String(d.getDate()),
      bottom: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    }),
  },
  week: {
    days: 7,
    next:      (d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; },
    prev:      (d) => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; },
    snapStart: (d) => mondayOfWeek(d),
    renderTile: (d) => {
      const sunday = new Date(d); sunday.setDate(d.getDate() + 6);
      return {
        top: `Wk ${weekNumber(d)}`,
        middle: String(d.getDate()),
        bottom: `${MONTH_NAMES[d.getMonth()]}–${MONTH_NAMES[sunday.getMonth()]}`,
      };
    },
  },
  month: {
    days: 30,
    next:      (d) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 1); return x; },
    prev:      (d) => { const x = new Date(d.getFullYear(), d.getMonth() - 1, 1); return x; },
    snapStart: (d) => firstOfMonth(d),
    renderTile: (d) => ({
      top: String(d.getFullYear()),
      middle: MONTH_NAMES[d.getMonth()],
      bottom: '',
    }),
  },
  quarter: {
    days: 91,
    next:      (d) => { const x = new Date(d.getFullYear(), d.getMonth() + 3, 1); return x; },
    prev:      (d) => { const x = new Date(d.getFullYear(), d.getMonth() - 3, 1); return x; },
    snapStart: (d) => startOfQuarter(d),
    renderTile: (d) => ({
      top: String(d.getFullYear()),
      middle: `Q${Math.floor(d.getMonth() / 3) + 1}`,
      bottom: '',
    }),
  },
};

function weekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

function pickZoomForSpan(spanDays: number): ZoomType {
  if (spanDays <= 7) return 'day';
  if (spanDays <= 49) return 'week';
  if (spanDays <= 365) return 'month';
  return 'quarter';
}

// ── Preset options (legacy list) ───────────────────────────────────────────

const RANGE_OPTIONS = [
  { value: 'today',           label: 'Today' },
  { value: 'yesterday',       label: 'Yesterday' },
  { value: 'this_week',       label: 'This Week' },
  { value: 'previous_week',   label: 'Previous Week' },
  { value: 'this_month',      label: 'This Month' },
  { value: 'previous_month',  label: 'Previous Month' },
  { value: 'this_year',       label: 'This Year' },
  { value: 'previous_year',   label: 'Previous Year' },
  { value: 'custom',          label: 'Custom' },
];

function computeRange(p: string): { from: string; to: string } | null {
  const now = new Date();
  switch (p) {
    case 'today': return { from: todayYMD(), to: todayYMD() };
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: toYMD(y), to: toYMD(y) }; }
    case 'this_week': { const mon = mondayOfWeek(now); const sun = new Date(mon); sun.setDate(sun.getDate() + 6); return { from: toYMD(mon), to: toYMD(sun) }; }
    case 'previous_week': { const mon = mondayOfWeek(now); mon.setDate(mon.getDate() - 7); const sun = new Date(mon); sun.setDate(sun.getDate() + 6); return { from: toYMD(mon), to: toYMD(sun) }; }
    case 'this_month': return { from: toYMD(firstOfMonth(now)), to: toYMD(lastOfMonth(now)) };
    case 'previous_month': { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const l = new Date(now.getFullYear(), now.getMonth(), 0); return { from: toYMD(f), to: toYMD(l) }; }
    case 'this_year': return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    case 'previous_year': { const y = now.getFullYear() - 1; return { from: `${y}-01-01`, to: `${y}-12-31` }; }
    default: return null;
  }
}

// ── Palette (legacy CSS) ───────────────────────────────────────────────────

const C = {
  panelBg: '#525151',
  panelText: '#a7a7a7',
  teal: '#018198',
  body: '#cacaca',
  tileBg: '#ffffff',
  tileText: '#000000',
  tileDayName: '#b9b9b9',
  tileBottom: '#efefef',
  tileSep: '#dad7d7',
  red: '#d63030',
  // Drag overlay (#resizable in legacy)
  overlayBg: 'rgba(72, 71, 71, 0.55)',
  overlayHandle: '#484747',
  pillBg: '#383838',
  pillBorder: '#656565',
  pillText: '#bbbaba',
};

// ── Props ──────────────────────────────────────────────────────────────────

export interface DateRangeStripProps {
  label?: string;
  value: { from: string; to: string };
  onChange: (from: string, to: string) => void;
  /** Number of tiles visible at any given moment (default 7). */
  tileCount?: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DateRangeStrip({
  label = 'Date Range',
  value,
  onChange,
  tileCount = 7,
}: DateRangeStripProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const [preset, setPreset] = useState<string>(() => (value.from === value.to ? 'today' : 'custom'));
  // The middle tile's start date — drives the strip's window.
  const [centerStart, setCenterStart] = useState<Date>(() => fromYMD(value.from || todayYMD()));
  // Auto-zoom based on the current range span (always reactive to value).
  const zoomType: ZoomType = useMemo(() => {
    const span = Math.abs(daysBetween(value.from, value.to));
    return pickZoomForSpan(span);
  }, [value.from, value.to]);
  const cfg = ZOOM[zoomType];

  // Re-snap centerStart whenever zoomType changes — keeps the centre tile
  // aligned to the natural tile boundary (Monday for week, 1st for month).
  useEffect(() => {
    setCenterStart((d) => cfg.snapStart(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomType]);

  // When the parent gives us a new `from`, recentre the strip on it.
  useEffect(() => {
    if (value.from) {
      const d = fromYMD(value.from);
      setCenterStart((curr) => {
        const target = cfg.snapStart(d);
        // Only update if the user-visible centre would actually change —
        // avoids a render thrash when the drag handler emits onChange.
        return curr.getTime() === target.getTime() ? curr : target;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.from]);

  // Measure body width for px↔date math.
  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    const ro = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    ro.observe(el);
    setBodyWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const tileW = bodyWidth > 0 ? bodyWidth / tileCount : 0;

  // Compute the array of tile start-dates centred on `centerStart`.
  const tiles = useMemo(() => {
    const half = Math.floor(tileCount / 2);
    const arr: Date[] = [];
    let cursor = centerStart;
    for (let i = 0; i < half; i++) cursor = cfg.prev(cursor);
    for (let i = 0; i < tileCount; i++) {
      arr.push(cursor);
      cursor = cfg.next(cursor);
    }
    return arr;
  }, [centerStart, tileCount, cfg]);

  // First tile's start-date — anchors the px→date math.
  const tile0 = tiles[0] ?? centerStart;

  // Translate a date → pixel x within the body.
  const dateToX = useCallback(
    (d: string): number => {
      if (!tileW) return 0;
      const days = daysBetween(toYMD(tile0), d);
      return (days / cfg.days) * tileW;
    },
    [tile0, tileW, cfg.days],
  );
  // Translate a pixel x → YYYY-MM-DD (clamped to whole days).
  const xToDate = useCallback(
    (x: number): string => {
      if (!tileW) return toYMD(tile0);
      const days = Math.round((x / tileW) * cfg.days);
      return addDays(toYMD(tile0), days);
    },
    [tile0, tileW, cfg.days],
  );

  // Range overlay px geometry.
  const overlayLeft  = dateToX(value.from);
  const overlayRight = dateToX(value.to) + (zoomType === 'day' ? tileW : tileW); // include the trailing tile
  const overlayWidth = Math.max(tileW, overlayRight - overlayLeft);

  // ── Drag/resize handlers ────────────────────────────────────────────────

  type DragKind = 'w' | 'e' | 'move';
  const dragState = useRef<{
    kind: DragKind;
    startX: number;
    startFrom: string;
    startTo: string;
  } | null>(null);

  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAutoScroll() {
    if (autoScrollTimer.current) { clearInterval(autoScrollTimer.current); autoScrollTimer.current = null; }
  }

  function startAutoScroll(direction: 'left' | 'right') {
    stopAutoScroll();
    autoScrollTimer.current = setInterval(() => {
      setCenterStart((d) => direction === 'left' ? cfg.prev(d) : cfg.next(d));
    }, 120);
  }

  function onPointerDown(kind: DragKind) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        kind,
        startX: e.clientX,
        startFrom: value.from,
        startTo: value.to,
      };
      setPreset('custom');
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const st = dragState.current;
    if (!st || !bodyRef.current || !tileW) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const dx = e.clientX - st.startX;
    const dayDelta = Math.round((dx / tileW) * cfg.days);

    // Auto-scroll if pointer is near a side
    const EDGE = 24;
    if (localX < EDGE) startAutoScroll('left');
    else if (localX > rect.width - EDGE) startAutoScroll('right');
    else stopAutoScroll();

    if (st.kind === 'w') {
      const newFrom = addDays(st.startFrom, dayDelta);
      const clamped = newFrom <= value.to ? newFrom : value.to;
      if (clamped !== value.from) onChange(clamped, value.to);
    } else if (st.kind === 'e') {
      const newTo = addDays(st.startTo, dayDelta);
      const clamped = newTo >= value.from ? newTo : value.from;
      if (clamped !== value.to) onChange(value.from, clamped);
    } else {
      // body drag — shift both endpoints by the same delta
      const newFrom = addDays(st.startFrom, dayDelta);
      const newTo   = addDays(st.startTo,   dayDelta);
      if (newFrom !== value.from || newTo !== value.to) onChange(newFrom, newTo);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    stopAutoScroll();
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    dragState.current = null;
  }

  // ── Plain tile click (single-day mode) ───────────────────────────────────

  function handleTileClick(d: Date, shiftKey: boolean) {
    const dateStr = toYMD(d);
    if (zoomType !== 'day') {
      // Non-day zooms: clicking a tile selects the whole unit.
      const nextStart = cfg.next(d);
      const tileEnd = toYMD(new Date(nextStart.getTime() - 86400000));
      onChange(dateStr, tileEnd);
      setPreset('custom');
      return;
    }
    if (shiftKey && value.from) {
      const from = dateStr < value.from ? dateStr : value.from;
      const to   = dateStr < value.from ? value.from : dateStr;
      onChange(from, to);
      setPreset('custom');
      return;
    }
    onChange(dateStr, dateStr);
    setPreset('custom');
  }

  // ── Nav arrows + preset + DatePicker chips ───────────────────────────────

  const handlePrev = () => setCenterStart((d) => cfg.prev(d));
  const handleNext = () => setCenterStart((d) => cfg.next(d));

  function handlePresetChange(p: string) {
    setPreset(p);
    if (p === 'custom') return;
    const r = computeRange(p);
    if (!r) return;
    setCenterStart(cfg.snapStart(fromYMD(r.from)));
    onChange(r.from, r.to);
  }

  function handleFromPick(d: Dayjs | null) {
    if (!d) return;
    const s = d.format('YYYY-MM-DD');
    const newTo = s > value.to ? s : value.to;
    onChange(s, newTo);
    setCenterStart(cfg.snapStart(fromYMD(s)));
    setPreset('custom');
  }
  function handleToPick(d: Dayjs | null) {
    if (!d) return;
    const s = d.format('YYYY-MM-DD');
    const newFrom = s < value.from ? s : value.from;
    onChange(newFrom, s);
    setPreset('custom');
  }

  function handleClearFilter() {
    const t = todayYMD();
    setCenterStart(cfg.snapStart(fromYMD(t)));
    onChange(t, t);
    setPreset('today');
  }

  const today = todayYMD();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        height: 110,
        width: '100%',
        paddingLeft: 145,
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Left panel (date-manual) */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 145, height: '100%',
          background: C.panelBg, padding: '10px 8px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}
      >
        <h4 style={{ fontSize: 12, color: C.panelText, margin: 0, fontWeight: 400 }}>{label}</h4>
        <Select
          value={preset}
          onChange={handlePresetChange}
          options={RANGE_OPTIONS}
          size="small"
          style={{ width: '100%' }}
          popupMatchSelectWidth={false}
          aria-label={label}
        />
        <span style={{ color: C.panelText, fontSize: 10 }}>
          Zoom: <strong>{zoomType}</strong>
        </span>
        <button
          type="button" onClick={handleClearFilter}
          title="Clear filter" aria-label="Clear filter"
          style={{
            background: 'transparent', border: 'none', color: C.panelText,
            cursor: 'pointer', fontSize: 16, alignSelf: 'flex-end',
            padding: 0, marginTop: 'auto',
          }}
        >
          <FilterOutlined />
        </button>
      </div>

      {/* Slider body */}
      <div
        ref={bodyRef}
        style={{
          width: '100%', height: '100%',
          background: C.body,
          borderLeft: `15px solid ${C.teal}`,
          borderRight: `15px solid ${C.teal}`,
          boxSizing: 'border-box',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Nav arrows on the teal accent columns */}
        <button
          type="button" onClick={handlePrev} aria-label="Previous"
          style={navBtnStyle('left')}
        ><LeftOutlined style={{ fontSize: 10 }} /></button>
        <button
          type="button" onClick={handleNext} aria-label="Next"
          style={navBtnStyle('right')}
        ><RightOutlined style={{ fontSize: 10 }} /></button>

        {/* Day tiles row */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
          }}
        >
          {tiles.map((d, idx) => {
            const dow = d.getDay();
            const isSunday = zoomType === 'day' && dow === 0;
            const isToday = zoomType === 'day' && toYMD(d) === today;
            const isLast = idx === tiles.length - 1;
            const r = cfg.renderTile(d);
            return (
              <button
                key={`${zoomType}-${toYMD(d)}`}
                type="button"
                onClick={(e) => handleTileClick(d, e.shiftKey)}
                style={{
                  flex: 1, minWidth: 40, position: 'relative',
                  background: C.tileBg,
                  border: 'none',
                  borderRight: isLast ? 'none' : `1px solid ${C.tileSep}`,
                  borderBottom: `3px solid ${isSunday ? C.red : C.tileBottom}`,
                  color: isSunday ? C.red : C.tileText,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '6px 4px',
                  outline: isToday ? `1px dashed ${C.red}` : undefined,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'flex-start', gap: 2,
                }}
              >
                <span style={{ fontSize: 11, color: isSunday ? C.red : C.tileDayName }}>{r.top}</span>
                <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 500 }}>{r.middle}</span>
                <span style={{ fontSize: 10, color: '#666' }}>{r.bottom}</span>
              </button>
            );
          })}
        </div>

        {/* Draggable range overlay — legacy #resizable */}
        {tileW > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: 8, bottom: 8,
              left: overlayLeft,
              width: overlayWidth,
              background: C.overlayBg,
              border: `2px solid ${C.overlayHandle}`,
              borderRadius: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'move',
              touchAction: 'none',
              zIndex: 50,
            }}
            onPointerDown={onPointerDown('move')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* West handle */}
            <div
              style={{
                position: 'absolute', left: -2, top: 0, bottom: 0, width: 14,
                background: C.overlayHandle, borderRadius: '6px 0 0 6px',
                cursor: 'col-resize', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
                fontSize: 10, touchAction: 'none',
              }}
              onPointerDown={onPointerDown('w')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >◀</div>
            {/* East handle */}
            <div
              style={{
                position: 'absolute', right: -2, top: 0, bottom: 0, width: 14,
                background: C.overlayHandle, borderRadius: '0 6px 6px 0',
                cursor: 'col-resize', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
                fontSize: 10, touchAction: 'none',
              }}
              onPointerDown={onPointerDown('e')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >▶</div>

            {/* From / To pill chips at the bottom corners */}
            <div style={{ position: 'absolute', left: 18, bottom: -2, zIndex: 90 }}>
              <DatePicker
                value={dayjs(value.from)} onChange={handleFromPick}
                allowClear={false} size="small" format="YYYY-MM-DD"
                suffixIcon={null}
                style={{ width: 100, background: C.pillBg, color: C.pillText, borderRadius: 10, fontSize: 10 }}
                variant="filled"
              />
            </div>
            <div style={{ position: 'absolute', right: 18, bottom: -2, zIndex: 90 }}>
              <DatePicker
                value={dayjs(value.to)} onChange={handleToPick}
                allowClear={false} size="small" format="YYYY-MM-DD"
                suffixIcon={null}
                style={{ width: 100, background: C.pillBg, color: C.pillText, borderRadius: 10, fontSize: 10 }}
                variant="filled"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: -15,
    top: 0, width: 15, height: '100%',
    background: C.teal, border: 'none', color: '#fff',
    cursor: 'pointer', zIndex: 100, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

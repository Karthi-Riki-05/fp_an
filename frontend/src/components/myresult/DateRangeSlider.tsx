'use client';

import { DatePicker, Select, Typography } from 'antd';
import { CaretLeftOutlined, CaretRightOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMyResultStore } from '../../lib/store/myresultStore';

/**
 * Date-range slider — ported from FP Analyzer `date_range_slider.blade.php`.
 *
 *  - Preset Select  (All / Today / Yesterday / This week / Previous week / …)
 *  - Two AntD DatePickers (from / to)
 *  - Horizontal SVG scrubber with Day/Week/Month/Year zoom modes derived
 *    from the visible range size.
 *  - Active selection is highlighted; left/right chevrons step by one cell.
 *
 * Min visible date is 2017-01-01; max is today; range capped at 365 days.
 */

const { Text } = Typography;

const MIN_DATE = dayjs('2017-01-01');

type Preset = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'prevWeek'
  | 'thisMonth' | 'prevMonth' | 'thisQuarter' | 'prevQuarter'
  | 'thisYear' | 'prevYear' | 'custom';

const PRESET_OPTIONS: { value: Preset; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'today',       label: 'Today' },
  { value: 'yesterday',   label: 'Yesterday' },
  { value: 'thisWeek',    label: 'This Week' },
  { value: 'prevWeek',    label: 'Previous Week' },
  { value: 'thisMonth',   label: 'This Month' },
  { value: 'prevMonth',   label: 'Previous Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'prevQuarter', label: 'Previous Quarter' },
  { value: 'thisYear',    label: 'This Year' },
  { value: 'prevYear',    label: 'Previous Year' },
  { value: 'custom',      label: 'Custom' },
];

function rangeForPreset(p: Preset): { start: Dayjs | null; end: Dayjs | null } {
  const today = dayjs().startOf('day');
  switch (p) {
    case 'all':         return { start: MIN_DATE,  end: today };
    case 'today':       return { start: today,     end: today };
    case 'yesterday': { const y = today.subtract(1, 'day'); return { start: y, end: y }; }
    case 'thisWeek':    return { start: today.startOf('week'),  end: today.endOf('week') };
    case 'prevWeek':    return { start: today.subtract(1, 'week').startOf('week'), end: today.subtract(1, 'week').endOf('week') };
    case 'thisMonth':   return { start: today.startOf('month'), end: today.endOf('month') };
    case 'prevMonth':   return { start: today.subtract(1, 'month').startOf('month'), end: today.subtract(1, 'month').endOf('month') };
    case 'thisQuarter': {
      const qStart = today.month(Math.floor(today.month() / 3) * 3).startOf('month');
      const qEnd   = qStart.add(3, 'month').subtract(1, 'day').endOf('day');
      return { start: qStart, end: qEnd };
    }
    case 'prevQuarter': {
      const qStart = today.month(Math.floor(today.month() / 3) * 3).startOf('month').subtract(3, 'month');
      const qEnd   = qStart.add(3, 'month').subtract(1, 'day').endOf('day');
      return { start: qStart, end: qEnd };
    }
    case 'thisYear':    return { start: today.startOf('year'), end: today.endOf('year') };
    case 'prevYear':    return { start: today.subtract(1, 'year').startOf('year'), end: today.subtract(1, 'year').endOf('year') };
    case 'custom':
    default: return { start: null, end: null };
  }
}

type Zoom = 'day' | 'week' | 'month' | 'year';

function pickZoom(start: Dayjs | null, end: Dayjs | null): Zoom {
  if (!start || !end) return 'day';
  const days = end.diff(start, 'day');
  if (days <= 7) return 'day';
  if (days <= 42) return 'week';
  if (days <= 366) return 'month';
  return 'year';
}

function cellsFor(zoom: Zoom, center: Dayjs): { start: Dayjs; end: Dayjs; label: string; sub: string }[] {
  const out: { start: Dayjs; end: Dayjs; label: string; sub: string }[] = [];
  const N = 5;            // 5 cells visible at a time
  for (let i = -2; i <= 2; i++) {
    let s: Dayjs;
    let e: Dayjs;
    let label = '';
    let sub = '';
    if (zoom === 'day') {
      s = center.add(i, 'day').startOf('day');
      e = s.endOf('day');
      label = s.format('dddd');
      sub = s.format('D');
    } else if (zoom === 'week') {
      s = center.add(i, 'week').startOf('week');
      e = s.endOf('week');
      label = `W${Math.ceil((s.diff(s.startOf('year'), 'day') + 1) / 7)}`;
      sub = `${s.format('MMM D')} – ${e.format('MMM D')}`;
    } else if (zoom === 'month') {
      s = center.add(i, 'month').startOf('month');
      e = s.endOf('month');
      label = s.format('MMMM');
      sub = s.format('YYYY');
    } else {
      s = center.add(i, 'year').startOf('year');
      e = s.endOf('year');
      label = s.format('YYYY');
      sub = '';
    }
    out.push({ start: s, end: e, label, sub });
  }
  return out;
}

export function DateRangeSlider() {
  const { range, setRange } = useMyResultStore();
  const [preset, setPreset] = useState<Preset>((range.preset as Preset) || 'all');
  const startDay = range.startDate ? dayjs(range.startDate) : null;
  const endDay   = range.endDate   ? dayjs(range.endDate)   : null;

  const [center, setCenter] = useState<Dayjs>(() => endDay || dayjs());
  useEffect(() => { if (endDay) setCenter(endDay); }, [range.endDate]);

  const zoom: Zoom = useMemo(() => pickZoom(startDay, endDay), [range.startDate, range.endDate]);
  const cells = useMemo(() => cellsFor(zoom, center), [zoom, center]);

  function commit(start: Dayjs | null, end: Dayjs | null, presetVal: Preset) {
    setPreset(presetVal);
    setRange({
      startDate: start ? start.format('YYYY-MM-DD') : null,
      endDate:   end   ? end.format('YYYY-MM-DD')   : null,
      preset: presetVal,
    });
  }

  function pickPreset(p: Preset) {
    const r = rangeForPreset(p);
    commit(r.start, r.end, p);
  }

  function stepCenter(dir: -1 | 1) {
    const unit: 'day' | 'week' | 'month' | 'year' = zoom;
    setCenter(center.add(dir, unit));
  }

  function pickCell(idx: number) {
    const c = cells[idx];
    if (!c) return;
    commit(c.start, c.end, 'custom');
  }

  function isCellActive(idx: number): boolean {
    const c = cells[idx];
    if (!c || !startDay || !endDay) return false;
    return c.start.isSame(startDay, 'day') && c.end.isSame(endDay, 'day');
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 32px',
      alignItems: 'center',
      gap: 8,
      background: '#fff',
      border: '1px solid #e8e8e8',
      borderRadius: 4,
      padding: 8,
    }}>
      {/* Preset + from/to */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Date Range</Text>
        <Select<Preset>
          value={preset}
          onChange={pickPreset}
          options={PRESET_OPTIONS}
          size="small"
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <DatePicker
            size="small"
            value={startDay}
            allowClear={false}
            disabledDate={(d) => d.isBefore(MIN_DATE) || d.isAfter(dayjs())}
            onChange={(v) => {
              if (!v) return;
              const end = endDay && endDay.isAfter(v) && endDay.diff(v, 'day') <= 365 ? endDay : v;
              commit(v, end, 'custom');
            }}
          />
          <DatePicker
            size="small"
            value={endDay}
            allowClear={false}
            disabledDate={(d) =>
              d.isAfter(dayjs()) || (startDay ? d.isBefore(startDay) || d.diff(startDay, 'day') > 365 : false)
            }
            onChange={(v) => {
              if (!v) return;
              commit(startDay, v, 'custom');
            }}
          />
        </div>
      </div>

      {/* Cells */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => stepCenter(-1)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#00768e', fontSize: 20 }}
          aria-label="prev"
        ><CaretLeftOutlined /></button>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {cells.map((c, i) => {
            const active = isCellActive(i);
            return (
              <button
                key={i}
                onClick={() => pickCell(i)}
                style={{
                  background: active ? '#003e4e' : '#f0f0f0',
                  color: active ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{c.sub}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => stepCenter(1)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#00768e', fontSize: 20 }}
          aria-label="next"
        ><CaretRightOutlined /></button>
      </div>

      <div />
    </div>
  );
}

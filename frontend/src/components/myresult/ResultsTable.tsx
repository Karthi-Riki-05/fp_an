'use client';

import {
  Button, Checkbox, Input, Select, Space, Table, Tooltip, Typography,
} from 'antd';
import type { ColumnType, TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';
import {
  EyeInvisibleOutlined, EyeOutlined,
  CompressOutlined, ExpandOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { FilterOperatorPopover, FILTER_OPS } from './FilterOperatorPopover';
import {
  SUMMARY_LABELS, type ListResponse, type SummaryType, useSummary,
  type ColumnFilter, type MyResultTab,
} from '../../lib/api/myresult';
import { useMyResultStore } from '../../lib/store/myresultStore';

const { Text } = Typography;

// ─── column descriptor used by every tab ───────────────────────────────────

export interface MyColumn<T> {
  key: string;
  title: string;
  /** the canonical SQL column name for filter/sort (e.g. "fd.name") */
  sqlCol?: string;
  width?: number;
  render?: (row: T) => React.ReactNode;
  /** Set true to hide from Excel export */
  noExport?: boolean;
  /** Default to true; toggling visibility persists to user settings. */
  defaultVisible?: boolean;
}

// ─── CSV export (visible columns, skipping noExport) ──────────────────────
//
// Using CSV instead of XLSX to avoid bundling the heavy `xlsx` lib. Opens in
// Excel just fine; the legacy DataTables `excelHtml5` export was effectively
// the same content shape.

function csvCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv<T>(
  filename: string,
  columns: MyColumn<T>[],
  hiddenCols: string[],
  rows: T[],
) {
  const visible = columns.filter((c) => !hiddenCols.includes(c.key) && !c.noExport);
  const lines: string[] = [];
  lines.push(visible.map((c) => csvCell(c.title)).join(','));
  for (const r of rows) {
    lines.push(visible.map((c) => {
      if (c.render) {
        try { const n = c.render(r); if (typeof n === 'string' || typeof n === 'number') return csvCell(n); } catch { /* ignore */ }
      }
      // @ts-expect-error generic row access
      const v = r[c.key];
      return csvCell(v);
    }).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.replace(/\.xlsx$/, '.csv');
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ─── ResultsTable ─────────────────────────────────────────────────────────

interface Props<T extends { id: number }> {
  tab: MyResultTab;
  columns: MyColumn<T>[];
  data: ListResponse<T> | undefined;
  loading: boolean;
  showStopExtras?: boolean;        // "Show also excluded types" checkbox on Stop tab
  rowKey?: (r: T) => React.Key;
  /** Per-row actions cell (Edit/Delete). Returned ReactNode is the cell content. */
  renderActions?: (r: T) => React.ReactNode;
}

export function ResultsTable<T extends { id: number }>({
  tab, columns, data, loading, showStopExtras = false, renderActions,
}: Props<T>) {
  const { tabs, setTab } = useMyResultStore();
  const s = tabs[tab];

  const total = data?.total ?? 0;
  const rows = data?.data ?? [];

  // visible columns (all unless toggled hidden)
  const visibleColumns = useMemo(
    () => columns.filter((c) => !s.hiddenCols.includes(c.key)),
    [columns, s.hiddenCols],
  );

  // ─── filter row ──────────────────────────────────────────────────────────

  function getFilter(key: string): ColumnFilter | undefined {
    return s.filters.find((f) => f.column === key);
  }
  function setFilter(key: string, sqlCol: string, op: number, value: string) {
    const next = s.filters.filter((f) => f.column !== key);
    if (value || op === 5 || op === 6) next.push({ column: sqlCol, op, value });
    setTab(tab, { filters: next, page: 1 });
  }

  // ─── pagination, sort ────────────────────────────────────────────────────

  function onChange(
    pag: TablePaginationConfig,
    _: unknown,
    sorter: SorterResult<T> | SorterResult<T>[],
  ) {
    const so = Array.isArray(sorter) ? sorter[0] : sorter;
    const col = visibleColumns.find((c) => c.key === so?.columnKey);
    setTab(tab, {
      page: pag.current ?? 1,
      perPage: pag.pageSize ?? s.perPage,
      order: so?.order
        ? { col: col?.sqlCol ?? `${tab}.id`, dir: so.order === 'ascend' ? 'asc' : 'desc' }
        : { col: undefined, dir: 'desc' },
    });
  }

  // ─── AntD column definitions ────────────────────────────────────────────

  const antColumns: ColumnType<T>[] = visibleColumns.map((c) => ({
    key: c.key,
    title: c.title,
    width: c.width,
    sorter: c.sqlCol ? true : false,
    render: c.render
      ? (_: unknown, r: T) => c.render!(r)
      // @ts-expect-error generic field render
      : (_: unknown, r: T) => r[c.key],
  }));
  if (renderActions) {
    antColumns.push({ key: '__actions', title: 'Actions', width: 110, fixed: 'right', render: (_v, r) => renderActions(r) });
  }

  // ─── filter row above the table ─────────────────────────────────────────

  const filterRow = (
    <tr style={{ background: '#fafafa' }}>
      {visibleColumns.map((c) => {
        const f = getFilter(c.key);
        const op = f?.op ?? 1;
        return (
          <th key={c.key} style={{ padding: '4px 6px', borderBottom: '1px solid #e8e8e8' }}>
            {c.sqlCol ? (
              <Space.Compact size="small" style={{ width: '100%' }}>
                <Input
                  size="small"
                  placeholder=""
                  value={f?.value ?? ''}
                  onChange={(e) => setFilter(c.key, c.sqlCol!, op, e.target.value)}
                  style={{ width: 'calc(100% - 28px)' }}
                  allowClear
                />
                <FilterOperatorPopover value={op} onChange={(o) => setFilter(c.key, c.sqlCol!, o, f?.value ?? '')} />
              </Space.Compact>
            ) : null}
          </th>
        );
      })}
      {renderActions ? <th /> : null}
    </tr>
  );

  // ─── summary footer row ──────────────────────────────────────────────────

  const summaryQ = useSummary(
    tab === 'production' || tab === 'scrap' || tab === 'stop' ? tab : 'production',
    tab === 'production' || tab === 'scrap' || tab === 'stop' ? s.summaryType : null,
  );

  const summaryFooter = s.summaryType
    ? (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ background: '#fbfbfb' }}>
          {visibleColumns.map((c, i) => (
            <Table.Summary.Cell key={c.key} index={i}>
              {String((summaryQ.data?.row as Record<string, unknown> | undefined)?.[c.key] ?? '')}
            </Table.Summary.Cell>
          ))}
          {renderActions ? <Table.Summary.Cell index={visibleColumns.length} /> : null}
        </Table.Summary.Row>
      </Table.Summary>
    ) : undefined;

  return (
    <div>
      {/* ─── toolbar ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 4px', borderBottom: '1px solid #f0f0f0',
      }}>
        <span>Show</span>
        <Select
          size="small"
          value={s.perPage}
          onChange={(v) => setTab(tab, { perPage: v, page: 1 })}
          options={[10, 25, 50, 9999].map((n) => ({ value: n, label: n === 9999 ? 'All' : String(n) }))}
          style={{ width: 80 }}
        />
        <span>entries</span>

        <Tooltip title="Hide / show columns">
          <Button size="small" type="text" icon={<EyeInvisibleOutlined />} />
        </Tooltip>
        <Tooltip title="Compress / expand">
          <Button size="small" type="text" icon={<CompressOutlined />} />
        </Tooltip>

        <Checkbox
          checked={s.showMyEntries}
          onChange={(e) => setTab(tab, { showMyEntries: e.target.checked, page: 1 })}
        >Show my entries only</Checkbox>

        {showStopExtras && (
          <Checkbox
            checked={s.excludeType}
            onChange={(e) => setTab(tab, { excludeType: e.target.checked, page: 1 })}
          >Show also excluded types</Checkbox>
        )}

        <div style={{ flex: 1 }} />

        <span>Search:</span>
        <Input
          size="small"
          value={s.search}
          onChange={(e) => setTab(tab, { search: e.target.value })}
          style={{ width: 180 }}
        />

        <Button
          size="small"
          type="primary"
          icon={<FileExcelOutlined />}
          style={{ background: '#1d6f42', borderColor: '#1d6f42' }}
          onClick={() => exportCsv(`${tab}-${s.page}.csv`, columns, s.hiddenCols, rows)}
        >Excel</Button>
      </div>

      {/* ─── table ─── */}
      <Table<T>
        size="small"
        columns={antColumns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        components={{ header: { row: ({ children, ...rest }: { children: React.ReactNode }) => (
          <>
            <tr {...rest}>{children}</tr>
            {filterRow}
          </>
        ) } }}
        pagination={{
          current: s.page,
          pageSize: s.perPage,
          total,
          showSizeChanger: false,
          showTotal: (t, r) => `Showing ${r[0]} to ${r[1]} of ${t} entries`,
        }}
        onChange={onChange}
        summary={summaryFooter ? () => summaryFooter : undefined}
        locale={{ emptyText: 'No data available in table' }}
      />

      {/* ─── summary mode selector ─── */}
      {(tab === 'production' || tab === 'scrap' || tab === 'stop') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px' }}>
          <Text>Summary:</Text>
          <Select<SummaryType | null>
            size="small"
            value={s.summaryType}
            onChange={(v) => setTab(tab, { summaryType: v ?? null })}
            style={{ width: 160 }}
            options={[
              { value: null as unknown as SummaryType, label: 'None' },
              ...([1, 2, 3, 4, 5, 6, 7] as SummaryType[]).map((t) => ({ value: t, label: SUMMARY_LABELS[t] })),
            ]}
          />
        </div>
      )}
    </div>
  );
}

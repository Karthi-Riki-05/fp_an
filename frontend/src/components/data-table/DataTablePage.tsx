'use client';

import {
  AppstoreOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileExcelOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { ReactNode, useMemo, useState } from 'react';

const { Text } = Typography;

export interface DataTableColumn<T> extends Omit<ColumnType<T>, 'filterDropdown'> {
  /** Stable id used for column-visibility toggles + per-column filter state. */
  id: string;
  /** Show a per-column text filter (matches legacy operator-picker but simplified). */
  filterable?: boolean;
}

export interface DataTablePageProps<T> {
  /** Big card title, e.g. "Active Equipments". */
  cardTitle: ReactNode;
  /** Right-side action buttons in the title bar (Add, Export, Import…). */
  actions?: ReactNode;

  rows: T[];
  rowKey: keyof T | ((row: T) => string | number);
  columns: DataTableColumn<T>[];
  loading?: boolean;

  // ---- pagination ----
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;

  // ---- search + per-column filters ----
  search: string;
  onSearchChange: (s: string) => void;
  columnFilters: Record<string, string>;
  onColumnFiltersChange: (filters: Record<string, string>) => void;

  // ---- group/summary controls (legacy parity, optional) ----
  groupSlot?: ReactNode;
  summaryOptions?: { label: string; value: string }[];
  summaryValue?: string;
  onSummaryChange?: (value: string) => void;

  /** Excel export click handler. Falsy = hide button. */
  onExportExcel?: () => void;

  /** Empty-state message when rows.length === 0 and no search active. */
  emptyText?: ReactNode;
}

/**
 * Generic admin list page wrapper.
 *
 * Mirrors the legacy yajra DataTables IA from screenshots:
 *   ┌─ Card ────────────────────────────────────────────────────┐
 *   │ <cardTitle>            <actions> [+ Add] [Export] [Import]│
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Filter By Group: [drop here]                              │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Show [50▾] entries 👁 ⊞     Search [____]   [Excel]       │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Headers + per-column filter inputs                        │
 *   │ Rows                                                      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ Showing X to Y of Z   Summary [None▾]   [Prev][1][Next]   │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Server-side: caller controls page/pageSize/search/columnFilters via
 * controlled props; component just forwards events.
 */
export function DataTablePage<T extends object>(props: DataTablePageProps<T>) {
  const {
    cardTitle, actions, rows, rowKey, columns, loading, total, page, pageSize,
    onPageChange, search, onSearchChange, columnFilters, onColumnFiltersChange,
    groupSlot, summaryOptions, summaryValue, onSummaryChange, onExportExcel, emptyText,
  } = props;

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [filterRowVisible, setFilterRowVisible] = useState(true);

  const visibleColumns = useMemo<ColumnsType<T>>(() => {
    return columns
      .filter((c) => !hiddenColumns.has(c.id))
      .map((c) => ({ ...c, key: c.id }) as ColumnType<T>);
  }, [columns, hiddenColumns]);

  const filterRow = filterRowVisible
    ? (
        <tr style={{ background: '#fafbfc' }}>
          {visibleColumns.map((c) => {
            const colDef = columns.find((x) => x.id === (c as ColumnType<T> & { key: string }).key);
            const filterable = colDef?.filterable;
            return (
              <th
                key={String(c.key)}
                style={{ padding: '6px 8px', borderBottom: '1px solid #eef0f3', borderRight: '1px solid #f0f0f0' }}
              >
                {filterable ? (
                  <Input
                    size="small"
                    value={columnFilters[colDef!.id] ?? ''}
                    onChange={(e) => onColumnFiltersChange({ ...columnFilters, [colDef!.id]: e.target.value })}
                    suffix={<Tag>A</Tag>}
                    aria-label={`Filter ${String(c.title ?? colDef!.id)}`}
                  />
                ) : null}
              </th>
            );
          })}
        </tr>
      )
    : null;

  const visibilityMenu = useMemo(() => {
    return {
      items: columns.map((c) => ({
        key: c.id,
        label: (
          <Checkbox
            checked={!hiddenColumns.has(c.id)}
            onChange={(e) => {
              const next = new Set(hiddenColumns);
              if (e.target.checked) next.delete(c.id); else next.add(c.id);
              setHiddenColumns(next);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {String(c.title ?? c.id)}
          </Checkbox>
        ),
      })),
    };
  }, [columns, hiddenColumns]);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <Card
      style={{ borderRadius: 8 }}
      bodyStyle={{ padding: 0 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>{cardTitle}</span>
          <Space wrap>{actions}</Space>
        </div>
      }
    >
      {/* group filter row */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef0f3', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 13, flexShrink: 0 }}>Filter By Group</Text>
        <div
          style={{
            flex: 1,
            minHeight: 36,
            border: '1px dashed #d9d9d9',
            borderRadius: 4,
            padding: '6px 12px',
            color: '#bfbfbf',
            fontSize: 12,
            background: '#fafbfc',
          }}
        >
          {groupSlot ?? 'Drop group here'}
        </div>
      </div>

      {/* page-size + visibility + search + export */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #eef0f3',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>Show</Text>
        <Select
          size="small"
          value={pageSize}
          onChange={(v) => onPageChange(1, Number(v))}
          options={[10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }))}
          style={{ width: 80 }}
        />
        <Text type="secondary" style={{ fontSize: 13 }}>entries</Text>

        <Tooltip title={filterRowVisible ? 'Hide column filters' : 'Show column filters'}>
          <Button
            size="small"
            type="text"
            icon={filterRowVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() => setFilterRowVisible((v) => !v)}
            aria-label="Toggle column filter row"
          />
        </Tooltip>

        <Dropdown menu={visibilityMenu} trigger={['click']}>
          <Tooltip title="Show / hide columns">
            <Button size="small" type="text" icon={<AppstoreOutlined />} aria-label="Column visibility" />
          </Tooltip>
        </Dropdown>

        <div style={{ flex: 1 }} />

        <Input
          size="small"
          placeholder="Search…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          style={{ maxWidth: 240 }}
        />

        {onExportExcel && (
          <Tooltip title="Export to Excel">
            <Button
              type="primary"
              size="small"
              icon={<FileExcelOutlined />}
              onClick={onExportExcel}
              style={{ background: '#1d6f42', borderColor: '#1d6f42' }}
              aria-label="Export to Excel"
            />
          </Tooltip>
        )}
      </div>

      {/* table */}
      <div style={{ overflowX: 'auto' }}>
        <Table<T>
          rowKey={rowKey as never}
          columns={visibleColumns}
          dataSource={rows}
          loading={loading ? { indicator: <Spin /> } : false}
          pagination={false}
          size="middle"
          locale={{ emptyText: emptyText ?? <Empty description="No entries" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          components={
            filterRow
              ? {
                  header: {
                    wrapper: ({ children, ...rest }: { children: ReactNode }) => (
                      <thead {...rest}>
                        {children}
                        {filterRow}
                      </thead>
                    ),
                  },
                }
              : undefined
          }
          sticky
        />
      </div>

      {/* footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #eef0f3',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          Showing {start} to {end} of {total} entries
        </Text>
        {summaryOptions && (
          <>
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 16 }}>Summary</Text>
            <Select
              size="small"
              value={summaryValue}
              onChange={onSummaryChange}
              options={summaryOptions}
              style={{ width: 160 }}
            />
          </>
        )}
        <div style={{ flex: 1 }} />
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
          showSizeChanger={false}
          showLessItems
        />
      </div>
    </Card>
  );
}

// Tiny chip used as the per-column filter operator badge.
function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: '#e6f7fa',
        color: '#01b9d0',
        fontSize: 10,
        fontWeight: 600,
        padding: '0 4px',
        borderRadius: 3,
        lineHeight: 1.5,
      }}
    >
      {children}
    </span>
  );
}

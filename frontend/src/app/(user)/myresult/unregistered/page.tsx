'use client';

import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useUnregisteredList, type UnregisteredRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';

function fmt(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

const COLUMNS: MyColumn<UnregisteredRow>[] = [
  { key: 'rowNum',         title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'unitName',       title: 'Unit',           sqlCol: 'm.unit_name' },
  { key: 'equipmentName',  title: 'Equipment',      sqlCol: 'e.name' },
  { key: 'startTime',      title: 'Start Time',     sqlCol: 'md.start_time', render: (r) => fmt(r.startTime) },
  { key: 'endTime',        title: 'End Time',       sqlCol: 'md.end_time',   render: (r) => fmt(r.endTime) },
  { key: 'productionTime', title: 'Production time' },
];

export default function UnregisteredPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.unregistered;

  const listQ = useUnregisteredList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    filters: s.filters,
    order: s.order,
  });

  return (
    <ResultsTable<UnregisteredRow>
      tab="unregistered"
      columns={COLUMNS}
      data={listQ.data}
      loading={listQ.isFetching}
    />
  );
}

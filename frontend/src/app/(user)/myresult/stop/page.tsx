'use client';

import { Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useStopList, type StopRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';

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
  );
}

'use client';

import { Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useScrapList, type ScrapRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';

function fmt(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

const COLUMNS: MyColumn<ScrapRow>[] = [
  { key: 'rowNum',        title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'flowName',      title: 'Flow name',       sqlCol: 'fd.name' },
  { key: 'equipmentName', title: 'Equipment Name',  sqlCol: 'e.name' },
  { key: 'partNumber',    title: 'Part number',     sqlCol: 'p.part_no' },
  { key: 'partName',      title: 'Part Name',       sqlCol: 'p.name' },
  { key: 'shiftName',     title: 'Shift Name',      sqlCol: 'sd.work_shift_name' },
  { key: 'orderNo',       title: 'Order NR',        sqlCol: 'sd.order_no' },
  { key: 'quantity',      title: 'Quantity',        sqlCol: 'sd.quantity' },
  { key: 'scrapType',     title: 'Scrap type',      sqlCol: 't.name' },
  { key: 'scrapReason',   title: 'Scrap reason',    sqlCol: 'sr.name' },
  { key: 'comment',       title: 'Comment',         sqlCol: 'sd.comment' },
  { key: 'selectedDate',  title: 'Selected date',   sqlCol: 'sd.date',       render: (r) => fmt(r.selectedDate) },
  { key: 'createdAt',     title: 'Created date',    sqlCol: 'sd.created_at', render: (r) => fmt(r.createdAt) },
  { key: 'createdBy',     title: 'Created by',      sqlCol: 'u.name' },
  { key: 'attachment',    title: 'Attachment',                                render: (r) => r.attachment ? <a href={r.attachment} target="_blank" rel="noreferrer">📎</a> : null },
];

export default function ScrapPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.scrap;
  const deleteMut = useDeleteRow('scrap');

  const listQ = useScrapList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    show_my_entries: s.showMyEntries ? '1' : '0',
    filters: s.filters,
    order: s.order,
  });

  return (
    <ResultsTable<ScrapRow>
      tab="scrap"
      columns={COLUMNS}
      data={listQ.data}
      loading={listQ.isFetching}
      renderActions={(r) => r.canEdit ? (
        <Space size={4}>
          <Link href={`/myresult/scrap/${r.id}/edit`}><Button size="small" type="text" icon={<EditOutlined />} /></Link>
          <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) : null}
    />
  );
}

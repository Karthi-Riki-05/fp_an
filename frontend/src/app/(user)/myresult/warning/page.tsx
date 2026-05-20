'use client';

import { Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { ResultsTable, type MyColumn } from '../../../../components/myresult/ResultsTable';
import { useDeleteRow, useWarningList, type WarningRow } from '../../../../lib/api/myresult';
import { useMyResultStore } from '../../../../lib/store/myresultStore';

function fmt(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 19 ? s.slice(0, 19).replace('T', ' ') : s;
}

const COLUMNS: MyColumn<WarningRow>[] = [
  { key: 'rowNum',           title: 'S.No', width: 60, render: (r) => r.id },
  { key: 'equipmentName',    title: 'Equipment Name',    sqlCol: 'e.name' },
  { key: 'duration',         title: 'Duration' },
  { key: 'notificationText', title: 'Notification text', sqlCol: 'wd.notification_text' },
  { key: 'fromTime',         title: 'From timestamp',    sqlCol: 'wd.from_time', render: (r) => fmt(r.fromTime) },
  { key: 'toTime',           title: 'To timestamp',      sqlCol: 'wd.to_time',   render: (r) => fmt(r.toTime) },
];

export default function WarningPage() {
  const { range, tabs } = useMyResultStore();
  const s = tabs.warning;
  const deleteMut = useDeleteRow('warning');

  const listQ = useWarningList({
    page: s.page, perPage: s.perPage,
    start_date: range.startDate ?? undefined,
    end_date:   range.endDate   ?? undefined,
    show_my_entries: s.showMyEntries ? '1' : '0',
    filters: s.filters,
    order: s.order,
  });

  return (
    <ResultsTable<WarningRow>
      tab="warning"
      columns={COLUMNS}
      data={listQ.data}
      loading={listQ.isFetching}
      renderActions={(r) => r.canEdit ? (
        <Space size={4}>
          <Link href={`/myresult/warning/${r.id}/edit`}><Button size="small" type="text" icon={<EditOutlined />} /></Link>
          <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) : null}
    />
  );
}

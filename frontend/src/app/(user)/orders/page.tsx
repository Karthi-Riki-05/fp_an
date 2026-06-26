'use client';

import { RightOutlined } from '@ant-design/icons';
import { Empty, Progress, Segmented, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUserOrders, type UserOrder } from '../../../lib/api/user-orders';

type Derived = 'done' | 'overdue' | 'in_progress' | 'planned';

const STATUS_PILL: Record<Derived, { label: string; bg: string; color: string }> = {
  done:        { label: 'Done',        bg: 'rgba(46,204,113,0.12)', color: '#27ae60' },
  overdue:     { label: 'Overdue',     bg: 'rgba(221,75,57,0.12)',  color: '#dd4b39' },
  in_progress: { label: 'In Progress', bg: 'rgba(1,185,208,0.12)',  color: '#01b9d0' },
  planned:     { label: 'Planned',     bg: 'rgba(149,157,165,0.15)', color: '#6b7680' },
};

function deriveStatus(o: UserOrder): Derived {
  const done = o.plannedQty > 0 && o.okQty >= o.plannedQty;
  if (done) return 'done';
  if (o.endDate && dayjs(o.endDate).endOf('day').isBefore(dayjs())) return 'overdue';
  if (o.okQty > 0) return 'in_progress';
  return 'planned';
}

function OrderCard({ o }: { o: UserOrder }) {
  const router = useRouter();
  const status = deriveStatus(o);
  const pill = STATUS_PILL[status];
  const pct = o.plannedQty > 0 ? Math.min(100, Math.round((o.okQty / o.plannedQty) * 100)) : 0;
  const overdue = status === 'overdue';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push('/myresult/production')}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push('/myresult/production'); }}
      style={{
        background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: 14, marginBottom: 10, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2a30' }}>#{o.orderNr}</div>
          <div style={{ fontSize: 12, color: '#6b7680', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {o.partName ?? o.description ?? '—'}{o.equipmentName ? ` · ${o.equipmentName}` : ''}
          </div>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
          padding: '3px 8px', borderRadius: 10, background: pill.bg, color: pill.color, textTransform: 'uppercase',
        }}>{pill.label}</span>
        <RightOutlined style={{ color: '#c4ccd1', fontSize: 12, marginTop: 4 }} />
      </div>

      <div style={{ marginTop: 10 }}>
        <Progress
          percent={pct}
          size="small"
          strokeColor={status === 'done' ? '#27ae60' : '#01b9d0'}
          format={() => `${o.okQty}/${o.plannedQty}`}
        />
      </div>

      {o.endDate && (
        <div style={{ marginTop: 4, fontSize: 11, color: overdue ? '#dd4b39' : '#8a949a' }}>
          Due {dayjs(o.endDate).format('DD MMM YYYY')}{overdue ? ' · overdue' : ''}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { data, isLoading, isError } = useUserOrders();
  const [tab, setTab] = useState<'all' | 'in_progress' | 'overdue'>('all');

  const orders = data ?? [];
  const filtered = orders.filter((o) => {
    if (tab === 'all') return true;
    const s = deriveStatus(o);
    if (tab === 'in_progress') return s === 'in_progress';
    return s === 'overdue';
  });

  return (
    <div>
      <h1 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1f2a30' }}>Orders</h1>

      <Segmented
        block
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        options={[
          { label: `All (${orders.length})`, value: 'all' },
          { label: `In Progress (${orders.filter((o) => deriveStatus(o) === 'in_progress').length})`, value: 'in_progress' },
          { label: `Overdue (${orders.filter((o) => deriveStatus(o) === 'overdue').length})`, value: 'overdue' },
        ]}
        style={{ marginBottom: 14 }}
      />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : isError ? (
        <Empty description="Could not load orders." />
      ) : filtered.length === 0 ? (
        <Empty description={tab === 'all' ? 'No orders yet.' : `No ${tab === 'overdue' ? 'overdue' : 'in-progress'} orders.`} />
      ) : (
        <div>{filtered.map((o) => <OrderCard key={o.id} o={o} />)}</div>
      )}
    </div>
  );
}

'use client';

import {
  BellOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  RightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { App, Empty, Skeleton } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import { useRouter } from 'next/navigation';
import { useAcknowledgeWarning, useAlerts, type AlertItem } from '../../../lib/api/alerts';

const STYLES: Record<
  AlertItem['severity'],
  { border: string; tint: string; icon: React.ReactNode; action: string; label: string }
> = {
  critical: { border: '#dd4b39', tint: 'rgba(221,75,57,0.08)',  icon: <PauseCircleOutlined />, action: 'LOG',  label: 'Critical' },
  warning:  { border: '#f39c12', tint: 'rgba(243,156,18,0.08)', icon: <WarningOutlined />,     action: 'ACK',  label: 'Warning' },
  info:     { border: '#01b9d0', tint: 'rgba(1,185,208,0.08)',  icon: <InfoCircleOutlined />,  action: 'VIEW', label: 'Info' },
};

/** Where tapping an alert takes the operator. */
function destFor(a: AlertItem): string {
  if (a.type === 'stop') return '/units';        // register/classify the stop
  if (a.type === 'warning') return '/myresult';  // review warnings
  return '/dashboard';
}

function AlertCard({ a }: { a: AlertItem }) {
  const router = useRouter();
  const { message } = App.useApp();
  const ack = useAcknowledgeWarning();
  const s = STYLES[a.severity] ?? STYLES.info;
  const dest = destFor(a);
  const title = a.type === 'stop' ? 'Unlogged stop' : a.message;

  // Warning ACK persists state; LOG/VIEW just navigate.
  const onAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (a.type === 'warning') {
      ack.mutate(a.id, {
        onSuccess: () => message.success('Warning acknowledged'),
        onError: () => message.error('Could not acknowledge warning'),
      });
      return;
    }
    router.push(dest);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(dest)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(dest); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff',
        borderLeft: `4px solid ${s.border}`,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '12px 14px',
        marginBottom: 10,
        cursor: 'pointer',
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: s.tint, color: s.border,
        display: 'grid', placeItems: 'center', fontSize: 18,
      }}>{s.icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: '#1f2a30',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b7680', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.machineName}
          {a.createdAt ? <> · {dayjs(a.createdAt).fromNow()}</> : null}
        </div>
      </div>

      <button
        onClick={onAction}
        disabled={a.type === 'warning' && ack.isPending}
        style={{
          flexShrink: 0, border: `1px solid ${s.border}`, color: s.border,
          background: 'transparent', borderRadius: 6, padding: '6px 12px',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
          cursor: ack.isPending ? 'default' : 'pointer', opacity: ack.isPending ? 0.6 : 1,
        }}
      >{s.action}</button>

      <RightOutlined style={{ color: '#c4ccd1', fontSize: 12, flexShrink: 0 }} />
    </div>
  );
}

export default function AlertsPage() {
  const { data, isLoading, isError } = useAlerts();
  const unread = data?.unread ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1f2a30' }}>Alerts</h1>
        {unread > 0 && (
          <span style={{
            minWidth: 22, height: 22, padding: '0 7px', borderRadius: 11,
            background: '#ff4d4f', color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'grid', placeItems: 'center',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : isError ? (
        <Empty description="Could not load alerts." />
      ) : !data || data.items.length === 0 ? (
        <Empty image={<BellOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />} description="No active alerts. All clear." />
      ) : (
        <div>
          {data.items.map((a) => <AlertCard key={`${a.type}-${a.id}`} a={a} />)}
        </div>
      )}
    </div>
  );
}

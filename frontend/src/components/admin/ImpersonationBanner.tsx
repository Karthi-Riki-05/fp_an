'use client';

import { LogoutOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { App, Button } from 'antd';
import { useRouter } from 'next/navigation';
import { toApiError } from '../../lib/api-client';
import { useMe, useStopImpersonation } from '../../lib/api/auth';

/**
 * Persistent banner shown only during a Super Admin impersonation session.
 * Calls POST /auth/impersonate/stop on click — backend issues a fresh Super
 * Admin JWT, no re-login required.
 *
 * Mounted at the top of AdminShell content. Hidden when /me does not return
 * an impersonator id.
 */
export function ImpersonationBanner() {
  const { data: me, refetch } = useMe();
  const stop = useStopImpersonation();
  const { message } = App.useApp();
  const router = useRouter();

  if (!me?.impersonatorId || !me?.impersonator) return null;

  const onStop = async () => {
    try {
      await stop.mutateAsync();
      message.success(`Restored as ${me.impersonator!.name}.`);
      // Force a re-fetch of /me + invalidate; QueryClient was cleared by the hook.
      await refetch();
      router.push('/admin/access/users');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        background: '#fff7e6',
        borderBottom: '1px solid #ffd591',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#874d00', fontSize: 13 }}>
        <UserSwitchOutlined style={{ fontSize: 18 }} />
        <span>
          Logged in as <strong>{me.name}</strong> (impersonating from{' '}
          <strong>{me.impersonator.name}</strong> · {me.impersonator.email}). Every action you take is
          recorded against both ids.
        </span>
      </div>
      <Button
        type="primary"
        danger
        icon={<LogoutOutlined />}
        onClick={onStop}
        loading={stop.isPending}
        size="small"
      >
        Stop impersonating
      </Button>
    </div>
  );
}

'use client';

/**
 * /profile — operator profile + settings (mobile).
 *
 * Identity card (initials + name + role chips) followed by a tappable
 * settings list: language toggle (NEXT_LOCALE cookie), push-notification
 * preference (localStorage), timezone, change password, and sign out.
 *
 * Does NOT wrap itself in <UserShell> — the (user) route group layout does.
 */

import { Switch } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLogout, useMe } from '../../../lib/api/auth';

const BRAND = '#01b9d0';
const SUCCESS = '#00a65a';
const WARN = '#f39c12';
const PURPLE = '#954cfe';
const ERROR = '#dd4b39';
const CARD_SHADOW = '0 1px 4px rgba(0,0,0,0.08)';
const PUSH_KEY = 'fp_push_enabled';

function Row({
  icon, color, title, desc, right, onClick,
}: {
  icon: string; color: string; title: string; desc: string;
  right?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'white', borderRadius: 10, padding: 12,
        margin: '0 12px 6px', boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: `${color}1a`, display: 'grid', placeItems: 'center', fontSize: 17 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 12, fontWeight: 700, color: '#262626' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>{desc}</div>
      </div>
      {right ?? <div style={{ color: BRAND, fontSize: 16 }}>›</div>}
    </div>
  );
}

export default function UserProfile() {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  const [locale, setLocale] = useState<'sv' | 'en' | null>(null);
  const [push, setPush] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    setLocale(m?.[1] === 'en' ? 'en' : 'sv');
    setPush(localStorage.getItem(PUSH_KEY) === '1');
  }, []);

  const toggleLocale = () => {
    const next = locale === 'en' ? 'sv' : 'en';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    window.location.reload();
  };

  const togglePush = (v: boolean) => {
    setPush(v);
    localStorage.setItem(PUSH_KEY, v ? '1' : '0');
  };

  const handleLogout = async () => {
    try { await logout.mutateAsync(); } finally { router.replace('/login'); }
  };

  const timezone = me?.tenants?.[0]?.timezone || 'Europe/Stockholm';
  const initials = (me?.name || me?.email || '?')
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Identity card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'white', borderRadius: 10, padding: '16px 14px', margin: '12px 12px 0', boxShadow: CARD_SHADOW, border: '1px solid #f0f0f0' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, #00768D, ${BRAND})`, color: 'white', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-poppins)', fontSize: 18, fontWeight: 800 }}>{isLoading ? '…' : initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 15, fontWeight: 700, color: '#262626' }}>{me?.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.email || ''}</div>
          {me?.roles?.length ? (
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {me.roles.map((r) => (
                <span key={r} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: BRAND, background: 'rgba(1,185,208,0.1)', borderRadius: 4, padding: '2px 6px' }}>{r}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Section label */}
      <div style={{ fontFamily: 'var(--font-poppins)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#8c8c8c', padding: '12px 12px 6px' }}>
        Settings
      </div>

      <Row
        icon="🌍" color={BRAND} title="Language"
        desc={locale === 'en' ? 'English' : 'Svenska'}
        onClick={toggleLocale}
        right={<span style={{ fontSize: 11, fontWeight: 700, color: BRAND }}>{(locale ?? 'sv').toUpperCase()}</span>}
      />
      <Row
        icon="🔔" color={WARN} title="Push Notifications"
        desc={push ? 'Enabled on this device' : 'Disabled'}
        right={<Switch checked={push} onChange={togglePush} />}
      />
      <Row
        icon="🌐" color={SUCCESS} title="Timezone"
        desc="Used for shift & report times"
        right={<span style={{ fontSize: 11, color: '#8c8c8c' }}>{timezone}</span>}
      />
      <Row
        icon="🔒" color={PURPLE} title="Change Password"
        desc="Update your password"
        onClick={() => router.push('/profile/password')}
      />
      <Row
        icon="🚪" color={ERROR} title={logout.isPending ? 'Signing out…' : 'Sign Out'}
        desc="End your session"
        onClick={logout.isPending ? undefined : handleLogout}
        right={<div style={{ color: ERROR, fontSize: 16 }}>›</div>}
      />
    </div>
  );
}

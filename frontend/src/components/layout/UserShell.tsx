'use client';

import {
  AppstoreOutlined,
  BellOutlined,
  DesktopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Spin } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { useMe } from '../../lib/api/auth';
import { useAlerts } from '../../lib/api/alerts';
import { brand } from '../../lib/assets';
import { ImpersonationBanner } from '../admin/ImpersonationBanner';
import { MachineSocketProvider } from '../realtime/MachineSocketProvider';

interface Props {
  children: ReactNode;
  locale?: 'en' | 'sv';
}

const BRAND_GRADIENT = 'linear-gradient(135deg, #00768D 0%, #01b9d0 100%)';
const ACTIVE = '#01b9d0';
const INACTIVE = '#bfbfbf';
const HAIRLINE = '#f0f0f0';

/** Bottom-nav destinations. Order is fixed left→right. */
const TABS = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: <AppstoreOutlined /> },
  { key: 'monitor',   href: '/monitor',   label: 'Monitor',   icon: <DesktopOutlined /> },
  { key: 'alerts',    href: '/alerts',    label: 'Alerts',    icon: <BellOutlined /> },
  { key: 'profile',   href: '/profile',   label: 'Profile',   icon: <UserOutlined /> },
] as const;

/** Map the current route to an app-bar title + subtitle. */
function pageMeta(pathname: string): { title: string; subtitle: string } {
  const p = pathname || '';
  if (p.startsWith('/dashboard')) return { title: 'Dashboard', subtitle: 'Production overview' };
  if (p.startsWith('/monitor'))   return { title: 'Monitor',   subtitle: 'Live machine status' };
  if (p.startsWith('/alerts'))    return { title: 'Alerts',    subtitle: 'Warnings & stops' };
  if (p.startsWith('/profile'))   return { title: 'Profile',   subtitle: 'Your account' };
  if (p.startsWith('/analyzer'))  return { title: 'Analyzer',  subtitle: 'Flow analysis' };
  if (p.startsWith('/myresult'))  return { title: 'Results',   subtitle: 'Log & review entries' };
  if (p.startsWith('/machines'))  return { title: 'Machines',  subtitle: 'Equipment list' };
  if (p.startsWith('/orders'))    return { title: 'Orders',    subtitle: 'Production orders' };
  if (p.startsWith('/boards'))    return { title: 'Boards',    subtitle: 'Dashboards' };
  return { title: 'FP Analyzer', subtitle: 'Production intelligence' };
}

/** Two-letter initials from a display name (or email local-part). */
function initialsOf(name?: string, email?: string): string {
  const src = (name ?? '').trim() || (email ?? '').split('@')[0] || '';
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/**
 * UserShell — mobile-first app chrome for every authenticated operator page.
 *
 * Layout (FIX 2): a fixed top AppHeader, a flex:1 scrollable content region,
 * and a fixed BottomNav tab bar (Dashboard / Monitor / Alerts / Profile) that
 * respects the iOS safe-area inset. Replaces the old MarketingHeader +
 * MarketingFooter chrome on authenticated routes.
 */
export function UserShell({ children, locale = 'sv' }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { data: me, isLoading, isError } = useMe();
  // Live unread alert count for the header bell (Sprint 2 / Task 1).
  const { data: alerts } = useAlerts({ enabled: !!me });

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#ecf0f5' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (isError || !me) {
    router.replace('/login');
    return null;
  }

  const { title, subtitle } = pageMeta(pathname);
  const initials = initialsOf(me.name ?? me.firstName, me.email);
  // Live unread count from GET /api/v1/user/alerts. Badge hides when 0.
  const unreadAlerts = alerts?.unread ?? 0;

  return (
    <div
      style={{
        position: 'fixed',       // fixed + inset:0 is the most reliable viewport lock
        inset: 0,                // (more robust than height:100dvh across mobile browsers)
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',      // no outer scroll; only <main> scrolls
        background: '#ecf0f5',
      }}
    >
      {/* ─────────────── TOP — fixed header region (never scrolls) ─────────────── */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderBottom: `1px solid ${HAIRLINE}`,
          zIndex: 100,
        }}
      >
        <ImpersonationBanner />
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            height: 56,
          }}
        >
        {/* Logo mark — real brand wordmark, rendered at its natural aspect ratio */}
        <Link href="/dashboard" aria-label="Home" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Image
            src={brand.logo}
            alt="FP Analyzer"
            width={76}
            height={28}
            style={{ height: 28, width: 'auto', objectFit: 'contain' }}
            priority
          />
        </Link>

        {/* Page title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#1f2a30',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 11, color: '#8a949a', lineHeight: 1.2 }}>{subtitle}</div>
        </div>

        {/* Bell with unread badge */}
        <Link
          href="/alerts"
          aria-label="Alerts"
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            color: '#5b666c',
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          <BellOutlined />
          {unreadAlerts > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
                lineHeight: 1,
              }}
            >
              {unreadAlerts > 99 ? '99+' : unreadAlerts}
            </span>
          )}
        </Link>

        {/* Avatar — user initials */}
        <Link
          href="/profile"
          aria-label="Profile"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: BRAND_GRADIENT,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            textDecoration: 'none',
          }}
        >
          {initials}
        </Link>
        </header>
      </div>

      {/* Real-time machine event subscriber — no DOM output */}
      <MachineSocketProvider />

      {/* ─────────────── MIDDLE — only this region scrolls ─────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: '#ecf0f5',
          padding: 16,
        }}
      >
        {children}
      </main>

      {/* ─────────────── BOTTOM — BottomNav (never scrolls) ─────────────── */}
      <nav
        style={{
          flexShrink: 0,         // flexShrink:0 pins it to the bottom of the flex column
          background: '#fff',
          borderTop: `1px solid ${HAIRLINE}`,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex',
          zIndex: 50,
        }}
      >
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const color = active ? ACTIVE : INACTIVE;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color,
                textDecoration: 'none',
              }}
            >
              {/* Active indicator line */}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60%',
                    height: 2.5,
                    background: ACTIVE,
                    borderRadius: '0 0 3px 3px',
                  }}
                />
              )}
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

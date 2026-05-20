'use client';

import { CaretDownOutlined, HomeFilled, MenuOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Dropdown, Grid, Menu, Space, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { brand } from '../../lib/assets';
import { toApiError } from '../../lib/api-client';
import { useLogout, useMe } from '../../lib/api/auth';
import { canAccessBackend } from '../../lib/auth';

const { Text } = Typography;
const { useBreakpoint } = Grid;

export interface MarketingHeaderProps {
  /** Bilingual stub — wire to next-intl in Phase 4b. */
  locale?: 'en' | 'sv';
  /** Hide the four marketing nav links (Services / Our Product / About /
   *  Contact). Used by UserShell on authenticated pages so the operator
   *  only sees logo + user dropdown — per operator request. The mobile
   *  drawer also omits the nav items when this is set. */
  hideNav?: boolean;
}

const NAV_LABELS = {
  sv: { services: 'Tjänster', product: 'Vår Produkt',  about: 'Om Oss',    contact: 'Kontakta Oss', signIn: 'Logga in' },
  en: { services: 'Services', product: 'Our Product', about: 'About Us', contact: 'Contact Us',   signIn: 'Sign in' },
} as const;

const USER_MENU_LABELS = {
  sv: { startpage: 'Min Startsida', changePassword: 'Byt lösenord', administration: 'Administration', logout: 'Logga ut' },
  en: { startpage: 'My Startpage',  changePassword: 'Change Password', administration: 'Administration', logout: 'Logout' },
} as const;

/**
 * The dark-teal marketing header used by every public + authenticated page
 * except admin. Nav is the same for everyone (Services / Our Product /
 * About Us / Contact Us); the right-side widget switches based on auth state:
 *   - Anonymous → Sign in button
 *   - Authenticated → tenant-name dropdown with My Startpage / Change Password
 *     / Administration (if isAdmin) / Logout
 *
 * Mirrors the legacy frontend/includes/nav.blade.php IA exactly.
 */
export function MarketingHeader({ locale = 'sv', hideNav = false }: MarketingHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const { data: me } = useMe({ enabled: true });
  const logout = useLogout();
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const labels = NAV_LABELS[locale];
  const userLabels = USER_MENU_LABELS[locale];

  const navItems = [
    { key: '/services', label: labels.services, href: '/services' },
    { key: '/product',  label: labels.product,  href: '/product' },
    { key: '/about',    label: labels.about,    href: '/about' },
    { key: '/contact',  label: labels.contact,  href: '/contact' },
  ];

  const onLogout = async () => {
    try {
      await logout.mutateAsync();
      message.success(locale === 'sv' ? 'Utloggad.' : 'Signed out.');
      router.push('/login');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const userMenuItems = [
    { key: 'startpage',      label: <Link href="/dashboard">{userLabels.startpage}</Link> },
    { key: 'changePassword', label: <Link href="/profile/password">{userLabels.changePassword}</Link> },
    // Administration is visible to anyone with view-backend (Administrator
    // or Company role) — matches legacy @permission('view-backend').
    ...(canAccessBackend(me)
      ? [{ key: 'administration', label: <Link href="/admin">{userLabels.administration}</Link> }]
      : []),
    { type: 'divider' as const },
    { key: 'logout', label: userLabels.logout, onClick: onLogout },
  ];

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        style={{
          color: '#fff',
          fontWeight: 500,
          fontSize: 14,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          padding: '24px 4px',
          borderBottom: active ? '4px solid #4BBACF' : '4px solid transparent',
          transition: 'border-color 0.15s ease',
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      style={{
        background: '#00768D',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 72,
        }}
      >
        {/* logo + home icon */}
        <Link
          href={me ? '/dashboard' : '/'}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
        >
          <Image
            src={brand.logo}
            alt="FP Analyzer"
            width={120}
            height={32}
            priority
            style={{ height: 32, width: 'auto', filter: 'brightness(1.05) saturate(1.1)' }}
          />
          <span
            aria-label="Home"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#01b9d0',
              color: '#fff',
              fontSize: 18,
              boxShadow: '0 0 0 3px rgba(75, 186, 207, 0.45)',
            }}
          >
            <HomeFilled />
          </span>
        </Link>

        {/* nav (omitted on authenticated pages when hideNav is set) */}
        {!isMobile && !hideNav ? (
          <nav style={{ display: 'flex', gap: 28, marginLeft: 24, flex: 1 }}>
            {navItems.map((i) => navLink(i.href, i.label))}
          </nav>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* right side */}
        {!isMobile && (
          <Space size="middle">
            {me ? (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button
                  type="text"
                  style={{ color: '#fff', fontWeight: 500, textTransform: 'none' }}
                >
                  <span style={{ borderBottom: '1px solid #fff' }}>
                    {me.tenants[0]?.name ?? me.firstName ?? me.name}
                  </span>
                  <CaretDownOutlined style={{ fontSize: 12, marginLeft: 4 }} />
                </Button>
              </Dropdown>
            ) : (
              <Link href="/login">
                <Button type="primary" style={{ background: '#01b9d0', borderColor: '#01b9d0' }}>
                  {labels.signIn}
                </Button>
              </Link>
            )}
          </Space>
        )}

        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            style={{ color: '#fff', fontSize: 20 }}
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
          />
        )}
      </div>

      <Drawer
        open={drawerOpen}
        placement="right"
        title={<Text>FP Analyzer</Text>}
        onClose={() => setDrawerOpen(false)}
        width={280}
      >
        {!hideNav && (
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={navItems.map((i) => ({
              key: i.href,
              label: <Link href={i.href} onClick={() => setDrawerOpen(false)}>{i.label}</Link>,
            }))}
            style={{ borderRight: 0, marginBottom: 16 }}
          />
        )}
        {me ? (
          <Menu
            mode="inline"
            items={userMenuItems.map((it) =>
              it.type === 'divider' ? it : { ...it, onClick: undefined as any },
            )}
          />
        ) : (
          <Link href="/login">
            <Button block type="primary">{labels.signIn}</Button>
          </Link>
        )}
      </Drawer>
    </header>
  );
}

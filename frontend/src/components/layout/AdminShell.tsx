'use client';

import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  BulbOutlined,
  CommentOutlined,
  EditOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  ProfileOutlined,
  ProjectOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  TeamOutlined,
  ToolOutlined,
  WifiOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { App, Avatar, Button, Drawer, Grid, Layout, Popover, Spin, Tag, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { brand } from '../../lib/assets';
import { toApiError } from '../../lib/api-client';
import { useLogout, useMe } from '../../lib/api/auth';
import { useAlerts } from '../../lib/api/alerts';
import { hasPermission } from '../../lib/auth';
import { ImpersonationBanner } from '../admin/ImpersonationBanner';
import { AdminSocketProvider } from '../realtime/AdminSocketProvider';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface SidebarItem {
  key: string;
  icon?: ReactNode;
  /** i18n key resolved at render-time via texts.<labelKey>. Falls back to
   *  this same string if no translation is registered. */
  labelKey: string;
  href?: string;
  permission?: string;
  adminOnly?: boolean;
  children?: SidebarItem[];
}

/**
 * SUPERADMIN sidebar — matches old fpanalyzer PHP sidebar.blade.php when hasRole('admin').
 * Global platform management only: users across all tenants, CMS, social, auth config.
 */
const SUPERADMIN_SIDEBAR: SidebarItem[] = [
  { key: '/admin/dashboard',    icon: <HomeOutlined />,              labelKey: 'administration',     href: '/admin/dashboard' },
  { key: '/admin/access/users', icon: <TeamOutlined />,              labelKey: 'user_management',    href: '/admin/access/users' },
  // Tenants page removed — a Company user IS the company. List/manage via
  // User Management (filter by role=Company). See MIGRATION_NOTES §13.
  { key: '/admin/access/roles', icon: <SafetyCertificateOutlined />, labelKey: 'roles',              href: '/admin/access/roles' },
  { key: '/admin/social',       icon: <ShareAltOutlined />,          labelKey: 'social_management',  href: '/admin/social' },
  { key: '/admin/cms',          icon: <ProfileOutlined />,           labelKey: 'cms_management',     href: '/admin/cms' },
  { key: '/admin/sliders',      icon: <ProjectOutlined />,           labelKey: 'slider_management',  href: '/admin/sliders' },
  { key: '/admin/testimonials',  icon: <BulbOutlined />,              labelKey: 'testimonials',        href: '/admin/testimonials' },
  { key: '/admin/feedback',      icon: <CommentOutlined />,           labelKey: 'feedback',            href: '/admin/feedback' },
  { key: '/admin/mqtt-monitor',  icon: <WifiOutlined />,              labelKey: 'mqtt_monitor',        href: '/admin/mqtt-monitor' },
  { key: '/admin/mqtt-testing',  icon: <BugOutlined />,               labelKey: 'mqtt_testing',        href: '/admin/mqtt-testing' },
];

/**
 * COMPANY ADMIN sidebar — matches old fpanalyzer PHP sidebar.blade.php when NOT hasRole('admin').
 * Tenant-scoped operational management: equipment, flows, production, results, boards.
 */
// Restructured into 6 operational groups + a collapsible "Advanced" section
// at the bottom (Sprint 3 / Task 3). CMS/Boards/Feedback — marketing/secondary
// content — moved out of the operational groups into Advanced.
const COMPANY_SIDEBAR: SidebarItem[] = [
  {
    key: 'overview',
    icon: <HomeOutlined />,
    labelKey: 'overview',
    children: [
      { key: '/admin/dashboard', labelKey: 'dashboard',     href: '/admin/dashboard' },
      { key: '/admin/monitor',   labelKey: 'flow_monitor',  href: '/admin/monitor' },
      { key: '/admin/analyzer',  labelKey: 'flow_analyzer', href: '/admin/analyzer' },
    ],
  },
  {
    key: 'production',
    icon: <AppstoreOutlined />,
    labelKey: 'production',
    children: [
      { key: '/admin/orders',          labelKey: 'order_list',     href: '/admin/orders' },
      { key: '/admin/parts',           labelKey: 'parts_list',     href: '/admin/parts' },
      { key: '/admin/shift-schedules', labelKey: 'shift_schedule', href: '/admin/shift-schedules' },
    ],
  },
  {
    key: 'results',
    icon: <BarChartOutlined />,
    labelKey: 'results',
    children: [
      { key: '/admin/results/production', labelKey: 'production_data', href: '/admin/results/production' },
      { key: '/admin/results/scrap',      labelKey: 'scrap_data',      href: '/admin/results/scrap' },
      { key: '/admin/results/stop',       labelKey: 'stop_data',       href: '/admin/results/stop' },
      { key: '/admin/results/warning',    labelKey: 'warning_data',    href: '/admin/results/warning' },
    ],
  },
  {
    key: 'factory',
    icon: <ToolOutlined />,
    labelKey: 'factory',
    children: [
      { key: '/admin/equipment',     labelKey: 'equipment_list', href: '/admin/equipment' },
      { key: '/admin/iot/setup',     labelKey: 'setup_units',    href: '/admin/iot/setup' },
      { key: '/admin/flow-designs',  labelKey: 'flow_designer',  href: '/admin/flow-designs' },
      { key: '/admin/machines',      labelKey: 'machines',       href: '/admin/machines' },
    ],
  },
  {
    key: 'people',
    icon: <TeamOutlined />,
    labelKey: 'people',
    children: [
      { key: '/admin/access/users',         labelKey: 'users',        href: '/admin/access/users' },
      { key: '/admin/access/roles',         labelKey: 'roles',        href: '/admin/access/roles' },
      { key: '/admin/access/salary-groups', labelKey: 'salary_group', href: '/admin/access/salary-groups' },
    ],
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    labelKey: 'settings',
    children: [
      // No dedicated "Company Setup" page yet → points at admin profile as the
      // nearest equivalent (tracked as a Sprint 3 blocker).
      { key: '/admin/profile',       labelKey: 'company_setup',   href: '/admin/profile' },
      { key: '/admin/types',         labelKey: 'type_management', href: '/admin/types' },
      { key: '/admin/import-export', labelKey: 'import_export',   href: '/admin/import-export' },
    ],
  },
  {
    key: 'advanced',
    icon: <ProjectOutlined />,
    labelKey: 'advanced',
    children: [
      { key: '/admin/cms',      labelKey: 'cms_management',    href: '/admin/cms' },
      { key: '/admin/boards',   labelKey: 'dashboard_creator', href: '/admin/boards' },
      { key: '/admin/feedback', labelKey: 'feedback',          href: '/admin/feedback' },
    ],
  },
];

// ── Locale switcher ───────────────────────────────────────────────────────
// Reads and writes the NEXT_LOCALE cookie on the client; page reload causes
// the server to re-read it via i18n/request.ts and serve the correct locale.
function LocaleSwitcher() {
  const [locale, setLocale] = useState<'sv' | 'en' | null>(null);

  useEffect(() => {
    const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    setLocale(m?.[1] === 'en' ? 'en' : 'sv');
  }, []);

  const toggle = () => {
    if (!locale) return;
    const next = locale === 'sv' ? 'en' : 'sv';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    window.location.reload();
  };

  if (!locale) return null;

  return (
    <Button
      type="text"
      size="small"
      onClick={toggle}
      title={locale === 'sv' ? 'Switch to English' : 'Byt till Svenska'}
      style={{ fontWeight: 600, fontSize: 13, color: '#555', padding: '0 8px' }}
    >
      {locale === 'sv' ? '🇬🇧 EN' : '🇸🇪 SV'}
    </Button>
  );
}

interface AdminShellProps {
  children: ReactNode;
  /** Page title shown in the top bar. Falls back to the matched sidebar label. */
  pageTitle?: string;
}

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 60;
const AVATAR_GRADIENT = 'linear-gradient(135deg, #01b9d0 0%, #00768D 100%)';

/** Two-letter initials from a display name (or email local-part). */
function initialsOf(name?: string, email?: string): string {
  const src = (name ?? '').trim() || (email ?? '').split('@')[0] || '';
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function AdminShell({ children, pageTitle }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  // All translatable strings in this shell live under the `texts.*`
  // namespace in messages/{en,sv}.json (the legacy `custom.texts.*`
  // bundle merged via scripts/merge-legacy-translations.mjs).
  const t = useTranslations('texts');

  const { data: me, isLoading, isError } = useMe();
  const logout = useLogout();
  const { message } = App.useApp();
  // Header bell — operator alert feed is tenant-scoped, so only fetch for
  // Company admins (a Super Admin has no fixed tenant → /user/alerts 400s).
  const { data: alertsData } = useAlerts({ enabled: !!me && !me.isAdmin });
  const unreadAlerts = alertsData?.unread ?? 0;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // Auto-expand the group that contains the current page.
  useEffect(() => {
    const sidebar = me?.isAdmin ? SUPERADMIN_SIDEBAR : COMPANY_SIDEBAR;
    const next = new Set(openKeys);
    sidebar.forEach((item) => {
      if (item.children?.some((c) => c.href && (pathname === c.href || pathname.startsWith(`${c.href}/`)))) {
        next.add(item.key);
      }
    });
    setOpenKeys(Array.from(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, me?.isAdmin]);

  const activeSidebar = me?.isAdmin ? SUPERADMIN_SIDEBAR : COMPANY_SIDEBAR;

  const visibleSidebar = useMemo(() => {
    return activeSidebar.map((item) => {
      if (item.children) {
        const visibleChildren = item.children.filter((c) => {
          if (c.permission && !hasPermission(me, c.permission)) return false;
          return true;
        });
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      if (item.permission && !hasPermission(me, item.permission)) return null;
      return item;
    }).filter(Boolean) as SidebarItem[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeSidebar]);

  const matchedTitle = useMemo(() => {
    if (pageTitle) return pageTitle;
    for (const item of visibleSidebar) {
      if (item.href === pathname) return t(item.labelKey);
      const child = item.children?.find((c) => c.href === pathname);
      if (child) {
        // Show parent title for sub-pages (e.g. "Equipment Management" for "Equipment List")
        return t(child.labelKey);
      }
    }
    return t('administration');
    // `t` is a stable reference from next-intl; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleSidebar, pageTitle]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fa' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (isError || !me) {
    router.replace('/login');
    return null;
  }

  const onLogout = async () => {
    try {
      await logout.mutateAsync();
      message.success(t('signed_out'));
      router.replace('/login');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  // activeTenantId: for Company users = their own user.id;
  //                 for sub-Users = their companyId (the Company user's id);
  //                 for Administrators = the X-Tenant-Id header value (Company user id).
  // `tenants[]` is a one-row synthetic array post Tenant removal — see MIGRATION_NOTES §13.
  const tenant = me.tenants.find((t) => t.id === me.activeTenantId) ?? me.tenants[0];

  // -------- sidebar (custom — AntD Menu's selected style is too aggressive for this look) --------
  const sidebarMarkup = (
    <div
      style={{
        height: '100%',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 16px 16px',
          textAlign: 'center',
          borderBottom: '1px solid #eef0f3',
          flexShrink: 0,
        }}
      >
        <Avatar
          size={collapsed && !isMobile ? 32 : 56}
          src={brand.logoSmall}
          style={{ background: '#f5f7fa', border: '1px solid #eef0f3' }}
        />
        {!(collapsed && !isMobile) && (
          <>
            <div style={{ marginTop: 8, fontWeight: 600, color: '#333', fontSize: 13 }}>
              {tenant?.name ?? me.name}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: '#999', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
              {t('online')}
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {visibleSidebar.map((item) => {
          if (item.key === '__divider__') {
            return <div key={item.key} style={{ height: 1, background: '#eef0f3', margin: '12px 16px' }} />;
          }

          const isGroup = item.children && item.children.length > 0;
          const isOpen = openKeys.includes(item.key);
          const isLeafActive = !isGroup && item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const groupHasActiveChild = isGroup && item.children!.some((c) => c.href && (pathname === c.href || pathname.startsWith(`${c.href}/`)));

          if (isGroup) {
            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => setOpenKeys((prev) => (prev.includes(item.key) ? prev.filter((k) => k !== item.key) : [...prev, item.key]))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    minHeight: 44,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: groupHasActiveChild ? '#01b9d0' : '#555',
                    fontSize: 13,
                    fontWeight: groupHasActiveChild ? 600 : 500,
                    gap: 12,
                    textAlign: 'left',
                  }}
                  aria-expanded={isOpen}
                >
                  <span style={{ fontSize: 16, color: groupHasActiveChild ? '#01b9d0' : '#888', minWidth: 16, display: 'inline-flex' }}>
                    {item.icon}
                  </span>
                  {!(collapsed && !isMobile) && (
                    <>
                      <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                      <RightOutlined
                        style={{
                          fontSize: 10,
                          color: '#aaa',
                          transition: 'transform 0.2s',
                          transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
                        }}
                      />
                    </>
                  )}
                </button>
                {isOpen && !(collapsed && !isMobile) && (
                  <div>
                    {item.children!.map((child) => {
                      const childActive = child.href && (pathname === child.href || pathname.startsWith(`${child.href}/`));
                      return (
                        <Link
                          key={child.key}
                          href={child.href ?? '#'}
                          onClick={() => isMobile && setDrawerOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 16px 10px 40px',
                            minHeight: 44,
                            color: childActive ? '#01b9d0' : '#666',
                            fontSize: 13,
                            fontWeight: childActive ? 600 : 400,
                            textDecoration: 'none',
                            background: childActive ? '#e6f7fa' : 'transparent',
                            borderLeft: childActive ? '3px solid #01b9d0' : '3px solid transparent',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              border: childActive ? '2px solid #01b9d0' : '2px solid #ccc',
                              marginRight: 10,
                              display: 'inline-block',
                            }}
                          />
                          {t(child.labelKey)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href ?? '#'}
              onClick={() => isMobile && setDrawerOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                minHeight: 44,
                color: isLeafActive ? '#01b9d0' : '#555',
                fontSize: 13,
                fontWeight: isLeafActive ? 600 : 500,
                gap: 12,
                textDecoration: 'none',
                background: isLeafActive ? '#e6f7fa' : 'transparent',
                borderLeft: isLeafActive ? '3px solid #01b9d0' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 16, color: isLeafActive ? '#01b9d0' : '#888', minWidth: 16, display: 'inline-flex' }}>
                {item.icon}
              </span>
              {!(collapsed && !isMobile) && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  // -------- profile popover --------
  const profilePopover = (
    <div style={{ width: 240, padding: 4 }}>
      <div style={{ textAlign: 'center', padding: '12px 8px', borderBottom: '1px solid #eef0f3' }}>
        <Avatar size={64} src={brand.logoSmall} style={{ background: '#f5f7fa', border: '1px solid #eef0f3' }} />
        <div style={{ marginTop: 8, fontWeight: 600, color: '#333' }}>
          {tenant?.name ?? me.name}{' '}
          <Button type="text" size="small" icon={<EditOutlined />} aria-label="Edit profile" style={{ verticalAlign: 'middle' }} />
        </div>
        <Tag color="default" style={{ marginTop: 4 }}>
          {me.isAdmin ? 'Administrator' : me.roles[0] ?? 'User'}
        </Tag>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" aria-label="English" style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer', lineHeight: 0 }}>
            <Image src="/dashboard-icons/flag-en.png" alt="" width={20} height={20} />
          </button>
          <button type="button" aria-label="Svenska" style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer', lineHeight: 0 }}>
            <Image src="/dashboard-icons/flag-sv.png" alt="" width={20} height={20} />
          </button>
        </div>
        <Button type="text" icon={<LogoutOutlined />} onClick={onLogout} style={{ color: '#dd4b39' }}>
          {t('logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', background: '#f5f7fa' }}>
      {!isMobile && (
        <Sider
          width={collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_COLLAPSED}
          theme="light"
          style={{
            background: '#fff',
            borderRight: '1px solid #eef0f3',
            height: '100vh',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {sidebarMarkup}
        </Sider>
      )}

      <Drawer
        open={isMobile && drawerOpen}
        placement="left"
        width={SIDEBAR_WIDTH}
        onClose={() => setDrawerOpen(false)}
        styles={{
          body: { padding: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' },
          header: { display: 'none' },
        }}
      >
        {sidebarMarkup}
      </Drawer>

      <Layout style={{ background: '#f5f7fa', height: '100vh', overflow: 'hidden' }}>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #eef0f3',
            padding: '0 24px 0 16px',
            height: 60,
            lineHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 50,
          }}
        >
          {/* Live-dot pulse keyframes (scoped by class name). */}
          <style>{`@keyframes fpPulse{0%{box-shadow:0 0 0 0 rgba(82,196,26,.5)}70%{box-shadow:0 0 0 5px rgba(82,196,26,0)}100%{box-shadow:0 0 0 0 rgba(82,196,26,0)}}.fp-live-dot{animation:fpPulse 2s infinite}`}</style>

          {/* LEFT — menu toggle + breadcrumb + company badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#01b9d0', fontSize: 20 }} />}
              aria-label="Toggle navigation"
              onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: '#8c8c8c' }}>{t('administration')}</span>
              <RightOutlined style={{ fontSize: 9, color: '#bbb' }} />
              <Text
                strong
                style={{ fontSize: 16, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {matchedTitle}
              </Text>
            </div>
            {!isMobile && tenant?.name && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#e6f7fa',
                  borderRadius: 6,
                  padding: '4px 10px',
                  marginLeft: 4,
                  flexShrink: 0,
                }}
              >
                <span className="fp-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-poppins)', fontSize: 11, fontWeight: 600, color: '#595959' }}>{tenant.name}</span>
              </span>
            )}
          </div>

          {/* RIGHT — locale + bell + settings + avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LocaleSwitcher />
            <button
              type="button"
              aria-label="Warnings"
              onClick={() => router.push('/admin/results/warning')}
              style={{ position: 'relative', width: 32, height: 32, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#5b666c' }}
            >
              <BellOutlined style={{ fontSize: 16 }} />
              {unreadAlerts > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#ff4d4f', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1 }}>
                  {unreadAlerts > 99 ? '99+' : unreadAlerts}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={t('company_setup')}
              onClick={() => router.push('/admin/profile')}
              style={{ width: 32, height: 32, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#5b666c' }}
            >
              <SettingOutlined style={{ fontSize: 16 }} />
            </button>
            <Popover content={profilePopover} placement="bottomRight" trigger="click">
              <button
                type="button"
                aria-label="Account"
                style={{ width: 32, height: 32, borderRadius: '50%', border: 0, background: AVATAR_GRADIENT, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-poppins)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}
              >
                {initialsOf(me.name, me.email)}
              </button>
            </Popover>
          </div>
        </Header>

        <ImpersonationBanner />
        {me?.isAdmin && <AdminSocketProvider />}

        {/* Only this region scrolls — header + sidebar stay fixed. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Content style={{ flex: 1, padding: isMobile ? 16 : 24, background: '#f5f7fa' }}>
            {children}
          </Content>

          <footer
            style={{
              borderTop: '1px solid #eef0f3',
              background: '#fff',
              padding: isMobile ? '12px 16px' : '12px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#888',
              fontSize: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span>Copyright © {new Date().getFullYear()} FP Analyzer. All Rights Reserved.</span>
            <span style={{ color: '#01b9d0' }}>Developed By Flow Process Sweden AB</span>
          </footer>
        </div>
      </Layout>
    </Layout>
  );
}

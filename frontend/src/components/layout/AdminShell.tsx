'use client';

import {
  AppstoreOutlined,
  BarChartOutlined,
  BulbOutlined,
  CommentOutlined,
  EditOutlined,
  HomeOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  ProjectOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  TagOutlined,
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
const COMPANY_SIDEBAR: SidebarItem[] = [
  { key: '/admin/dashboard', icon: <HomeOutlined />, labelKey: 'administration', href: '/admin/dashboard' },
  {
    key: 'user-mgmt',
    icon: <TeamOutlined />,
    labelKey: 'user_management',
    children: [
      { key: '/admin/access/users',         labelKey: 'users',         href: '/admin/access/users' },
      { key: '/admin/access/salary-groups', labelKey: 'salary_group',  href: '/admin/access/salary-groups' },
    ],
  },
  { key: '/admin/types', icon: <TagOutlined />, labelKey: 'type_management', href: '/admin/types' },
  {
    key: 'equipment-mgmt',
    icon: <ToolOutlined />,
    labelKey: 'equipment_management',
    children: [
      { key: '/admin/equipment',               labelKey: 'equipment_list',      href: '/admin/equipment' },
      { key: '/admin/equipment/tree',          labelKey: 'equipment_structure', href: '/admin/equipment/tree' },
      { key: '/admin/equipment/stop-reasons',  labelKey: 'stop_reasons',        href: '/admin/equipment/stop-reasons' },
      { key: '/admin/equipment/scrap-reasons', labelKey: 'scrap_reasons',       href: '/admin/equipment/scrap-reasons' },
    ],
  },
  {
    key: 'flow-mgmt',
    icon: <NodeIndexOutlined />,
    labelKey: 'flow_management',
    children: [
      { key: '/admin/flow-designs',  labelKey: 'flow_designer', href: '/admin/flow-designs' },
      { key: '/admin/monitor',       labelKey: 'flow_monitor',  href: '/admin/monitor' },
      { key: '/admin/analyzer',      labelKey: 'flow_analyzer', href: '/admin/analyzer' },
    ],
  },
  {
    key: 'production-mgmt',
    icon: <AppstoreOutlined />,
    labelKey: 'production_management',
    children: [
      { key: '/admin/orders',          labelKey: 'order_list',     href: '/admin/orders' },
      { key: '/admin/parts',           labelKey: 'parts_list',     href: '/admin/parts' },
      { key: '/admin/work-shifts',     labelKey: 'work_shifts',    href: '/admin/work-shifts' },
      { key: '/admin/shift-schedules', labelKey: 'shift_schedule', href: '/admin/shift-schedules' },
    ],
  },
  {
    key: 'result-mgmt',
    icon: <BarChartOutlined />,
    labelKey: 'result_management',
    children: [
      { key: '/admin/results/production', labelKey: 'production_data', href: '/admin/results/production' },
      { key: '/admin/results/scrap',      labelKey: 'scrap_data',      href: '/admin/results/scrap' },
      { key: '/admin/results/stop',       labelKey: 'stop_data',       href: '/admin/results/stop' },
      { key: '/admin/results/warning',    labelKey: 'warning_data',    href: '/admin/results/warning' },
    ],
  },
  {
    key: 'boards',
    icon: <LineChartOutlined />,
    labelKey: 'board',
    children: [
      { key: '/admin/boards', labelKey: 'dashboard_creator', href: '/admin/boards' },
    ],
  },
  // "Loss Model" group removed per operator request — re-add here if the
  // Loss by Order No. report needs to come back into the sidebar.
  { key: '/admin/iot/setup', icon: <SettingOutlined />, labelKey: 'setup_units', href: '/admin/iot/setup' },
  { key: '/admin/feedback',  icon: <CommentOutlined />, labelKey: 'feedback',    href: '/admin/feedback' },
];

// ── Locale switcher ───────────────────────────────────────────────────────
// Reads and writes the NEXT_LOCALE cookie on the client; page reload causes
// the server to re-read it via i18n/request.ts and serve the correct locale.
function LocaleSwitcher() {
  const [locale, setLocale] = useState<'sv' | 'en'>(() => {
    if (typeof document === 'undefined') return 'sv';
    const m = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return (m?.[1] === 'en' ? 'en' : 'sv');
  });

  const toggle = () => {
    const next = locale === 'sv' ? 'en' : 'sv';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocale(next);
    window.location.reload();
  };

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
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {!isMobile && (
        <Sider
          width={collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_COLLAPSED}
          theme="light"
          style={{
            background: '#fff',
            borderRight: '1px solid #eef0f3',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
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

      <Layout style={{ background: '#f5f7fa' }}>
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
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#01b9d0', fontSize: 20 }} />}
              aria-label="Toggle navigation"
              onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
            />
            <Text strong style={{ fontSize: 18, color: '#333' }}>{matchedTitle}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LocaleSwitcher />
            <Popover content={profilePopover} placement="bottomRight" trigger="click">
              <Avatar
                size={36}
                style={{ background: '#f5f7fa', border: '1px solid #eef0f3', cursor: 'pointer' }}
                src={brand.logoSmall}
                alt={me.name}
              />
            </Popover>
          </div>
        </Header>

        <ImpersonationBanner />
        {me?.isAdmin && <AdminSocketProvider />}
        <Content style={{ padding: isMobile ? 16 : 24, background: '#f5f7fa' }}>
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
      </Layout>
    </Layout>
  );
}

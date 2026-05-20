'use client';

import {
  AppstoreOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Spin, Typography } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useMemo, useState } from 'react';
import { toApiError } from '../../lib/api-client';
import { useLogout, useMe } from '../../lib/api/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError } = useMe();
  const logout = useLogout();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = useMemo(() => {
    const items: Array<{ key: string; href: string; icon: ReactNode; label: string }> = [
      { key: '/dashboard', href: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/equipment', href: '/equipment', icon: <AppstoreOutlined />, label: 'Equipment' },
    ];
    if (me?.isAdmin) {
      items.push({
        key: '/admin/tenants',
        href: '/admin/tenants',
        icon: <SettingOutlined />,
        label: 'Tenants (admin)',
      });
    }
    return items;
  }, [me?.isAdmin]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <Spin />
      </div>
    );
  }

  // If /me failed (e.g. 401 raced past middleware), bounce to login.
  if (isError || !me) {
    router.replace('/login');
    return null;
  }

  const onLogout = async () => {
    try {
      await logout.mutateAsync();
      message.success('Signed out.');
      router.replace('/login');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  // activeTenantId: for Company users = their own user.id;
  //                 for sub-Users = their companyId (the Company user's id);
  //                 for Administrators = the X-Tenant-Id header value (Company user id).
  // `tenants[]` is now a one-row synthetic array — see MIGRATION_NOTES §13.
  const activeTenant = me.tenants.find((t) => t.id === me.activeTenantId);

  const selectedKeys = navItems
    .filter((i) => pathname === i.key || pathname.startsWith(`${i.key}/`))
    .map((i) => i.key);

  // Shared sidebar navigation body
  const sidebarNav = (
    <>
      <div
        style={{
          color: '#fff',
          padding: '20px 16px 12px',
          borderBottom: '1px solid #303030',
        }}
      >
        <Text strong style={{ color: '#fff', fontSize: 16 }}>
          FP Analyzer
        </Text>
        <div style={{ fontSize: 11, color: '#888' }}>v0.1.0 · Phase 4 dev</div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selectedKeys}
        onClick={() => isMobile && setDrawerOpen(false)}
        items={navItems.map((i) => ({
          key: i.key,
          icon: i.icon,
          label: <Link href={i.href}>{i.label}</Link>,
        }))}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      {/* Desktop sidebar — hidden on mobile (collapses to 0 via breakpoint) */}
      {!isMobile && (
        <Sider
          breakpoint="lg"
          collapsedWidth={0}
          width={240}
          style={{ background: '#1f1f1f' }}
        >
          {sidebarNav}
        </Sider>
      )}

      {/* Mobile drawer */}
      <Drawer
        open={isMobile && drawerOpen}
        placement="left"
        width={240}
        onClose={() => setDrawerOpen(false)}
        styles={{
          body: { padding: 0, background: '#1f1f1f' },
          header: { display: 'none' },
        }}
      >
        {sidebarNav}
      </Drawer>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: isMobile ? '0 12px' : '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Space size={isMobile ? 8 : 'middle'} align="center">
            {/* Hamburger — mobile only */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 20 }} />}
                onClick={() => setDrawerOpen(true)}
                style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Open navigation"
              />
            )}
            {/* Tenant info — hide on very small screens */}
            {!isMobile && (
              <>
                <Text type="secondary">Tenant:</Text>
                <Text strong>{activeTenant?.name ?? (me.isAdmin ? 'platform (admin)' : '—')}</Text>
                {activeTenant && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ({activeTenant.timezone})
                  </Text>
                )}
              </>
            )}
          </Space>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Sign out',
                  onClick: onLogout,
                },
              ],
            }}
          >
            <Button icon={<UserOutlined />} type="text">
              {isMobile ? '' : me.name}
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: isMobile ? 16 : 24, background: '#f5f5f7' }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

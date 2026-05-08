'use client';

import {
  AppstoreOutlined,
  BarChartOutlined,
  CommentOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  MonitorOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { App, Button, Drawer, Dropdown, Grid, Layout, Menu, Spin, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { brand } from '../../lib/assets';
import { toApiError } from '../../lib/api-client';
import { useLogout, useMe } from '../../lib/api/auth';

const { Header, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * UserShell — operator-facing top-nav layout. Lighter than AdminShell.
 * Mirrors the legacy frontend.layouts.master + nav.blade.php IA: a logged-in
 * operator sees: My Dashboard, My Result, Monitor, Analyzer, Units, Machines,
 * Orders, Boards, Feedback. No persistent sidebar; per-page side panels (e.g.
 * Flow Monitor's selected-node panel) come from the page itself.
 *
 * Mobile (< md = 768px): nav collapses into a drawer.
 */
export function UserShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError } = useMe();
  const logout = useLogout();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMobile = !screens.md;

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

  const navItems = [
    { key: '/dashboard',       icon: <DashboardOutlined />,  label: <Link href="/dashboard">Dashboard</Link> },
    { key: '/myresult',        icon: <BarChartOutlined />,   label: <Link href="/myresult">My result</Link> },
    { key: '/monitor',         icon: <MonitorOutlined />,    label: <Link href="/monitor">Monitor</Link> },
    { key: '/analyzer',        icon: <LineChartOutlined />,  label: <Link href="/analyzer">Analyzer</Link> },
    { key: '/units',           icon: <DesktopOutlined />,    label: <Link href="/units">Units</Link> },
    { key: '/machines',        icon: <FolderOpenOutlined />, label: <Link href="/machines">Machines</Link> },
    { key: '/orders',          icon: <ShoppingCartOutlined />, label: <Link href="/orders">Orders</Link> },
    { key: '/boards',          icon: <AppstoreOutlined />,   label: <Link href="/boards">Boards</Link> },
    { key: '/feedback',        icon: <CommentOutlined />,    label: <Link href="/feedback">Feedback</Link> },
  ];

  const selectedKeys = navItems
    .filter((i) => pathname === i.key || pathname.startsWith(`${i.key}/`))
    .map((i) => i.key);

  const onLogout = async () => {
    try {
      await logout.mutateAsync();
      message.success('Signed out.');
      router.replace('/login');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const userMenu = (
    <Menu
      items={[
        { key: 'profile', icon: <UserOutlined />, label: <Link href="/profile/edit">Profile</Link> },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: onLogout },
      ]}
    />
  );

  const activeTenant = me.tenants.find((t) => t.id === me.activeTenantId);

  const navMenu = (
    <Menu
      mode={isMobile ? 'inline' : 'horizontal'}
      selectedKeys={selectedKeys}
      items={navItems}
      style={{ borderBottom: 'none', flex: 1 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          />
        )}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src={brand.logo}
            alt="FP Analyzer"
            width={140}
            height={36}
            priority
            style={{ height: 36, width: 'auto' }}
          />
        </Link>
        {!isMobile && navMenu}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeTenant && !isMobile && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {activeTenant.name} · {activeTenant.timezone}
            </Text>
          )}
          <Dropdown overlay={userMenu} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {!isMobile && me.firstName}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Drawer
        open={drawerOpen}
        placement="left"
        onClose={() => setDrawerOpen(false)}
        title="Menu"
        width={260}
      >
        {navMenu}
      </Drawer>

      <Content style={{ padding: '16px 24px 24px', background: '#ecf0f5' }}>{children}</Content>
    </Layout>
  );
}

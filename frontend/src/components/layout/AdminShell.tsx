'use client';

import {
  AppstoreOutlined,
  BankOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
  FormOutlined,
  ImportOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NodeIndexOutlined,
  NotificationOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TagOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Breadcrumb,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Spin,
  Typography,
} from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useMemo, useState } from 'react';
import { brand } from '../../lib/assets';
import { toApiError } from '../../lib/api-client';
import { useLogout, useMe } from '../../lib/api/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export interface AdminShellProps {
  children: ReactNode;
  /** Optional breadcrumb items beyond the auto "Dashboard" root. */
  breadcrumb?: { title: string; href?: string }[];
}

/**
 * AdminShell — AntD Layout equivalent of AdminLTE 2.
 *
 * IA mirrors the legacy resources/views/backend/includes/sidebar.blade.php:
 *  - Dashboard / Boards
 *  - Flow management (designs, monitor, analyzer, loss model)
 *  - Equipment management (list, tree, stop reasons, scrap reasons)
 *  - Production management (parts, orders, shifts, schedules)
 *  - Result management (production, scrap, stop, warning)
 *  - Type management
 *  - Companies / Users / Salary group
 *  - CMS / Content (cms, sliders, testimonials, symbols)
 *  - IoT setup / Machines / Files
 *  - Import-export / Notifications
 *  - Access (users, roles, tenants)
 *
 * Responsive: at < 992px the sider becomes a Drawer triggered from the header.
 */
export function AdminShell({ children, breadcrumb = [] }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isLoading, isError } = useMe();
  const logout = useLogout();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMobile = !screens.lg; // < 992px

  const menuItems = useMemo(
    () => [
      {
        key: '/admin',
        icon: <DashboardOutlined />,
        label: <Link href="/admin">Dashboard</Link>,
      },
      {
        key: 'flow',
        icon: <NodeIndexOutlined />,
        label: 'Flow management',
        children: [
          { key: '/admin/flow-designs', label: <Link href="/admin/flow-designs">Flow designs</Link> },
          { key: '/admin/flow-monitor', label: <Link href="/admin/flow-monitor">Flow monitor</Link> },
          { key: '/admin/flow-analyzer', label: <Link href="/admin/flow-analyzer">Flow analyzer</Link> },
          { key: '/admin/loss-model', label: <Link href="/admin/loss-model">Loss model</Link> },
        ],
      },
      {
        key: 'equipment-mgmt',
        icon: <ClusterOutlined />,
        label: 'Equipment',
        children: [
          { key: '/admin/equipment', label: <Link href="/admin/equipment">Equipment list</Link> },
          { key: '/admin/equipment/stop-reasons', label: <Link href="/admin/equipment/stop-reasons">Stop reasons</Link> },
          { key: '/admin/equipment/scrap-reasons', label: <Link href="/admin/equipment/scrap-reasons">Scrap reasons</Link> },
        ],
      },
      {
        key: 'production',
        icon: <AppstoreOutlined />,
        label: 'Production',
        children: [
          { key: '/admin/parts', label: <Link href="/admin/parts">Parts</Link> },
          { key: '/admin/orders', label: <Link href="/admin/orders">Orders</Link> },
          { key: '/admin/work-shifts', label: <Link href="/admin/work-shifts">Work shifts</Link> },
          { key: '/admin/shift-schedules', label: <Link href="/admin/shift-schedules">Shift schedules</Link> },
        ],
      },
      {
        key: 'results',
        icon: <BarChartOutlined />,
        label: 'Results',
        children: [
          { key: '/admin/results/production', label: <Link href="/admin/results/production">Production data</Link> },
          { key: '/admin/results/scrap',      label: <Link href="/admin/results/scrap">Scrap data</Link> },
          { key: '/admin/results/stop',       label: <Link href="/admin/results/stop">Stop data</Link> },
          { key: '/admin/results/warning',    label: <Link href="/admin/results/warning">Warning data</Link> },
        ],
      },
      {
        key: '/admin/types',
        icon: <TagOutlined />,
        label: <Link href="/admin/types">Types</Link>,
      },
      {
        key: 'machines',
        icon: <ToolOutlined />,
        label: 'Machines',
        children: [
          { key: '/admin/machines',         label: <Link href="/admin/machines">Machines</Link> },
          { key: '/admin/machine-files',    label: <Link href="/admin/machine-files">Machine files</Link> },
          { key: '/admin/machine-programmes', label: <Link href="/admin/machine-programmes">Programmes</Link> },
          { key: '/admin/workstations',     label: <Link href="/admin/workstations">Workstations</Link> },
        ],
      },
      {
        key: '/admin/folders',
        icon: <FolderOpenOutlined />,
        label: <Link href="/admin/folders">Files / Folders</Link>,
      },
      {
        key: 'cms',
        icon: <FormOutlined />,
        label: 'Content',
        children: [
          { key: '/admin/cms',          label: <Link href="/admin/cms">CMS pages</Link> },
          { key: '/admin/sliders',      label: <Link href="/admin/sliders">Sliders</Link> },
          { key: '/admin/testimonials', label: <Link href="/admin/testimonials">Testimonials</Link> },
          { key: '/admin/symbols',      label: <Link href="/admin/symbols">Symbols</Link> },
        ],
      },
      {
        key: '/admin/boards',
        icon: <LineChartOutlined />,
        label: <Link href="/admin/boards">Boards</Link>,
      },
      {
        key: 'iot',
        icon: <NotificationOutlined />,
        label: 'IoT',
        children: [
          { key: '/admin/iot/setup',         label: <Link href="/admin/iot/setup">Setup units</Link> },
          { key: '/admin/iot/software',      label: <Link href="/admin/iot/software">Firmware</Link> },
          { key: '/admin/iot/auto-register', label: <Link href="/admin/iot/auto-register">Auto-register</Link> },
        ],
      },
      {
        key: '/admin/import-export',
        icon: <FileExcelOutlined />,
        label: <Link href="/admin/import-export">Import / Export</Link>,
      },
      {
        key: 'access',
        icon: <SafetyCertificateOutlined />,
        label: 'Access',
        children: [
          { key: '/admin/access/users', label: <Link href="/admin/access/users">Users</Link> },
          { key: '/admin/access/roles', label: <Link href="/admin/access/roles">Roles</Link> },
          { key: '/admin/tenants',      label: <Link href="/admin/tenants">Tenants</Link> },
        ],
      },
      {
        key: '/admin/feedback',
        icon: <ProfileOutlined />,
        label: <Link href="/admin/feedback">Feedback</Link>,
      },
    ],
    [],
  );

  const selectedKeys = useMemo(() => {
    // Match longest matching menu key to handle nested routes.
    const flatten = (items: typeof menuItems): string[] =>
      items.flatMap((i) => ('children' in i && i.children ? flatten(i.children as typeof menuItems) : [i.key]));
    const keys = flatten(menuItems);
    return keys
      .filter((k) => pathname === k || pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)
      .slice(0, 1);
  }, [pathname, menuItems]);

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
        { key: 'profile', icon: <UserOutlined />, label: <Link href="/admin/profile">Profile</Link> },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: onLogout },
      ]}
    />
  );

  const sidebarMenu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      items={menuItems}
      style={{ borderRight: 0 }}
    />
  );

  const brandHeader = (
    <Link
      href="/admin"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 64,
        padding: collapsed && !isMobile ? '0' : '0 16px',
        background: '#1a2226',
        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}
    >
      <Image
        src={brand.logoSmall}
        alt="FP Analyzer"
        width={32}
        height={32}
        style={{ width: 32, height: 'auto', marginRight: collapsed && !isMobile ? 0 : 12 }}
      />
      {!(collapsed && !isMobile) && (
        <Text strong style={{ color: '#fff', fontSize: 16 }}>
          FP Analyzer
        </Text>
      )}
    </Link>
  );

  const breadcrumbItems = [
    { title: <Link href="/admin">Admin</Link> },
    ...breadcrumb.map((b) => ({
      title: b.href ? <Link href={b.href}>{b.title}</Link> : b.title,
    })),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          collapsedWidth={80}
          breakpoint="lg"
          style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
        >
          {brandHeader}
          {sidebarMenu}
        </Sider>
      )}

      <Drawer
        open={isMobile && drawerOpen}
        placement="left"
        width={260}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0, background: '#222d32' }, header: { display: 'none' } }}
      >
        {brandHeader}
        {sidebarMenu}
      </Drawer>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 16px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <Button
            type="text"
            aria-label={collapsed || isMobile ? 'Expand navigation' : 'Collapse navigation'}
            icon={
              isMobile
                ? <MenuUnfoldOutlined />
                : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
            }
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
            style={{ fontSize: 18, width: 64, height: 64 }}
          />
          <Dropdown overlay={userMenu} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />} style={{ height: 48 }}>
              {me.name}
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ padding: '16px 24px 24px', background: '#ecf0f5' }}>
          {breadcrumb.length > 0 && (
            <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 16 }} />
          )}
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

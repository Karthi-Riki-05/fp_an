'use client';

import { App, Button, Card, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toApiError } from '../../../lib/api-client';
import { useLogout, useMe } from '../../../lib/api/auth';
import { canAccessBackend } from '../../../lib/auth';
import { SettingsUnitsList } from '../../../components/dashboard/SettingsUnitsList';

const { Title, Text } = Typography;

type Locale = 'en' | 'sv';

const L = {
  sv: {
    pageTitle:    'Min Startsida',
    tabStart:     'Startsida',
    tabProfile:   'Min profil',
    tabSettings:  'Inställningar',
    welcome:      'Välkommen',
    units:        'Enheter',
    flowMonitor:  'Flödesupptagning',
    flowAnalyzer: 'Flödesanalys',
    myResult:     'Resultat',
    orders:       'Ordrar',
    changePass:   'Byt lösenord',
    feedback:     'Feedback',
    logout:       'Logga ut',
    admin:        'Adminpanelen',
    boards:       'Dashboard',
    profileImage: 'Profilbild',
    name:         'Namn',
    firstName:    'Förnamn',
    lastName:     'Efternamn',
    email:        'E-post',
    created:      'Skapad',
    updated:      'Senast uppdaterad',
    actions:      'Hantera',
    editProfile:  'Redigera profil',
    save:         'Spara',
    onSignal:     'Driftsignal',
    offSignal:    'Stopsignal',
    warningSig:   'Varning',
    saved:        'Sparad',
  },
  en: {
    pageTitle:    'My Startpage',
    tabStart:     'Startpage',
    tabProfile:   'My Profile',
    tabSettings:  'Settings',
    welcome:      'Welcome',
    units:        'Units',
    flowMonitor:  'Flow Monitor',
    flowAnalyzer: 'Flow Analyzer',
    myResult:     'My Result',
    orders:       'Orders',
    changePass:   'Change Password',
    feedback:     'Feedback',
    logout:       'Logout',
    admin:        'Administration',
    boards:       'Boards',
    profileImage: 'Profile image',
    name:         'Name',
    firstName:    'First name',
    lastName:     'Last name',
    email:        'Email',
    created:      'Created',
    updated:      'Last updated',
    actions:      'Actions',
    editProfile:  'Edit profile',
    save:         'Save',
    onSignal:     'On signal',
    offSignal:    'Off signal',
    warningSig:   'Warning signal',
    saved:        'Saved',
  },
} as const;

interface Tile {
  key: string;
  href: string;
  icon: string;
  label: keyof (typeof L)['en'];
  external?: boolean;
}

const TILES: Tile[] = [
  { key: 'units',         href: '/units',        icon: '/dashboard-icons/units.png',         label: 'units' },
  { key: 'flow-monitor',  href: '/monitor',      icon: '/dashboard-icons/flow-monitor.png',  label: 'flowMonitor' },
  { key: 'flow-analyzer', href: '/analyzer',     icon: '/dashboard-icons/flow-analyzer.png', label: 'flowAnalyzer' },
  { key: 'myresult',      href: '/myresult',     icon: '/dashboard-icons/myresult.png',      label: 'myResult' },
  { key: 'orders',        href: '/orders',       icon: '/dashboard-icons/orders.png',        label: 'orders' },
  { key: 'password',      href: '/profile/password', icon: '/dashboard-icons/password.png', label: 'changePass' },
  { key: 'feedback',      href: '/feedback',     icon: '/dashboard-icons/feedback.png',      label: 'feedback' },
  { key: 'logout',        href: '#logout',       icon: '/dashboard-icons/logout.png',        label: 'logout' },
  { key: 'admin',         href: '/admin',        icon: '/dashboard-icons/admin.png',         label: 'admin' },
  { key: 'boards',        href: '/boards',       icon: '/dashboard-icons/dashboard.png',     label: 'boards' },
];

export default function DashboardPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initialTab = (search.get('tab') as 'startpage' | 'myprofile' | 'settings' | null) ?? 'startpage';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { data: me, isLoading } = useMe();
  const logout = useLogout();
  const { message } = App.useApp();
  const [locale, setLocale] = useState<Locale>('sv');
  const t = L[locale];

  const onTab = (key: string) => {
    setActiveTab(key as typeof activeTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState({}, '', url.toString());
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      router.push('/login');
    } catch (err) {
      message.error(toApiError(err).message);
    }
  };

  const handleTileClick = (tile: Tile, e: React.MouseEvent) => {
    if (tile.key === 'logout') {
      e.preventDefault();
      handleLogout();
    }
  };

  // Administration tile follows the legacy @permission('view-backend')
  // gate — visible to Administrator (all=true) and Company roles.
  const showAdmin = canAccessBackend(me);
  const visibleTiles = useMemo(() => {
    if (!me) return [];
    return TILES.filter((tile) => {
      if (tile.key === 'admin' && !showAdmin) return false;
      return true;
    });
  }, [me, showAdmin]);

  // ---- Tab 1: Startpage (tile launcher) ----
  const StartpageTab = (
    <div style={{ padding: '32px 16px 48px', textAlign: 'center' }}>
      <Title level={4} style={{ fontWeight: 400, color: '#1f1f1f', marginBottom: 32 }}>
        {t.welcome} {me?.name ?? ''}
      </Title>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          maxWidth: 900,
          margin: '0 auto',
          justifyItems: 'center',
        }}
      >
        {visibleTiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            onClick={(e) => handleTileClick(tile, e)}
            style={{ textDecoration: 'none' }}
          >
            <div
              className="fp-tile"
              style={{
                width: 140,
                padding: 16,
                borderRadius: 12,
                background: '#fff',
                border: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: '#fafafa',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Image src={tile.icon} alt="" width={64} height={64} />
              </div>
              <Text style={{ color: '#333', fontWeight: 500, fontSize: 13, textAlign: 'center' }}>
                {t[tile.label]}
              </Text>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  // ---- Tab 2: My Profile ----
  const ProfileTab = (
    <div style={{ padding: 16 }}>
      <Table
        showHeader={false}
        pagination={false}
        bordered
        size="middle"
        rowKey={(_, idx) => String(idx)}
        dataSource={[
          {
            label: t.profileImage,
            value: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Image
                  src="/dashboard-icons/no-image.jpeg"
                  alt=""
                  width={64}
                  height={64}
                  style={{ borderRadius: 4 }}
                />
                <Space size={6}>
                  <button
                    type="button"
                    onClick={() => setLocale('en')}
                    aria-label="English"
                    style={{
                      border: locale === 'en' ? '2px solid #01b9d0' : '1px solid #ddd',
                      background: 'transparent',
                      padding: 2,
                      cursor: 'pointer',
                      lineHeight: 0,
                    }}
                  >
                    <Image src="/dashboard-icons/flag-en.png" alt="" width={24} height={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('sv')}
                    aria-label="Svenska"
                    style={{
                      border: locale === 'sv' ? '2px solid #01b9d0' : '1px solid #ddd',
                      background: 'transparent',
                      padding: 2,
                      cursor: 'pointer',
                      lineHeight: 0,
                    }}
                  >
                    <Image src="/dashboard-icons/flag-sv.png" alt="" width={24} height={24} />
                  </button>
                </Space>
              </div>
            ),
          },
          { label: t.name,      value: me?.name },
          { label: t.firstName, value: me?.firstName },
          { label: t.lastName,  value: me?.lastName ?? '' },
          { label: t.email,     value: me?.email },
          { label: t.created,   value: '—' },
          { label: t.updated,   value: '—' },
          {
            label: t.actions,
            value: (
              <Space>
                <Link href="/profile/edit">
                  <Button type="primary" size="small">{t.editProfile}</Button>
                </Link>
                <Link href="/profile/password">
                  <Button size="small" style={{ background: '#f0ad4e', color: '#fff', borderColor: '#eea236' }}>
                    {t.changePass}
                  </Button>
                </Link>
              </Space>
            ),
          },
        ]}
        columns={[
          {
            dataIndex: 'label',
            width: 220,
            render: (v: string) => <Text strong style={{ color: '#333' }}>{v}</Text>,
          },
          { dataIndex: 'value' },
        ]}
      />
    </div>
  );

  // ---- Tab 3: Settings (units) ----
  // Renders the real /api/v1/units list (already filtered to configured
  // units server-side), with drag-to-reorder + per-unit checkbox.
  // Selection persists via /me/settings/table → unit_web_settings.units,
  // and is honoured by the /units page.
  const SettingsTab = (
    <SettingsUnitsList
      labels={{
        onSignal: t.onSignal,
        offSignal: t.offSignal,
        warningSig: t.warningSig,
        save: t.save,
        saved: t.saved,
        units: t.units,
      }}
    />
  );

  return (
    <div style={{ maxWidth: 1180, margin: '24px auto 0', padding: '0 16px' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            background: '#0a8aa0',
            color: '#fff',
            padding: '14px 20px',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {t.pageTitle}
        </div>

        {isLoading ? (
          <div style={{ padding: 24 }}>
            <Skeleton active />
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={onTab}
            tabBarStyle={{ padding: '0 16px', margin: 0, borderBottom: '1px solid #f0f0f0' }}
            items={[
              { key: 'startpage', label: t.tabStart,    children: StartpageTab },
              { key: 'myprofile', label: t.tabProfile,  children: ProfileTab },
              { key: 'settings',  label: t.tabSettings, children: SettingsTab },
            ]}
          />
        )}
      </div>

      <style jsx global>{`
        .fp-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 118, 141, 0.15);
          border-color: #01b9d0 !important;
        }
      `}</style>
    </div>
  );
}

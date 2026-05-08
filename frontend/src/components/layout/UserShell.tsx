'use client';

import { Layout, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { useMe } from '../../lib/api/auth';
import { MarketingFooter } from './MarketingFooter';
import { MarketingHeader } from './MarketingHeader';

const { Content } = Layout;

interface Props {
  children: ReactNode;
  locale?: 'en' | 'sv';
}

/**
 * UserShell — wraps every authenticated operator page. Same visual chrome
 * as PublicShell (matches the legacy frontend.layouts.master), with the
 * authenticated-user dropdown surfaced via MarketingHeader's me-aware
 * right-side widget. Operators access feature pages via the dashboard tile
 * launcher, NOT via a persistent sidebar — that mirrors the legacy IA.
 */
export function UserShell({ children, locale = 'sv' }: Props) {
  const router = useRouter();
  const { data: me, isLoading, isError } = useMe();

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <MarketingHeader locale={locale} />
      <Content style={{ background: '#ecf0f5' }}>{children}</Content>
      <MarketingFooter locale={locale} />
    </Layout>
  );
}

'use client';

import { Layout } from 'antd';
import { ReactNode } from 'react';
import { MarketingFooter } from './MarketingFooter';
import { MarketingHeader } from './MarketingHeader';

const { Content } = Layout;

interface Props {
  children: ReactNode;
  /** Hide the marketing nav (used for /login). The header still renders the
   *  logo + home icon, just no nav links or sign-in button. */
  minimal?: boolean;
  locale?: 'en' | 'sv';
}

/**
 * PublicShell — used for /, /faq, /login, /register, /privacy_policy,
 * /terms_conditions, /roi-kalkyl. Same teal header + footer as UserShell,
 * just no authenticated user dropdown.
 */
export function PublicShell({ children, minimal = false, locale = 'sv' }: Props) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!minimal && <MarketingHeader locale={locale} />}
      <Content style={{ background: '#ecf0f5' }}>{children}</Content>
      <MarketingFooter locale={locale} />
    </Layout>
  );
}

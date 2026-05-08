'use client';

import { Button, Layout, Space, Typography } from 'antd';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { brand } from '../../lib/assets';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

interface Props {
  children: ReactNode;
  /** Hide the marketing nav (used for /login). */
  minimal?: boolean;
}

/**
 * PublicShell — for the marketing site, login, register, password reset.
 * Mirrors the legacy frontend.layouts.master IA: top nav with logo + links
 * + Login button, footer with brand info. No sidebar.
 */
export function PublicShell({ children, minimal = false }: Props) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src={brand.logo}
            alt="FP Analyzer"
            width={140}
            height={36}
            priority
            style={{ height: 36, width: 'auto' }}
          />
        </Link>
        {!minimal && (
          <Space size="middle">
            <Link href="/" passHref legacyBehavior>
              <Button type="text">Home</Button>
            </Link>
            <Link href="/faq" passHref legacyBehavior>
              <Button type="text">FAQ</Button>
            </Link>
            <Link href="/roi-kalkyl" passHref legacyBehavior>
              <Button type="text">ROI</Button>
            </Link>
            <Link href="/login" passHref legacyBehavior>
              <Button type="primary">Sign in</Button>
            </Link>
          </Space>
        )}
      </Header>

      <Content style={{ background: '#ecf0f5' }}>{children}</Content>

      <Footer style={{ background: '#1a1a1d', color: '#cfd2d6', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <Space direction="vertical" size={4}>
            <Text strong style={{ color: '#fff' }}>FP Analyzer</Text>
            <Text style={{ color: '#9ca0a6', fontSize: 12 }}>
              Manufacturing OEE platform · Sweden
            </Text>
          </Space>
          <Space size="middle" wrap>
            <Link href="/privacy_policy" style={{ color: '#cfd2d6' }}>Privacy</Link>
            <Link href="/terms_conditions" style={{ color: '#cfd2d6' }}>Terms</Link>
            <Link href="/roi-kalkyl" style={{ color: '#cfd2d6' }}>ROI calculator</Link>
            <Text style={{ color: '#9ca0a6', fontSize: 12 }}>info@fpanalyzer.se</Text>
          </Space>
        </div>
      </Footer>
    </Layout>
  );
}

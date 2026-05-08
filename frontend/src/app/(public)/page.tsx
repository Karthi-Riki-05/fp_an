'use client';

import { Button, Space, Typography } from 'antd';
import Link from 'next/link';

const { Title, Paragraph, Text } = Typography;

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Space direction="vertical" size="middle" style={{ maxWidth: 640 }}>
        <Title level={1} style={{ marginBottom: 0 }}>
          FP Analyzer
        </Title>
        <Text type="secondary">Manufacturing OEE — coming soon</Text>
        <Paragraph type="secondary" style={{ marginTop: 24 }}>
          The dashboard, flow monitor, and admin pages roll out incrementally
          during Phase 4. The login form is live now — sign in with the dev
          credentials shown there.
        </Paragraph>
        <Space>
          <Link href="/login">
            <Button type="primary">Sign in</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </Space>
      </Space>
    </main>
  );
}

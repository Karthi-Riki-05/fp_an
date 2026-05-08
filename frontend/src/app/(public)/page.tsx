'use client';

import { Typography, Space } from 'antd';

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
        <Text type="secondary">Phase 1 scaffold — coming soon</Text>
        <Paragraph type="secondary" style={{ marginTop: 24 }}>
          This is the empty Next.js + Ant Design skeleton. Real pages and
          functionality arrive in Phase 4. See <code>MIGRATION_NOTES.md</code>{' '}
          for the full migration plan.
        </Paragraph>
      </Space>
    </main>
  );
}

'use client';

import { ToolOutlined } from '@ant-design/icons';
import { Card, Empty, Space, Tag, Typography } from 'antd';
import Link from 'next/link';

const { Title, Text } = Typography;

interface Props {
  /** Page title (e.g. "Parts", "Flow Monitor (admin)"). */
  title: string;
  /** Optional sentence describing what this page will do. */
  description?: string;
  /** Legacy Blade reference path, displayed for the porter's reference. */
  legacyRef?: string;
  /** "Phase 4b" by default — overridable for backend-blocked screens. */
  phase?: string;
  /** Optional list of related/sibling links for navigation. */
  related?: { href: string; label: string }[];
}

/**
 * Placeholder used by every nav target that hasn't been ported yet.
 * Keeps the shells navigable so design review doesn't dead-end on 404.
 */
export function ComingSoon({ title, description, legacyRef, phase = 'Phase 4b', related = [] }: Props) {
  return (
    <div>
      <Title level={3} style={{ marginBottom: 4 }}>
        {title}
      </Title>
      <Text type="secondary">
        Will be ported in <Tag color="purple" style={{ marginRight: 0 }}>{phase}</Tag>
      </Text>

      <Card style={{ marginTop: 24 }} bodyStyle={{ padding: 32 }}>
        <Empty
          image={<ToolOutlined style={{ fontSize: 48, color: '#01b9d0' }} />}
          imageStyle={{ height: 60 }}
          description={
            <Space direction="vertical" size="small" style={{ maxWidth: 520 }}>
              <Text strong>Page not yet ported.</Text>
              {description && <Text type="secondary">{description}</Text>}
              {legacyRef && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Legacy reference: <code>{legacyRef}</code>
                </Text>
              )}
            </Space>
          }
        />
        {related.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Related:
            </Text>
            <Space wrap>
              {related.map((r) => (
                <Link key={r.href} href={r.href}>
                  {r.label}
                </Link>
              ))}
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}

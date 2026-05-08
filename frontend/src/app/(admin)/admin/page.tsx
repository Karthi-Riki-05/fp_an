'use client';

import { ArrowRightOutlined } from '@ant-design/icons';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useMe } from '../../../lib/api/auth';

const { Title, Text } = Typography;

const QUICK_LINKS = [
  { href: '/admin/equipment', label: 'Equipment',     desc: 'Tree + list, CRUD' },
  { href: '/admin/tenants',   label: 'Tenants',       desc: 'List + provision new schemas' },
  { href: '/admin/parts',     label: 'Parts',         desc: 'Phase 4b' },
  { href: '/admin/orders',    label: 'Orders',        desc: 'Phase 4b' },
  { href: '/admin/access/users', label: 'Users',      desc: 'Phase 4b' },
  { href: '/admin/access/roles', label: 'Roles',      desc: 'Phase 4b' },
];

export default function AdminDashboardPage() {
  const { data: me } = useMe();

  return (
    <div>
      <Title level={3} style={{ marginBottom: 4 }}>
        Admin
      </Title>
      <Text type="secondary">
        Hello, {me?.firstName ?? me?.name}. {me?.isAdmin && <Tag color="red">Administrator</Tag>}
      </Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {QUICK_LINKS.map((q) => (
          <Col key={q.href} xs={24} sm={12} md={8}>
            <Link href={q.href}>
              <Card hoverable bodyStyle={{ padding: 20 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>{q.label}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{q.desc}</Text>
                    </div>
                  </div>
                  <ArrowRightOutlined style={{ color: '#01b9d0' }} />
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </div>
  );
}

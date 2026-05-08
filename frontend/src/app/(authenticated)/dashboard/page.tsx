'use client';

import { Card, Col, Descriptions, Row, Tag, Typography } from 'antd';
import { useMe } from '../../../lib/api/auth';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { data: me } = useMe();
  if (!me) return null;

  return (
    <div>
      <Title level={2} style={{ marginBottom: 4 }}>
        Hello, {me.firstName || me.name}
      </Title>
      <Text type="secondary">Welcome to FP Analyzer. Phase 4 v1 — minimal viable shell.</Text>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Profile" bordered>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="ID">{me.id}</Descriptions.Item>
              <Descriptions.Item label="Email">{me.email}</Descriptions.Item>
              <Descriptions.Item label="Name">{me.name}</Descriptions.Item>
              <Descriptions.Item label="Confirmed">
                <Tag color={me.confirmed ? 'green' : 'orange'}>
                  {me.confirmed ? 'yes' : 'pending'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Roles">
                {me.roles.map((r) => (
                  <Tag key={r} color="purple">
                    {r}
                  </Tag>
                ))}
                {me.isAdmin && <Tag color="red">super-admin</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Tenants" bordered>
            {me.tenants.length === 0 ? (
              <Text type="secondary">
                {me.isAdmin
                  ? 'You operate at platform scope. Use X-Tenant-Id to act on a tenant, or visit Tenants (admin) to create one.'
                  : 'No tenants assigned.'}
              </Text>
            ) : (
              <Descriptions column={1} size="small">
                {me.tenants.map((t) => (
                  <Descriptions.Item key={t.id} label={t.name}>
                    <Text code>{t.slug}</Text>
                    {' · '}
                    <Text type="secondary">{t.schemaName}</Text>
                    {' · '}
                    <Text type="secondary">{t.timezone}</Text>
                    {me.activeTenantId === t.id && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        active
                      </Tag>
                    )}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

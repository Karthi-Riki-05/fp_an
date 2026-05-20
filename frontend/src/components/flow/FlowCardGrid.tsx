'use client';

import { AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import FlowCard from './FlowCard';
import type { FlowDesignRow } from '../../lib/api/flow-designs';

const { Text } = Typography;

interface Props {
  flows: FlowDesignRow[];
  onFlowClick: (id: number) => void;
  defaultView?: 'grid' | 'list';
  title?: string;
}

export default function FlowCardGrid({ flows, onFlowClick, defaultView = 'grid', title }: Props) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {title ? <Text strong style={{ fontSize: 16 }}>{title}</Text> : <span />}
        <Space>
          <Button
            icon={<AppstoreOutlined />}
            type={viewMode === 'grid' ? 'primary' : 'default'}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          />
          <Button
            icon={<BarsOutlined />}
            type={viewMode === 'list' ? 'primary' : 'default'}
            onClick={() => setViewMode('list')}
            aria-label="List view"
          />
        </Space>
      </div>

      {viewMode === 'grid' ? (
        <Row gutter={[16, 24]}>
          {flows.map((flow) => (
            <Col key={flow.id} xs={24} sm={12} lg={8} xl={6}>
              <FlowCard
                id={flow.id}
                name={flow.name}
                svgCache={flow.svgCache ?? null}
                onClick={() => onFlowClick(flow.id)}
              />
            </Col>
          ))}
        </Row>
      ) : (
        <Table<FlowDesignRow>
          rowKey="id"
          size="middle"
          pagination={{ defaultPageSize: 25 }}
          dataSource={flows}
          onRow={(row) => ({ onClick: () => onFlowClick(row.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Name', dataIndex: 'name', key: 'name' },
            {
              title: 'Status', dataIndex: 'status', key: 'status', width: 110,
              render: (s: number) => <Tag color={s === 1 ? 'success' : 'default'}>{s === 1 ? 'active' : 'inactive'}</Tag>,
            },
            {
              title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 180,
              render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
            },
          ]}
        />
      )}

      {flows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          No active flows yet. Create one from the Flow Designs admin page.
        </div>
      )}
    </>
  );
}

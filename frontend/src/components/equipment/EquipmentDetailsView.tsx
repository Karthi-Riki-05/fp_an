'use client';

import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Descriptions, Empty, Space, Tabs, Tag, Typography } from 'antd';
import { typesApi, salaryGroupsApi, type TenantScope } from '../../lib/api/admin-crud';
import { useEquipmentList, useEquipmentProperties, type EquipmentDetail } from '../../lib/api/equipment';

const { Title, Text } = Typography;

interface Props {
  detail: EquipmentDetail;
  scope: TenantScope;
}

/** Read-only details panel used when the equipment list View (eye) is clicked. */
export default function EquipmentDetailsView({ detail, scope }: Props) {
  const { data: equipmentRows } = useEquipmentList(scope.tenantId);
  const { data: equipmentTypes } = typesApi.useList(scope, { entity: 'Equipment', perPage: 200 });
  const { data: stopTypes }     = typesApi.useList(scope, { entity: 'StopReason', perPage: 200 });
  const { data: scrapTypes }    = typesApi.useList(scope, { entity: 'ScrapReason', perPage: 200 });
  const { data: partTypes }     = typesApi.useList(scope, { entity: 'Part', perPage: 200 });
  const { data: orderTypes }    = typesApi.useList(scope, { entity: 'Order', perPage: 200 });
  const { data: salaryGroups }  = salaryGroupsApi.useList(scope, { perPage: 200 });
  const { data: properties }    = useEquipmentProperties(scope.tenantId, detail.id);

  const parentName = (id: number) => (equipmentRows ?? []).find((r) => r.id === id)?.name ?? `#${id}`;
  const typeName = (id: number) => (equipmentTypes?.data ?? []).find((t) => t.id === id)?.name ?? `#${id}`;
  const nameMap = (rows: Array<{ id: number; name: string | null }> | undefined, ids: number[]) =>
    ids.map((id) => rows?.find((r) => r.id === id)?.name ?? `#${id}`);

  const stopNames  = nameMap(stopTypes?.data,  detail.reasonStopTypeIds  ?? []);
  const scrapNames = nameMap(scrapTypes?.data, detail.reasonScrapTypeIds ?? []);
  const partNames  = nameMap(partTypes?.data,  detail.reasonPartTypeIds  ?? []);
  const orderNames = nameMap(orderTypes?.data, detail.reasonOrderTypeIds ?? []);

  const labelStyle = { width: 180, background: '#fafafa', fontWeight: 500 };

  return (
    <Tabs
      defaultActiveKey="overview"
      items={[
        {
          key: 'overview',
          label: 'Overview',
          children: (
            <Descriptions bordered column={1} size="small" labelStyle={labelStyle}>
              <Descriptions.Item label="Name">{detail.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Parent equipment">
                {detail.parentId ? <Tag>{parentName(detail.parentId)}</Tag> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {detail.typeId ? <Tag color="blue">{typeName(detail.typeId)}</Tag> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {detail.description
                  ? <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</Text>
                  : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Sort order">{detail.sortOrder ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Status">
                {detail.isActive
                  ? <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>
                  : <Tag color="default" icon={<CloseCircleOutlined />}>Inactive</Tag>}
              </Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'assignments',
          label: 'Assignments',
          children: (
            <Descriptions bordered column={1} size="small" labelStyle={labelStyle}>
              <Descriptions.Item label="Stop types">
                {stopNames.length ? <Space wrap size={4}>{stopNames.map((n) => <Tag key={n}>{n}</Tag>)}</Space> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Scrap types">
                {scrapNames.length ? <Space wrap size={4}>{scrapNames.map((n) => <Tag key={n}>{n}</Tag>)}</Space> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Part types">
                {partNames.length ? <Space wrap size={4}>{partNames.map((n) => <Tag key={n}>{n}</Tag>)}</Space> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Order types">
                {orderNames.length ? <Space wrap size={4}>{orderNames.map((n) => <Tag key={n}>{n}</Tag>)}</Space> : <Text type="secondary">—</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Shift schedule">
                {detail.scheduleId
                  ? <Tag>#{detail.scheduleId}{detail.alsoAssignImport ? ' (assign on import)' : ''}</Tag>
                  : <Text type="secondary">—</Text>}
              </Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: 'properties',
          label: `Properties${properties?.length ? ` (${properties.length})` : ''}`,
          children: !properties || properties.length === 0 ? (
            <Empty description="No per-Part-Type properties configured" />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {properties.map((p) => (
                <div key={p.id} style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 12 }}>
                  <Title level={5} style={{ margin: '0 0 8px' }}>
                    {(partTypes?.data ?? []).find((t) => t.id === p.typeId)?.name ?? `Part type #${p.typeId}`}
                  </Title>
                  <Descriptions column={2} size="small" labelStyle={{ fontWeight: 500 }}>
                    <Descriptions.Item label="Order nr selection">
                      <Tag>{p.orderSelection === 'list' ? 'Select from order list' : 'Free Text'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cycle Time">{p.cycleTime || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Per Hour">{p.costPerHour || 0}</Descriptions.Item>
                    <Descriptions.Item label="Currency">{p.currency || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Number of operator">{p.operator || 0}</Descriptions.Item>
                    <Descriptions.Item label="Salary Group">
                      {p.salaryGroupId
                        ? ((salaryGroups?.data ?? []).find((s) => s.id === p.salaryGroupId)?.name ?? `#${p.salaryGroupId}`)
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Value adding value">{p.valueAddedVal || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Value adding type">
                      <Tag color={p.valueAddedType === 'percentage' ? 'orange' : 'blue'}>
                        {p.valueAddedType === 'percentage' ? '% Percentage' : 'Currency'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ))}
            </Space>
          ),
        },
      ]}
    />
  );
}

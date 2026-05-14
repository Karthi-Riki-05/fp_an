'use client';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Input, InputNumber, Popconfirm, Radio, Row, Select, Space, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { salaryGroupsApi, typesApi, type TenantScope } from '../../lib/api/admin-crud';
import {
  useEquipmentProperties,
  type EquipmentPropertyRow,
} from '../../lib/api/equipment';

const { Text } = Typography;

const EMPTY_ROW: EquipmentPropertyRow = {
  typeId: 0,
  cycleTime: '00:00:00',
  costPerHour: 0,
  currency: '',
  operator: 0,
  salaryGroupId: 0,
  valueAddedType: 'currency',
  valueAddedVal: '',
  orderSelection: 'free_text',
};

interface Props {
  equipmentId: number | null;
  scope: TenantScope;
  /**
   * Controlled rows. When omitted, the panel manages its own state and
   * preloads from the server (legacy behaviour for the standalone view
   * tab). When provided, the parent modal owns the state and persists it
   * as part of its main Save — set by EquipmentFullEditModal.
   */
  value?: EquipmentPropertyRow[];
  onChange?: (rows: EquipmentPropertyRow[]) => void;
}

export default function EquipmentPropertiesPanel({ equipmentId, scope, value, onChange }: Props) {
  const { data: partTypes } = typesApi.useList(scope, { entity: 'Part', perPage: 200 });
  const { data: salaryGroups } = salaryGroupsApi.useList(scope, { perPage: 200 });
  const { data: existing, isLoading } = useEquipmentProperties(scope.tenantId, equipmentId);

  // Uncontrolled fallback — used only when the parent doesn't supply
  // value/onChange. The full edit modal supplies them so its main Save
  // button persists Properties alongside the equipment record.
  const [localRows, setLocalRows] = useState<EquipmentPropertyRow[]>([]);
  const isControlled = value !== undefined;
  const rows = isControlled ? value : localRows;
  const setRows = (updater: (rs: EquipmentPropertyRow[]) => EquipmentPropertyRow[]) => {
    if (isControlled) onChange?.(updater(value));
    else setLocalRows((rs) => updater(rs));
  };

  // Hydrate from the server whenever existing data lands. Important: only
  // overwrite local state when the server returns a non-empty list AND the
  // local state is still empty — so the user's in-progress edits don't get
  // clobbered by a refetch. Also matters when the modal first opens and
  // existing arrives a tick after the panel mounts.
  useEffect(() => {
    if (!existing) return;
    if (existing.length === 0) return;
    if (rows.length > 0) return;
    if (isControlled) onChange?.(existing);
    else setLocalRows(existing);
  }, [existing, rows.length, isControlled, onChange]);

  if (equipmentId === null) {
    return (
      <Alert
        type="info"
        showIcon
        message="Save the equipment first to add per-Part-Type properties."
      />
    );
  }
  if (isLoading && rows.length === 0) return <Spin />;

  const partOptions = (partTypes?.data ?? []).map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` }));
  const salaryOptions = (salaryGroups?.data ?? []).map((s) => ({ value: s.id, label: s.name ?? `#${s.id}` }));

  const usedTypeIds = new Set(rows.map((r) => r.typeId).filter((id) => id > 0));
  const canAddMore = partOptions.some((o) => !usedTypeIds.has(Number(o.value)));

  const updateRow = (idx: number, patch: Partial<EquipmentPropertyRow>) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));
  const addRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {rows.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="No per-Part-Type properties yet. Add a row, then click Save changes (modal footer) to persist."
        />
      )}

      {rows.map((row, idx) => (
        <Card
          key={idx}
          size="small"
          title={
            <Space>
              <Text strong>Part type</Text>
              <Select
                value={row.typeId > 0 ? row.typeId : undefined}
                placeholder="Select a Part Type"
                style={{ minWidth: 240 }}
                options={partOptions.map((o) => ({
                  ...o,
                  disabled: o.value !== row.typeId && usedTypeIds.has(Number(o.value)),
                }))}
                onChange={(v) => updateRow(idx, { typeId: Number(v) })}
                showSearch
                optionFilterProp="label"
              />
            </Space>
          }
          extra={
            <Popconfirm title="Remove this row?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => removeRow(idx)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          }
        >
          <Row gutter={[16, 12]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>Order nr selection</Text>
              <Radio.Group
                value={row.orderSelection}
                onChange={(e) => updateRow(idx, { orderSelection: e.target.value })}
                style={{ display: 'block', marginTop: 4 }}
              >
                <Radio value="free_text">Free Text</Radio>
                <Radio value="list">Select from order list</Radio>
              </Radio.Group>
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>Per Hour</Text>
              <InputNumber
                value={row.costPerHour}
                onChange={(v) => updateRow(idx, { costPerHour: Number(v) || 0 })}
                min={0}
                placeholder="Cost/h"
                style={{ width: '100%', marginTop: 4 }}
              />
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>Currency</Text>
              <Input
                value={row.currency}
                onChange={(e) => updateRow(idx, { currency: e.target.value })}
                placeholder="SEK"
                style={{ marginTop: 4 }}
                maxLength={10}
              />
            </Col>

            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Cycle Time</Text>
              <Input
                value={row.cycleTime}
                onChange={(e) => updateRow(idx, { cycleTime: e.target.value })}
                placeholder="HH:MM:SS"
                style={{ marginTop: 4 }}
              />
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Number of operator</Text>
              <InputNumber
                value={row.operator}
                onChange={(v) => updateRow(idx, { operator: Number(v) || 0 })}
                min={0}
                placeholder="How many"
                style={{ width: '100%', marginTop: 4 }}
              />
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Salary Group</Text>
              <Select
                value={row.salaryGroupId > 0 ? row.salaryGroupId : undefined}
                placeholder="Select salary group"
                style={{ width: '100%', marginTop: 4 }}
                options={salaryOptions}
                onChange={(v) => updateRow(idx, { salaryGroupId: Number(v) })}
                allowClear
                showSearch
                optionFilterProp="label"
              />
            </Col>

            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Value adding value</Text>
              <Input
                value={row.valueAddedVal}
                onChange={(e) => updateRow(idx, { valueAddedVal: e.target.value })}
                placeholder="Value"
                style={{ marginTop: 4 }}
                maxLength={10}
              />
            </Col>
            <Col span={16}>
              <Text type="secondary" style={{ fontSize: 12 }}>Value adding type</Text>
              <Radio.Group
                value={row.valueAddedType}
                onChange={(e) => updateRow(idx, { valueAddedType: e.target.value })}
                style={{ display: 'block', marginTop: 4 }}
              >
                <Radio value="currency">Currency</Radio>
                <Radio value="percentage">% Percentage</Radio>
              </Radio.Group>
            </Col>
          </Row>
        </Card>
      ))}

      <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} disabled={!canAddMore}>
        Add part type
      </Button>
    </Space>
  );
}

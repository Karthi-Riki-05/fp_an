'use client';

import { TreeSelect } from 'antd';
import type { TreeSelectProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMemo } from 'react';
import { useEquipmentTree, type EquipmentTreeNode } from '../../lib/api/equipment';

/**
 * Single source of truth for "pick an equipment from the tree" Selects.
 * Used by:
 *   - C1 Equipment add/edit (parent_id)
 *   - C7 Folders (equipment_id)
 *   - D2 Machines (equipment_id)
 *   - any future form that needs to pick an equipment hierarchically
 *
 * The data hook is shared (useEquipmentTree) so the tenant-scoped cache
 * is hit once across all consumers within a page render.
 */

function toTreeSelectData(nodes: EquipmentTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    value: n.id,
    title: n.name,
    children: n.children?.length ? toTreeSelectData(n.children) : undefined,
  }));
}

export interface EquipmentTreeSelectProps
  extends Omit<TreeSelectProps<number>, 'treeData' | 'value' | 'onChange'> {
  tenantId: number | null;
  value?: number | null;
  onChange?: (value: number | undefined) => void;
}

export function EquipmentTreeSelect({
  tenantId,
  value,
  onChange,
  placeholder = 'Select equipment',
  ...rest
}: EquipmentTreeSelectProps) {
  const { data: tree, isLoading } = useEquipmentTree(tenantId);
  const treeData = useMemo(() => (tree ? toTreeSelectData(tree) : []), [tree]);
  return (
    <TreeSelect<number>
      {...rest}
      treeData={treeData}
      value={value ?? undefined}
      onChange={(v) => onChange?.(typeof v === 'number' ? v : undefined)}
      loading={isLoading}
      showSearch
      treeNodeFilterProp="title"
      placeholder={placeholder}
      treeDefaultExpandAll={false}
      allowClear
    />
  );
}

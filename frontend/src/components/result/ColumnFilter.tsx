'use client';

import { Button, Dropdown, Input } from 'antd';
import type { MenuProps } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Operator definitions (1-8, matching backend switch)
// ---------------------------------------------------------------------------

const OPERATORS: Array<{ op: number; label: string; needsValue: boolean }> = [
  { op: 1, label: '= Equal',          needsValue: true  },
  { op: 2, label: '≠ Not equal',      needsValue: true  },
  { op: 3, label: '⊃ Contains',       needsValue: true  },
  { op: 4, label: '⊄ Not contains',   needsValue: true  },
  { op: 5, label: '∅ Empty',          needsValue: false },
  { op: 6, label: '¬∅ Not empty',     needsValue: false },
  { op: 7, label: '↳ Starts with',    needsValue: true  },
  { op: 8, label: '↲ Ends with',      needsValue: true  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ColumnFilterProps {
  columnKey: string;
  value: string;
  operator: number;
  onChange: (key: string, value: string, operator: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColumnFilter({ columnKey, value, operator, onChange }: ColumnFilterProps) {
  const currentOp = OPERATORS.find((o) => o.op === operator) ?? OPERATORS[0];
  const needsValue = currentOp.needsValue;

  const menuItems: MenuProps['items'] = OPERATORS.map((o) => ({
    key: String(o.op),
    label: o.label,
    onClick: () => onChange(columnKey, value, o.op),
  }));

  const isActive = operator !== 1 || value !== '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
      {needsValue && (
        <Input
          size="small"
          value={value}
          placeholder="filter…"
          onChange={(e) => onChange(columnKey, e.target.value, operator)}
          style={{ width: 90, fontSize: 11 }}
          allowClear
        />
      )}
      <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
        <Button
          size="small"
          type={isActive ? 'primary' : 'default'}
          icon={<FilterOutlined />}
          title={`Filter: ${currentOp.label}`}
          style={{ padding: '0 4px', fontSize: 11 }}
          aria-label={`Column filter for ${columnKey}`}
        />
      </Dropdown>
    </div>
  );
}

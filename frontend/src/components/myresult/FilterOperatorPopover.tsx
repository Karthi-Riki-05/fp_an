'use client';

import { Popover, Radio, Space } from 'antd';
import { useState } from 'react';

/**
 * The 8 column-filter operators from results.md §6.4.
 * Triggered by the "[A]" icon next to each column input.
 */

export const FILTER_OPS: { value: number; label: string }[] = [
  { value: 1, label: 'Equals' },
  { value: 2, label: 'Does Not Equal' },
  { value: 3, label: 'Contains' },
  { value: 4, label: 'Does Not Contain' },
  { value: 5, label: 'Is Empty' },
  { value: 6, label: 'Is Not Empty' },
  { value: 7, label: 'Starts With' },
  { value: 8, label: 'Ends With' },
];

interface Props {
  value: number;
  onChange: (next: number) => void;
}

export function FilterOperatorPopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      content={
        <Radio.Group value={value} onChange={(e) => { onChange(e.target.value); setOpen(false); }}>
          <Space direction="vertical" size={2}>
            {FILTER_OPS.map((o) => (<Radio key={o.value} value={o.value}>{o.label}</Radio>))}
          </Space>
        </Radio.Group>
      }
    >
      <button
        type="button"
        title={FILTER_OPS.find((o) => o.value === value)?.label ?? '[A]'}
        style={{
          width: 22, height: 22, lineHeight: '20px', textAlign: 'center',
          fontSize: 11, padding: 0,
          background: '#fff', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer',
          color: '#555',
        }}
      >[A]</button>
    </Popover>
  );
}

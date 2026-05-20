'use client';

import { Select, Typography } from 'antd';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Summary type options
// ---------------------------------------------------------------------------

const SUMMARY_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Empty count' },
  { value: 2, label: 'Non-empty count' },
  { value: 3, label: 'Distinct count' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SummaryRowProps {
  /** Column keys that support summary display. */
  columns: string[];
  /** Pre-computed summary values keyed by column key. */
  summaryData?: Record<string, string | number>;
  /** Called when the summary type dropdown changes. */
  onSummaryTypeChange: (type: number) => void;
  /** Currently selected summary type (0=none). */
  summaryType?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SummaryRow({
  columns,
  summaryData,
  onSummaryTypeChange,
  summaryType = 0,
}: SummaryRowProps) {
  const showData = summaryType !== 0 && summaryData && Object.keys(summaryData).length > 0;

  return (
    <div style={{ marginTop: 8 }}>
      {/* Dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Summary:</Text>
        <Select
          size="small"
          value={summaryType}
          onChange={onSummaryTypeChange}
          options={SUMMARY_OPTIONS}
          style={{ minWidth: 160 }}
          popupMatchSelectWidth={false}
        />
      </div>

      {/* Summary value strip */}
      {showData && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 6,
            padding: '6px 12px',
            background: '#f0f9ff',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {columns.map((col) => {
            const val = summaryData?.[col];
            if (val === undefined) return null;
            return (
              <span key={col}>
                <Text type="secondary">{col}: </Text>
                <Text strong>{val}</Text>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

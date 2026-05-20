'use client';

import { ApartmentOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

interface Props {
  /** css width — number coerced to px */
  width?: number | string;
  /** css height — number coerced to px */
  height?: number | string;
  /** Small/thumbnail variant used inside FlowCard. Default false (full-page). */
  compact?: boolean;
}

/**
 * Renders an empty-state placeholder anywhere a diagram thumbnail or
 * canvas would go. Used by FlowCard when `svgCache` is null (no save
 * has happened yet) and by Monitor/Analyzer landing screens before a
 * flow has been opened.
 */
export default function EmptyDiagramPlaceholder({ width = '100%', height = 280, compact = false }: Props) {
  if (compact) {
    return (
      <div
        data-testid="empty-diagram-placeholder"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width,
          height,
          background: '#f5f7fa',
          border: '1px dashed #d9d9d9',
          borderRadius: 4,
        }}
      >
        <ApartmentOutlined style={{ fontSize: 20, color: '#00b4d8' }} />
        <Text type="secondary" style={{ fontSize: 10 }}>No diagram yet</Text>
      </div>
    );
  }
  return (
    <div
      data-testid="empty-diagram-placeholder"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width,
        height,
        background: '#f5f7fa',
        border: '1px dashed #d9d9d9',
        borderRadius: 8,
      }}
    >
      <ApartmentOutlined style={{ fontSize: 48, color: '#00b4d8' }} />
      <Text strong>No diagram to show</Text>
      <Text type="secondary">Open Flow Designer and save the diagram to render it here.</Text>
    </div>
  );
}

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
 * Renders a placeholder anywhere a GoJS canvas or thumbnail would go.
 * When NEXT_PUBLIC_GOJS_LICENSE_KEY is set (Plan B), the conditional below
 * is the entry point for swapping in the real <GoJsCanvas/> — for now we
 * always render the placeholder so the surrounding UI is shippable.
 */
export default function GoJsLicensePlaceholder({ width = '100%', height = 280, compact = false }: Props) {
  const hasLicense = !!process.env.NEXT_PUBLIC_GOJS_LICENSE_KEY;
  if (hasLicense) {
    // Plan B drops the real GoJS component in here. For now, even if a key
    // is set we still render the placeholder until Step B lands.
  }

  if (compact) {
    return (
      <div
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
        <Text type="secondary" style={{ fontSize: 10 }}>GoJS license required</Text>
      </div>
    );
  }
  return (
    <div
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
      <Text strong>Flow diagrams require a GoJS license</Text>
      <Text type="secondary">Set NEXT_PUBLIC_GOJS_LICENSE_KEY in .env.local to enable</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>See OPERATOR_QUESTIONS.md Q2</Text>
    </div>
  );
}

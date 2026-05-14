'use client';

import { Card, Typography } from 'antd';
import GoJsLicensePlaceholder from './GoJsLicensePlaceholder';

const { Text } = Typography;

interface Props {
  id: number;
  name: string;
  flowData: string | null;
  onClick: () => void;
}

/**
 * One flow card with thumbnail + name. Today the thumbnail is the
 * GoJsLicensePlaceholder; when Plan B lands the same slot renders a
 * read-only GoJS diagram via .makeSvg().
 */
export default function FlowCard({ name, flowData, onClick }: Props) {
  return (
    <Card
      hoverable
      onClick={onClick}
      styles={{ body: { padding: 12 } }}
      style={{ cursor: 'pointer', borderRadius: 6 }}
    >
      <Text style={{ display: 'block', textAlign: 'center', fontSize: 14, marginBottom: 8 }}>
        {name}
      </Text>
      {/* The placeholder ignores flowData; Plan B's <FlowThumbnailCanvas/> will use it. */}
      <GoJsLicensePlaceholder compact height={200} />
      {flowData && (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 10, marginTop: 4 }}>
          {(() => { try { const p = JSON.parse(flowData); return `${p?.nodeDataArray?.length ?? 0} nodes`; } catch { return ''; } })()}
        </Text>
      )}
    </Card>
  );
}

'use client';

import { Card, Typography } from 'antd';
import EmptyDiagramPlaceholder from './EmptyDiagramPlaceholder';

const { Text } = Typography;

interface Props {
  id: number;
  name: string;
  svgCache?: string | null;
  onClick: () => void;
}

/**
 * One flow card with thumbnail + name. When the backend has a cached SVG
 * (captured on each explicit save by the drawio editor — see §11-S6) we
 * render it inline via `dangerouslySetInnerHTML`; otherwise the empty
 * placeholder ships.
 *
 * The SVG payload is server-trusted (validated in admin-flow-designs.service
 * to start with `<svg` and capped at 500KB) so inline injection is safe;
 * we additionally constrain the viewport with width/height styles on the
 * wrapper so an oversized export can't break card layout.
 */
export default function FlowCard({ name, svgCache, onClick }: Props) {
  const hasSvg = typeof svgCache === 'string' && svgCache.trimStart().startsWith('<svg');
  return (
    <Card
      hoverable
      onClick={onClick}
      data-testid="flow-card"
      className="flow-card"
      styles={{ body: { padding: 12 } }}
      style={{ cursor: 'pointer', borderRadius: 6 }}
    >
      <Text style={{ display: 'block', textAlign: 'center', fontSize: 14, marginBottom: 8 }}>
        {name}
      </Text>
      {hasSvg ? (
        <div
          data-testid="flow-card-thumbnail"
          style={{
            width: '100%',
            height: 200,
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{
            __html: svgCache!.replace(
              /<svg([^>]*)>/i,
              '<svg$1 style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;">',
            ),
          }}
        />
      ) : (
        <EmptyDiagramPlaceholder compact height={200} />
      )}
    </Card>
  );
}

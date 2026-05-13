'use client';

import { Alert } from 'antd';
import { CSSProperties } from 'react';

export interface FlowNode {
  id: string;
  label: string;
  /** 0..1 normalized canvas coordinates so this scales with container width. */
  x: number;
  y: number;
  status: 'running' | 'idle' | 'stopped' | 'warning' | 'offline';
  /**
   * Real equipment.id this node represents. Required for the Register
   * scrap/stop modals to cascade reasons/parts/orders. Optional here because
   * the Phase 4a placeholder feeds mock data; Phase 4b will populate this
   * from `flow_data.nodeDataArray[i].key` (legacy GoJS state).
   */
  equipmentId?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
}

const STATUS_COLOR: Record<FlowNode['status'], string> = {
  running: '#00a65a',
  idle:    '#bfbfbf',
  stopped: '#dd4b39',
  warning: '#f39c12',
  offline: '#999999',
};

const STATUS_LABEL: Record<FlowNode['status'], string> = {
  running: 'Running',
  idle:    'Idle',
  stopped: 'Stopped',
  warning: 'Warning',
  offline: 'Offline',
};

interface Props {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Visible aspect ratio, keep this 16:9 to match legacy GoJS canvas. */
  aspect?: number;
}

/**
 * Phase 4a placeholder for the Flow Monitor's GoJS diagram. Renders a
 * static SVG with the same visual semantics (nodes + edges + status colors)
 * so we can validate layout, KPI strip, side-panel coordination without
 * blocking on the GoJS license question (OPERATOR_QUESTIONS.md C4).
 *
 * Phase 4b replaces this with the real `gojs` npm component once C4 is
 * resolved; the public API (nodes/edges/selectedId/onSelect) stays the same.
 */
export function FlowCanvasPlaceholder({ nodes, edges, selectedId, onSelect, aspect = 16 / 9 }: Props) {
  // SVG viewBox in normalized coordinates: 1000 x (1000 / aspect)
  const VB_W = 1000;
  const VB_H = Math.round(VB_W / aspect);
  const NODE_W = 140;
  const NODE_H = 70;

  const nodePos = (n: FlowNode) => ({
    cx: n.x * VB_W,
    cy: n.y * VB_H,
  });

  const containerStyle: CSSProperties = {
    width: '100%',
    aspectRatio: `${aspect}`,
    background: '#f8f9fb',
    border: '1px solid #d9d9d9',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle} role="img" aria-label="Flow diagram (placeholder)">
      <Alert
        type="info"
        showIcon={false}
        message="GoJS canvas (placeholder)"
        description="Phase 4b will replace this SVG with a real GoJS diagram once the license is confirmed."
        style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '4px 8px', maxWidth: 260, opacity: 0.85 }}
      />
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        {/* edges */}
        <g stroke="#bbb" strokeWidth="2" fill="none">
          {edges.map((e, i) => {
            const a = nodes.find((n) => n.id === e.from);
            const b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const { cx: ax, cy: ay } = nodePos(a);
            const { cx: bx, cy: by } = nodePos(b);
            return (
              <line
                key={i}
                x1={ax} y1={ay} x2={bx} y2={by}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#bbb" />
            </marker>
          </defs>
        </g>

        {/* nodes */}
        {nodes.map((n) => {
          const { cx, cy } = nodePos(n);
          const isSelected = n.id === selectedId;
          return (
            <g
              key={n.id}
              transform={`translate(${cx - NODE_W / 2}, ${cy - NODE_H / 2})`}
              cursor="pointer"
              onClick={() => onSelect(n.id)}
              role="button"
              aria-label={`${n.label} — ${STATUS_LABEL[n.status]}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n.id); }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="#fff"
                stroke={isSelected ? '#01b9d0' : '#d9d9d9'}
                strokeWidth={isSelected ? 3 : 1.5}
                filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))"
              />
              <circle cx={14} cy={14} r={6} fill={STATUS_COLOR[n.status]} />
              {/* status label for accessibility (also a visible tag) */}
              <text x={26} y={18} fontSize={11} fill="#666">
                {STATUS_LABEL[n.status]}
              </text>
              <text x={NODE_W / 2} y={NODE_H / 2 + 6} fontSize={16} fontWeight={600} fill="#222" textAnchor="middle">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

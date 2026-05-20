'use client';

import { ApartmentOutlined, ArrowLeftOutlined, CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { App, Button, Input, Skeleton, Space, Spin, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import FlowDesignerEditor, { type FlowDesignerEditorHandle } from '../../../../../../components/flow/FlowDesignerEditor';
import { useMe } from '../../../../../../lib/api/auth';
import { useEquipmentTree, type EquipmentTreeNode } from '../../../../../../lib/api/equipment';
import {
  useFlowDesign,
  useToggleFlowDesignStatus,
  useUpdateFlowDesign,
} from '../../../../../../lib/api/flow-designs';

const { Title, Text } = Typography;

/** Equipment row icon — same fallback strategy as the structure page. */
function EquipmentIcon({ icon }: { icon: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!icon || icon === 'noimage.jpg' || failed) {
    return <ApartmentOutlined style={{ fontSize: 14 }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/equipment-icons/${icon}`}
      alt=""
      style={{ width: 16, height: 16, objectFit: 'contain', verticalAlign: 'middle' }}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Equipment row inside the Designer's left tree panel.
 *
 * Native HTML5 dragstart — AntD `<Tree draggable>` has its own internal
 * drag handler that does NOT fire HTML5 events the iframe can receive,
 * so we render a flat indented list instead. dataTransfer carries the
 * JSON payload `FlowDesignerEditor` listens for in its drop handler.
 */
function EquipmentRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: EquipmentTreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/fp-equipment',
          JSON.stringify({ equipmentId: node.id, equipmentName: node.name }),
        );
        // Show the same payload as text/plain so OS-level drag previews
        // are sensible (no functional impact — we read the json type).
        e.dataTransfer.setData('text/plain', node.name);
        e.dataTransfer.effectAllowed = 'copy';

        // Custom drag image — a small floating pill instead of a snapshot
        // of the whole row (which captures the icon + indent + hover and
        // looks janky against the canvas). The element must live in the
        // DOM at the moment of setDragImage; remove it on the next tick.
        const ghost = document.createElement('div');
        ghost.textContent = node.name;
        Object.assign(ghost.style, {
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          padding: '4px 10px',
          background: '#1677ff',
          color: '#fff',
          fontSize: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          borderRadius: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        });
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 12, 12);
        setTimeout(() => ghost.remove(), 0);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        paddingLeft: 6 + depth * 16,
        cursor: 'grab',
        userSelect: 'none',
        borderRadius: 3,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {hasChildren ? (
        <span
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ width: 14, display: 'inline-flex', color: '#999', cursor: 'pointer' }}
        >
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
      ) : (
        <span style={{ width: 14, display: 'inline-block' }} />
      )}
      <EquipmentIcon icon={node.icon} />
      <span style={{ fontSize: 13 }}>{node.name}</span>
    </div>
  );
}

function EquipmentTreePanel({ nodes }: { nodes: EquipmentTreeNode[] }) {
  // Each node tracks expanded state by id. Default: all expanded.
  const collectIds = (ns: EquipmentTreeNode[], acc: number[] = []): number[] => {
    for (const n of ns) { acc.push(n.id); if (n.children?.length) collectIds(n.children, acc); }
    return acc;
  };
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(collectIds(nodes)));
  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderNodes = (ns: EquipmentTreeNode[], depth = 0): React.ReactNode =>
    ns.map((n) => (
      <div key={n.id}>
        <EquipmentRow
          node={n}
          depth={depth}
          expanded={expanded.has(n.id)}
          onToggle={() => toggle(n.id)}
        />
        {expanded.has(n.id) && n.children?.length ? renderNodes(n.children, depth + 1) : null}
      </div>
    ));

  return <div>{renderNodes(nodes)}</div>;
}

/**
 * Flow Designer page. With §11-S4 the canvas slot is now the real
 * draw.io editor. The left panel is the equipment tree (drag source —
 * wired in §11-S5).
 */
export default function FlowDesignerPage() {
  const params = useParams<{ id: string }>();
  const flowId = params?.id ? Number(params.id) : null;
  const { message } = App.useApp();
  const { data: me } = useMe();
  const scope = { tenantId: me?.activeTenantId ?? null, isAdmin: me?.isAdmin ?? false };

  const flowQ = useFlowDesign(scope, flowId);
  const updateMut = useUpdateFlowDesign(scope);
  const toggleMut = useToggleFlowDesignStatus(scope);
  const treeQ = useEquipmentTree(scope.tenantId);

  const [name, setName] = useState('');
  useEffect(() => { if (flowQ.data?.name) setName(flowQ.data.name); }, [flowQ.data?.name]);

  // Imperative handle into the drawio iframe. Lets the Save button below
  // trigger drawio's save action — necessary because the iframe's
  // toolbar Save button is hidden (`noSaveBtn=1` in iframe URL) and
  // autosave writes XML only, so without an explicit Save the
  // FlowCard thumbnail (svgCache) never populates.
  const editorRef = useRef<FlowDesignerEditorHandle | null>(null);

  if (flowQ.isLoading || flowId === null) return <Skeleton active />;
  if (!flowQ.data) return <div>Flow not found.</div>;

  const isActive = flowQ.data.status === 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 96px)',  // 96px ≈ admin shell header chrome
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space size="middle">
          <Link href="/admin/flow-designs" aria-label="Back" style={{ color: 'rgba(0,0,0,0.45)' }}>
            <ArrowLeftOutlined />
          </Link>
          <Title level={4} style={{ margin: 0 }}>Flow Designer</Title>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              if (!flowId || name === flowQ.data?.name) return;
              try {
                await updateMut.mutateAsync({ id: flowId, input: { name } });
                message.success('Flow name updated.');
              } catch { message.error('Could not save name.'); }
            }}
            style={{ width: 260 }}
            placeholder="Flow name"
          />
          <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'active' : 'inactive'}</Tag>
        </Space>

        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Autosave runs every 5s — click Save to refresh the thumbnail.
          </Text>
          <Button
            type="primary"
            onClick={() => editorRef.current?.triggerSave()}
          >
            Save
          </Button>
          <Button
            onClick={async () => {
              if (!flowId) return;
              try {
                await toggleMut.mutateAsync(flowId);
                message.success(isActive ? 'Flow deactivated.' : 'Flow activated.');
              } catch { message.error('Could not toggle status.'); }
            }}
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      </div>

      {/* Two-pane layout: equipment tree | draw.io canvas */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12 }}>
        {/* Left — equipment tree (drag source; S5 wires the drag payload) */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            border: '1px solid #f0f0f0',
            borderRadius: 4,
            background: '#fff',
            overflow: 'auto',
            padding: 8,
          }}
        >
          <Text strong style={{ fontSize: 13 }}>Equipment</Text>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6, marginTop: 2 }}>
            Drag a row onto the canvas to add it as a node.
          </div>
          {treeQ.isLoading ? (
            <div style={{ padding: 16, textAlign: 'center' }}><Spin size="small" /></div>
          ) : (treeQ.data ?? []).length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', padding: 8 }}>
              No equipment yet.
            </Text>
          ) : (
            <EquipmentTreePanel nodes={treeQ.data ?? []} />
          )}
        </div>

        {/* Right — draw.io canvas */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: '1px solid #f0f0f0',
            borderRadius: 4,
            background: '#fafafa',
            overflow: 'hidden',
          }}
        >
          <FlowDesignerEditor ref={editorRef} flowId={flowId} scope={scope} readOnly={false} />
        </div>
      </div>
    </div>
  );
}

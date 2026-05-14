'use client';

import { ApartmentOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { App, Button, Input, Skeleton, Space, Spin, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import FlowDesignerEditor from '../../../../../../components/flow/FlowDesignerEditor';
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
 * Render the equipment tree as draggable nodes. S5 wires the actual
 * dragstart payload + iframe drop target → for S4 we render the tree
 * (read-only, AntD <Tree>) so the layout is correct ahead of time.
 */
function toTreeData(nodes: EquipmentTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: String(n.id),
    title: (
      <span
        // S5 will attach onDragStart here. For now the row is just visible.
        data-equipment-id={n.id}
        data-equipment-name={n.name}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <EquipmentIcon icon={n.icon} />
        {n.name}
      </span>
    ),
    children: n.children?.length ? toTreeData(n.children) : undefined,
  }));
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
            Save via the toolbar in the canvas; autosave runs every 5s.
          </Text>
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
          {treeQ.isLoading ? (
            <div style={{ padding: 16, textAlign: 'center' }}><Spin size="small" /></div>
          ) : (treeQ.data ?? []).length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', padding: 8 }}>
              No equipment yet.
            </Text>
          ) : (
            <Tree
              showIcon={false}
              defaultExpandAll
              blockNode
              treeData={toTreeData(treeQ.data ?? [])}
              style={{ marginTop: 8, background: 'transparent' }}
            />
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
          <FlowDesignerEditor flowId={flowId} scope={scope} readOnly={false} />
        </div>
      </div>
    </div>
  );
}

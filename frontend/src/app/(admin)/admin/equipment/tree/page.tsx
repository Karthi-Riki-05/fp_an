'use client';

import { ApartmentOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Skeleton, Space, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DraggableEquipmentTree from '@/components/equipment/DraggableEquipmentTree';
import EquipmentDetailsView from '@/components/equipment/EquipmentDetailsView';
import EquipmentQuickEditModal from '@/components/equipment/EquipmentQuickEditModal';
import { useEquipmentDetail, useEquipmentTree, type EquipmentTreeNode } from '@/lib/api/equipment';
import { useMe } from '@/lib/api/auth';

const { Title, Text } = Typography;

/** Replace bad `noimage.jpg` icons with an AntD icon, fall back when an image fails. */
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

function toAntdTreeData(nodes: EquipmentTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: String(n.id),
    title: n.name,
    icon: <EquipmentIcon icon={n.icon} />,
    children: n.children?.length ? toAntdTreeData(n.children) : undefined,
  }));
}

function useIsDesktop(): boolean {
  // SSR-safe: default to desktop, swap on client after first mount.
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return isDesktop;
}

export default function EquipmentStructurePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.activeTenantId ?? null;
  const scope = { tenantId, isAdmin: me?.isAdmin ?? false };
  const isDesktop = useIsDesktop();

  const { data: tree, isLoading, error } = useEquipmentTree(tenantId);

  const [viewId, setViewId] = useState<number | null>(null);
  const { data: viewDetail, isLoading: viewLoading } = useEquipmentDetail(tenantId, viewId);

  // Inline edit / add-child modal state. Editing happens here on the tree —
  // no more navigating to the list page.
  const [editId, setEditId] = useState<number | null>(null);
  const [addUnderParent, setAddUnderParent] = useState<number | null>(null);
  const editOpen = editId !== null || addUnderParent !== null;
  const closeEdit = () => { setEditId(null); setAddUnderParent(null); };
  const invalidateTree = () => {
    qc.invalidateQueries({ queryKey: ['equipment-tree'] });
    qc.invalidateQueries({ queryKey: ['equipment'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0 }}>Equipment structure</Title>
        <Space>
          <Button
            icon={<ArrowRightOutlined />}
            iconPosition="end"
            onClick={() => router.push('/admin/equipment')}
          >
            Equipment list
          </Button>
        </Space>
      </div>

      {isLoading && <Skeleton active paragraph={{ rows: 6 }} />}

      {error && (
        <Alert
          type="error"
          message="Failed to load equipment structure"
          description="Check that the backend is running and you are logged in."
        />
      )}

      {!isLoading && !error && (!tree || tree.length === 0) && (
        <Alert
          type="info"
          message="No equipment configured yet."
          description={
            <Space direction="vertical" size={4}>
              <Text>Add equipment from the Equipment List to see the structure here.</Text>
              <Button size="small" type="link" onClick={() => router.push('/admin/equipment')} style={{ padding: 0 }}>
                Go to Equipment list →
              </Button>
            </Space>
          }
        />
      )}

      {!isLoading && !error && tree && tree.length > 0 && (
        <>
          {isDesktop ? (
            <DraggableEquipmentTree
              tree={tree}
              scope={scope}
              onView={(id) => setViewId(id)}
              onEdit={(id) => setEditId(id)}
              onAddChild={(parentId) => setAddUnderParent(parentId)}
            />
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="Read-only on small screens"
                description="Open this page on a desktop (≥ 768px) to drag-reorder. Tap a node to view its details."
              />
              <Tree
                showLine={{ showLeafIcon: false }}
                showIcon
                treeData={toAntdTreeData(tree)}
                defaultExpandAll
                blockNode
                style={{ background: 'transparent' }}
                onSelect={(keys) => {
                  if (keys[0]) setViewId(Number(keys[0]));
                }}
              />
            </>
          )}
        </>
      )}

      <Modal
        open={viewId !== null}
        title={viewDetail ? `Equipment details — ${viewDetail.name}` : 'Equipment details'}
        onCancel={() => setViewId(null)}
        onOk={() => setViewId(null)}
        okText="Close"
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnClose
        width={680}
      >
        {viewLoading || !viewDetail ? <Skeleton active /> : <EquipmentDetailsView detail={viewDetail} scope={scope} />}
      </Modal>

      <EquipmentQuickEditModal
        open={editOpen}
        editingId={editId}
        addUnderParentId={addUnderParent}
        scope={scope}
        onClose={closeEdit}
        onSaved={invalidateTree}
      />
    </div>
  );
}

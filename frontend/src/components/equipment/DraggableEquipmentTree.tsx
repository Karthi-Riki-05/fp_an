'use client';

import {
  CaretDownOutlined,
  CaretRightOutlined,
  EditOutlined,
  EyeOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { App, Button, Dropdown, Modal, Space, Tooltip, Typography } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import type { EquipmentTreeNode } from '../../lib/api/equipment';
import { useReorderEquipment } from '../../lib/api/equipment';
import type { TenantScope } from '../../lib/api/admin-crud';

const { Text } = Typography;

const INDENT_PX = 24;

interface FlatNode {
  id: number;
  name: string;
  icon: string | null;
  parentId: number;
  depth: number;
  hasChildren: boolean;
}

function flatten(nodes: EquipmentTreeNode[], expanded: Set<number>, depth = 0, parentId = 0): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    const hasChildren = (n.children?.length ?? 0) > 0;
    out.push({
      id: n.id,
      name: n.name ?? `#${n.id}`,
      icon: n.icon ?? null,
      parentId,
      depth,
      hasChildren,
    });
    if (hasChildren && expanded.has(n.id)) {
      out.push(...flatten(n.children, expanded, depth + 1, n.id));
    }
  }
  return out;
}

function collectIds(nodes: EquipmentTreeNode[], acc: number[] = []): number[] {
  for (const n of nodes) {
    acc.push(n.id);
    if (n.children?.length) collectIds(n.children, acc);
  }
  return acc;
}

function isDescendantOf(
  candidateId: number,
  ancestorId: number,
  parentMap: Map<number, number>,
): boolean {
  let cursor = parentMap.get(candidateId);
  while (cursor && cursor !== 0) {
    if (cursor === ancestorId) return true;
    cursor = parentMap.get(cursor);
  }
  return false;
}

interface Props {
  tree: EquipmentTreeNode[];
  scope: TenantScope;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onAddChild: (parentId: number, parentName: string) => void;
}

export default function DraggableEquipmentTree({ tree, scope, onView, onEdit, onAddChild }: Props) {
  const { message, modal } = App.useApp();
  const reorder = useReorderEquipment(scope.tenantId);

  // Default expanded: every node with children is open.
  const allIds = useMemo(() => collectIds(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(allIds));
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const flat = useMemo(() => flatten(tree, expanded), [tree, expanded]);
  const parentMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const f of flat) m.set(f.id, f.parentId);
    return m;
  }, [flat]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(allIds)), [allIds]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(Number(e.active.id));
  };

  const handleDragMove = (e: { delta: { x: number } }) => {
    setDragOffsetX(e.delta.x);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const draggedId = Number(e.active.id);
    setDraggingId(null);
    setDragOffsetX(0);

    if (!e.over) return;
    const overId = Number(e.over.id);
    if (overId === draggedId) return;

    // Compute projected drop position.
    // Find indices in the flattened (visible) list.
    const fromIdx = flat.findIndex((n) => n.id === draggedId);
    const toIdx = flat.findIndex((n) => n.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;

    const dragged = flat[fromIdx];
    const target = flat[toIdx];

    // Horizontal indent of pointer → infer parent (Linear / dnd-kit-tree pattern).
    // If the user has dragged horizontally to the right, project as a CHILD of
    // the target node. Otherwise project as a SIBLING of the target.
    const indentSteps = Math.round(dragOffsetX / INDENT_PX);
    const projectedDepth = Math.max(0, Math.min(dragged.depth + indentSteps, target.depth + 1));

    let newParentId: number;
    let newSortOrder: number;

    if (projectedDepth > target.depth) {
      // Dropping as a child of the target node.
      newParentId = target.id;
      newSortOrder = 0; // first child
    } else {
      // Dropping as a sibling of the target.
      newParentId = target.parentId;
      // sortOrder: count siblings of the target above the drop position.
      const siblingsAbove = flat.slice(0, toIdx + 1).filter((n) => n.parentId === newParentId);
      newSortOrder = siblingsAbove.length;
    }

    // Client-side circular guard for fast feedback.
    if (newParentId !== 0 && (newParentId === draggedId || isDescendantOf(newParentId, draggedId, parentMap))) {
      message.error('Cannot move a node into its own descendant.');
      return;
    }

    if (newParentId === dragged.parentId && newSortOrder === fromIdx) {
      return; // no-op
    }

    // Confirm dialog matching legacy intent (legacy used confirm("Are you sure?")).
    modal.confirm({
      title: 'Save new position?',
      content: 'Move this equipment to the new spot in the tree.',
      okText: 'Save',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Send only the moved row — backend handles the rest.
          await reorder.mutateAsync([
            {
              id: draggedId,
              parentId: newParentId === 0 ? null : newParentId,
              sortOrder: newSortOrder,
            },
          ]);
          message.success('Equipment moved.');
        } catch (err) {
          const msg = (err as { response?: { data?: { message?: string; nodeId?: number } } })
            .response?.data?.message;
          if (msg === 'circular-reference') {
            message.error('Cannot move a node into its own descendant.');
          } else {
            message.error('Failed to move equipment.');
          }
        }
      },
    });
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button size="small" onClick={expandAll}>Expand all</Button>
        <Button size="small" onClick={collapseAll}>Collapse all</Button>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          Drag the grip handle to reorder. Right-click for more options.
        </Text>
      </Space>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flat.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              background: '#fff',
              padding: '4px 0',
              minHeight: 60,
            }}
          >
            {flat.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                expanded={expanded.has(node.id)}
                onToggle={() => toggle(node.id)}
                onView={() => onView(node.id)}
                onEdit={() => onEdit(node.id)}
                onAddChild={() => onAddChild(node.id, node.name)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {draggingId !== null ? (
            <div
              style={{
                background: '#fff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                padding: '6px 12px',
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {flat.find((n) => n.id === draggingId)?.name ?? `#${draggingId}`}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface RowProps {
  node: FlatNode;
  expanded: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onAddChild: () => void;
}

function TreeRow({ node, expanded, onToggle, onView, onEdit, onAddChild }: RowProps) {
  const sortable = useSortable({ id: node.id as UniqueIdentifier });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: 8 + node.depth * INDENT_PX,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'default',
    background: isDragging ? '#f5f5f5' : 'transparent',
    opacity: isDragging ? 0.4 : 1,
    borderBottom: '1px solid #fafafa',
  };

  const contextItems = [
    { key: 'view',  icon: <EyeOutlined />,    label: 'View equipment',    onClick: onView },
    { key: 'edit',  icon: <EditOutlined />,   label: 'Edit equipment',    onClick: onEdit },
    { key: 'add',   icon: <PlusOutlined />,   label: 'Add child equipment', onClick: onAddChild },
  ];

  return (
    <Dropdown menu={{ items: contextItems }} trigger={['contextMenu']}>
      <div ref={setNodeRef} style={style} className="eq-tree-row">
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: '#999', display: 'inline-flex', alignItems: 'center' }}
          aria-label={`Drag ${node.name}`}
        >
          <HolderOutlined />
        </span>

        {node.hasChildren ? (
          <Button
            type="text"
            size="small"
            onClick={onToggle}
            icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
            style={{ padding: 0, width: 18, height: 18, color: '#666' }}
          />
        ) : (
          <span style={{ display: 'inline-block', width: 18 }} />
        )}

        {node.icon && node.icon !== 'noimage.jpg' ? (
          <img
            src={`/equipment-icons/${node.icon}`}
            alt=""
            width={18}
            height={18}
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <span style={{ display: 'inline-block', width: 18 }} />
        )}

        <span
          onClick={onView}
          style={{ flex: 1, cursor: 'pointer', userSelect: 'none' }}
        >
          {node.name}
        </span>

        <Space size={2} className="eq-tree-row-actions" style={{ opacity: 0 }}>
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={onView} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} />
          </Tooltip>
          <Tooltip title="Add child">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={onAddChild} />
          </Tooltip>
        </Space>
        <style jsx>{`
          .eq-tree-row:hover :global(.eq-tree-row-actions) {
            opacity: 1;
          }
        `}</style>
      </div>
    </Dropdown>
  );
}

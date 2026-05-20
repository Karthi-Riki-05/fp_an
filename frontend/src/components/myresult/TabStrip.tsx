'use client';

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useMyResultTabs, useSaveTableSettings } from '../../lib/api/myresult';
import type { MyResultTab, TabInfo } from '../../lib/api/myresult';

const LABEL: Record<MyResultTab, string> = {
  stop:         'Stop data',
  scrap:        'Scrap data',
  production:   'Production data',
  warning:      'Warning log',
  unregistered: 'Unregistered stops',
};

function tabHref(slug: MyResultTab): string {
  return `/myresult/${slug}`;
}

interface SortableTabProps { tab: TabInfo; active: boolean }

function SortableTab({ tab, active }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(tab.id) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <Link
      ref={setNodeRef as unknown as React.Ref<HTMLAnchorElement>}
      href={tabHref(tab.slug)}
      style={{
        ...style,
        display: 'inline-block',
        padding: '12px 18px',
        borderBottom: active ? '2px solid #00768e' : '2px solid transparent',
        color: active ? '#000' : '#0070b8',
        textDecoration: 'none',
        fontWeight: active ? 600 : 500,
        cursor: 'grab',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      {LABEL[tab.slug]}
    </Link>
  );
}

export function TabStrip() {
  const path = usePathname() || '';
  const tabsQ = useMyResultTabs();
  const tabs = useMemo(() => (tabsQ.data?.tabs ?? []).filter((t) => t.visible), [tabsQ.data]);
  const saveMut = useSaveTableSettings();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => { /* nothing — tabs query fetches on mount */ }, []);

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = tabs.findIndex((t) => String(t.id) === String(e.active.id));
    const newIdx = tabs.findIndex((t) => String(t.id) === String(e.over!.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(tabs, oldIdx, newIdx);
    saveMut.mutate({ key: 'tap_setting', subKey: 'myresult', data: next.map((t) => t.id) });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={tabs.map((t) => String(t.id))} strategy={horizontalListSortingStrategy}>
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #e8e8e8',
          background: '#fff',
          padding: '0 8px',
        }}>
          {tabs.map((t) => (
            <SortableTab key={t.id} tab={t} active={path.startsWith(tabHref(t.slug))} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

'use client';

/**
 * Settings → Units list.
 *
 * Source of truth:
 *   - GET /api/v1/units (already filters to equipment_id > 0).
 * Persistence:
 *   - POST /api/v1/me/settings/table with
 *     { key: 'unit_web_settings', subKey: 'units', data: { hidden, order } }
 *
 * The same `unit_web_settings.units` blob is consumed by /units to filter
 * + sort the operator-facing unit cards.
 */

import { App, Button, Checkbox, Space, Spin, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiClient, toApiError } from '../../lib/api-client';
import { useMe } from '../../lib/api/auth';
import { useUnitsList } from '../../lib/api/units';

const { Text, Title } = Typography;

interface Row {
  id: number;
  name: string;
  signal: 'on' | 'off' | 'warning';
}

interface SortableRowProps {
  row: Row;
  isChecked: boolean;
  signalLabel: string;
  onCheck: (checked: boolean) => void;
}

function SortableRow({ row, isChecked, signalLabel, onCheck }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: '#fff',
    border: '1px solid #ddd',
    padding: '10px 12px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        aria-label="drag-handle"
        style={{
          color: '#999',
          fontSize: 14,
          lineHeight: 1,
          userSelect: 'none',
          cursor: 'grab',
          padding: '0 4px',
        }}
      >
        ⋮⋮
      </span>
      <Checkbox checked={isChecked} onChange={(e) => onCheck(e.target.checked)} />
      <Text style={{ color: '#333' }}>
        {row.name} - {signalLabel}
      </Text>
    </div>
  );
}

interface UnitFromApi {
  id: number;
  unitName: string | null;
  signalType: 'on' | 'off' | 'warning';
}

interface SavedUnitPrefs {
  hidden?: number[];
  order?: number[];
}

interface Props {
  /** Localised labels for the signal_type values shown after each unit name. */
  labels: { onSignal: string; offSignal: string; warningSig: string; save: string; saved: string; units: string };
}

export function SettingsUnitsList({ labels }: Props) {
  const t = useTranslations('texts');
  const { message } = App.useApp();
  const qc = useQueryClient();
  const listQ = useUnitsList();
  const { data: me } = useMe();

  const saved = useMemo<SavedUnitPrefs>(() => {
    const blob = me?.tablePreferences as Record<string, unknown> | undefined;
    const u = blob?.unit_web_settings as Record<string, unknown> | undefined;
    return (u?.units as SavedUnitPrefs) ?? {};
  }, [me]);

  // Local working copy; flushed to the API on Save.
  const [order, setOrder] = useState<number[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Seed from API + saved prefs whenever they refresh.
  useEffect(() => {
    if (!listQ.data) return;
    const apiIds = listQ.data.map((u: UnitFromApi) => u.id);
    const savedOrder = (saved.order ?? []).filter((id) => apiIds.includes(id));
    const newIds = apiIds.filter((id) => !savedOrder.includes(id));
    setOrder([...savedOrder, ...newIds]);
    setHidden(new Set(saved.hidden ?? []));
  }, [listQ.data, saved]);

  const byId = useMemo(() => {
    const m = new Map<number, UnitFromApi>();
    (listQ.data ?? []).forEach((u: UnitFromApi) => m.set(u.id, u));
    return m;
  }, [listQ.data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((cur) => {
      const oldIdx = cur.indexOf(Number(active.id));
      const newIdx = cur.indexOf(Number(over.id));
      if (oldIdx < 0 || newIdx < 0) return cur;
      return arrayMove(cur, oldIdx, newIdx);
    });
  };

  const signalLabel = (s: 'on' | 'off' | 'warning') =>
    s === 'on' ? labels.onSignal : s === 'off' ? labels.offSignal : labels.warningSig;

  const onSave = async () => {
    try {
      setSaving(true);
      await apiClient.post('/me/settings/table', {
        key: 'unit_web_settings',
        subKey: 'units',
        data: { hidden: Array.from(hidden), order },
      });
      message.success(labels.saved);
      // Refresh the /me cache so other surfaces (the /units page) pick
      // up the new selection immediately.
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      message.error(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (listQ.isLoading) {
    return <div style={{ padding: 24 }}><Spin /></div>;
  }
  if (listQ.isError) {
    return (
      <div style={{ padding: 24, color: '#dd4b39' }}>
        {t('confirmation_resend_failed')} {String((listQ.error as Error)?.message ?? '')}
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <Title level={4} style={{ color: '#00768d', marginBottom: 16 }}>
        {labels.units}
      </Title>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {order.map((id) => {
              const u = byId.get(id);
              if (!u) return null;
              return (
                <SortableRow
                  key={id}
                  row={{ id: u.id, name: u.unitName ?? '', signal: u.signalType }}
                  isChecked={!hidden.has(id)}
                  signalLabel={signalLabel(u.signalType)}
                  onCheck={(checked) => {
                    setHidden((cur) => {
                      const nxt = new Set(cur);
                      if (checked) nxt.delete(id); else nxt.add(id);
                      return nxt;
                    });
                  }}
                />
              );
            })}
          </Space>
        </SortableContext>
      </DndContext>
      <div style={{ marginTop: 24 }}>
        <Button
          type="default"
          style={{ borderColor: '#954cfe', color: '#954cfe', fontWeight: 500, padding: '0 32px', height: 40 }}
          onClick={onSave}
          loading={saving}
        >
          {labels.save}
        </Button>
      </div>
    </div>
  );
}

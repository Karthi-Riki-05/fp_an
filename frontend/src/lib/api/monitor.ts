'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api-client';

/**
 * Hooks used by the Flow Monitor (and Units stop form once it lands in B/E):
 *  - top-level flow select  → /api/v1/admin/flow-designs
 *  - parts cascading on eq  → /api/v1/equipment/:id/parts
 *  - stop-reason cascade    → /api/v1/equipment/:id/stop-reasons   (grouped)
 *  - scrap-reason cascade   → /api/v1/equipment/:id/scrap-reasons  (grouped)
 *
 * Stop/scrap reason endpoints return a grouped shape:
 *   [{ typeId, typeName, reasons: [{ id, name }] }]
 * which the modal flattens into AntD `<Select optionGroupChildren>` data.
 */

function tenantHeaders(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

// ── Flows ────────────────────────────────────────────────────────────────────

export interface FlowDesignSummary {
  id: number;
  name: string;
  status: number;
}

export function useFlowDesignsList(tenantId: number | null | undefined) {
  return useQuery({
    queryKey: ['monitor', 'flow-designs', tenantId],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: FlowDesignSummary[];
        total: number;
      }>('/admin/flow-designs', {
        params: { perPage: 200, status: 1 },
        headers: tenantHeaders(tenantId),
      });
      return data.data;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ── Equipment cascade — parts ───────────────────────────────────────────────

export interface EquipmentPartOption {
  id: number;
  name: string;
  partNo: string;
  typeId: number;
  sortOrder: number;
}

export function useEquipmentParts(
  tenantId: number | null | undefined,
  equipmentId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['monitor', 'equipment-parts', tenantId, equipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentPartOption[]>(
        `/equipment/${equipmentId}/parts`,
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    enabled: !!tenantId && !!equipmentId,
    staleTime: 30_000,
  });
}

// ── Equipment cascade — stop/scrap reasons ──────────────────────────────────

export interface ReasonGroup {
  typeId: number;
  typeName: string;
  reasons: Array<{ id: number; name: string }>;
}

export function useEquipmentStopReasons(
  tenantId: number | null | undefined,
  equipmentId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['monitor', 'equipment-stop-reasons', tenantId, equipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReasonGroup[]>(
        `/equipment/${equipmentId}/stop-reasons`,
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    enabled: !!tenantId && !!equipmentId,
    staleTime: 30_000,
  });
}

export function useEquipmentScrapReasons(
  tenantId: number | null | undefined,
  equipmentId: number | null | undefined,
) {
  return useQuery({
    queryKey: ['monitor', 'equipment-scrap-reasons', tenantId, equipmentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReasonGroup[]>(
        `/equipment/${equipmentId}/scrap-reasons`,
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    enabled: !!tenantId && !!equipmentId,
    staleTime: 30_000,
  });
}

// ── Composite reason value ──────────────────────────────────────────────────
//
// Legacy stores reason picks as `${typeId}-${reasonId}` in a single hidden
// input, then splits on submit into `stop_type_id` / `stop_reason_id` (or the
// scrap equivalents). We keep the same wire-format on the frontend so a single
// AntD Select with optgroups can drive both halves.

export function encodeReasonValue(typeId: number, reasonId: number): string {
  return `${typeId}-${reasonId}`;
}

export function decodeReasonValue(value: string | null | undefined): {
  typeId: number | null;
  reasonId: number | null;
} {
  if (!value) return { typeId: null, reasonId: null };
  const [t, r] = value.split('-');
  const typeId = Number(t);
  const reasonId = Number(r);
  return {
    typeId: Number.isFinite(typeId) ? typeId : null,
    reasonId: Number.isFinite(reasonId) ? reasonId : null,
  };
}

/**
 * Convert a grouped reason response into the shape AntD `<Select>` expects
 * for `options` with `<optgroup>` rendering.
 */
export function groupReasonsForSelect(groups: ReasonGroup[] | undefined) {
  if (!groups) return [];
  return groups.map((g) => ({
    label: g.typeName,
    options: g.reasons.map((r) => ({
      value: encodeReasonValue(g.typeId, r.id),
      label: r.name,
    })),
  }));
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { Equipment } from './types';

export type { Equipment } from './types';

export interface EquipmentAssignmentInput {
  /** Stop reasons assigned to this equipment (stop_category ids). */
  reasonStopTypeIds?: number[];
  /** Scrap reasons assigned (types where entity='ScrapReason'). */
  reasonScrapTypeIds?: number[];
  /** Part types this equipment runs (types where entity='Part'). */
  reasonPartTypeIds?: number[];
  /** Order types this equipment accepts (types where entity='Order'). */
  reasonOrderTypeIds?: number[];
  /** Shift schedule the equipment follows. Number 0 / null clears it. */
  scheduleId?: number | null;
  alsoAssignImport?: boolean;
}

export interface CreateEquipmentInput extends EquipmentAssignmentInput {
  name: string;
  parentId?: number;
  typeId?: number;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateEquipmentInput extends Partial<CreateEquipmentInput> {}

export interface EquipmentDetail extends Equipment {
  reasonStopTypeIds: number[];
  reasonScrapTypeIds: number[];
  reasonPartTypeIds: number[];
  reasonOrderTypeIds: number[];
  scheduleId: number | null;
  alsoAssignImport: boolean;
}

const EQUIPMENT_KEY = (tenantId: number | null) => ['equipment', tenantId] as const;

function tenantHeaders(tenantId: number | null) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : undefined;
}

export function useEquipmentList(tenantId: number | null) {
  return useQuery({
    queryKey: EQUIPMENT_KEY(tenantId),
    queryFn: async () => {
      const { data } = await apiClient.get<Equipment[]>('/equipment', {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    enabled: tenantId !== undefined, // null is allowed (admin without override)
  });
}

export function useCreateEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEquipmentInput) => {
      const { data } = await apiClient.post<Equipment>('/equipment', input, {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) }),
  });
}

export function useUpdateEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: UpdateEquipmentInput }) => {
      const { data } = await apiClient.patch<Equipment>(`/equipment/${id}`, input, {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) }),
  });
}

export function useDeleteEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/equipment/${id}`, {
        headers: tenantHeaders(tenantId),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) }),
  });
}

const EQUIPMENT_DETAIL_KEY = (tenantId: number | null, id: number | null) =>
  ['equipment', 'detail', tenantId, id] as const;

export function useEquipmentDetail(tenantId: number | null, id: number | null) {
  return useQuery({
    queryKey: EQUIPMENT_DETAIL_KEY(tenantId, id),
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentDetail>(`/equipment/${id}`, {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    enabled: id !== null,
    staleTime: 5_000,
  });
}

export interface EquipmentTreeNode {
  id: number;
  name: string;
  icon: string | null;
  parentId: number | null;
  isActive: boolean;
  children: EquipmentTreeNode[];
}

const EQUIPMENT_TREE_KEY = (tenantId: number | null) => ['equipment-tree', tenantId] as const;

export function useEquipmentTree(tenantId: number | null) {
  return useQuery({
    queryKey: EQUIPMENT_TREE_KEY(tenantId),
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentTreeNode[]>('/equipment/tree', {
        headers: tenantHeaders(tenantId),
      });
      return data;
    },
    staleTime: 30_000,
  });
}

// ─── Tree reorder ──────────────────────────────────────────────────────────

export interface ReorderItem {
  id: number;
  parentId: number | null;
  sortOrder: number;
}

export function useReorderEquipment(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ReorderItem[]) => {
      const { data } = await apiClient.post<{ updated: number }>(
        '/equipment/reorder',
        { items },
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EQUIPMENT_TREE_KEY(tenantId) });
      qc.invalidateQueries({ queryKey: EQUIPMENT_KEY(tenantId) });
    },
  });
}

// ─── Equipment Properties (per-Part-Type) ──────────────────────────────────

export interface EquipmentPropertyRow {
  id?: number;
  equipmentId?: number;
  typeId: number;
  cycleTime: string;
  costPerHour: number;
  currency: string;
  operator: number;
  salaryGroupId: number;
  valueAddedType: 'currency' | 'percentage';
  valueAddedVal: string;
  orderSelection: 'free_text' | 'list';
}

export function useEquipmentProperties(tenantId: number | null, equipmentId: number | null) {
  return useQuery({
    queryKey: ['equipment-properties', tenantId, equipmentId] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<EquipmentPropertyRow[]>(
        `/equipment/${equipmentId}/properties`,
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    enabled: equipmentId !== null,
    staleTime: 5_000,
  });
}

export function useReplaceEquipmentProperties(tenantId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rows }: { id: number; rows: EquipmentPropertyRow[] }) => {
      const { data } = await apiClient.put<EquipmentPropertyRow[]>(
        `/equipment/${id}/properties`,
        rows,
        { headers: tenantHeaders(tenantId) },
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment-properties', tenantId, vars.id] });
    },
  });
}

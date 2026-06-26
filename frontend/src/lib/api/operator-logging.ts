import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

/**
 * Operator logging hooks — stop / production / scrap entry from the mobile
 * UserShell screens. These wrap the legacy `/user/*` mobile endpoints, which
 * all return a `{ success, msg, data }` envelope (HTTP 200 even on logical
 * failure), so each call unwraps `data` and throws `msg` when `success` is
 * false.
 */

interface Envelope<T> {
  success: boolean;
  msg: string;
  data: T;
}

export interface ReasonCategory {
  typeId: number;
  typeName: string;
  reasons: { id: number; name: string }[];
}

export interface EquipmentPart {
  id: number;
  name: string;
  partNo: string;
}

export interface EquipmentOrder {
  id: number;
  orderNr: string;
  flowId: number;
  partId: number;
}

async function unwrap<T>(promise: Promise<{ data: Envelope<T> }>): Promise<T> {
  const { data: env } = await promise;
  if (env && env.success === false) throw new Error(env.msg || 'Request failed');
  return env.data;
}

// ── reason / part / order lookups (keyed by equipment) ─────────────────────

export function useEquipmentStopReasons(equipmentId: number | null) {
  return useQuery({
    queryKey: ['operator', 'stop-reasons', equipmentId] as const,
    queryFn: () => unwrap<ReasonCategory[]>(apiClient.post('/user/getStopReasonData', { equipment_id: equipmentId })),
    enabled: equipmentId != null && equipmentId > 0,
    staleTime: 60_000,
  });
}

export function useEquipmentScrapReasons(equipmentId: number | null) {
  return useQuery({
    queryKey: ['operator', 'scrap-reasons', equipmentId] as const,
    queryFn: () => unwrap<ReasonCategory[]>(apiClient.post('/user/getScrapReasonData', { equipment_id: equipmentId })),
    enabled: equipmentId != null && equipmentId > 0,
    staleTime: 60_000,
  });
}

export function useEquipmentOrders(equipmentId: number | null) {
  return useQuery({
    queryKey: ['operator', 'orders', equipmentId] as const,
    queryFn: () => unwrap<EquipmentOrder[]>(apiClient.post('/user/getEquipmentOrderData', { equipment_id: equipmentId })),
    enabled: equipmentId != null && equipmentId > 0,
    staleTime: 60_000,
  });
}

export function useEquipmentParts(equipmentId: number | null) {
  return useQuery({
    queryKey: ['operator', 'parts', equipmentId] as const,
    queryFn: () => unwrap<EquipmentPart[]>(apiClient.post('/user/getEquipmentPartData', { equipment_id: equipmentId })),
    enabled: equipmentId != null && equipmentId > 0,
    staleTime: 60_000,
  });
}

export interface FlowRef {
  id: number;
  name: string;
}

/**
 * Flows that contain the given equipment. The first result's `id` is used as
 * `flow_id` when logging stop / production rows so they're flow-attributed.
 */
export function useEquipmentFlow(equipmentId: number | null) {
  return useQuery({
    queryKey: ['operator', 'flow', equipmentId] as const,
    queryFn: () => unwrap<FlowRef[]>(apiClient.post('/user/getFlowListByEquipment', { equipment_id: equipmentId })),
    enabled: equipmentId != null && equipmentId > 0,
    staleTime: 60_000,
  });
}

// ── save mutations ─────────────────────────────────────────────────────────

export interface SaveStopInput {
  equipmentId: number;
  flowId?: number;
  date: string;            // YYYY-MM-DD
  stopTypeId: number;      // ReasonCategory.typeId
  stopReasonId: number;    // ReasonCategory.reasons[].id
  timeHours?: number;
  timeMinutes?: number;
  quantity?: number;
  comment?: string;
  workShiftName?: string;
  orderNo?: string;
}

export function useSaveStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveStopInput) =>
      unwrap<{ id: number }>(apiClient.post('/user/saveStopData', {
        flow_id: input.flowId ?? 0,
        equipment_id: input.equipmentId,
        date: input.date,
        stop_type_id: input.stopTypeId,
        stop_reason_id: input.stopReasonId,
        time_hours: input.timeHours ?? 0,
        time_minutes: input.timeMinutes ?? 0,
        quantity: input.quantity ?? 0,
        comment: input.comment ?? '',
        work_shift_name: input.workShiftName ?? '',
        order_no: input.orderNo ?? '',
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myresult', 'stop'] }),
  });
}

export interface SaveProductionInput {
  equipmentId: number;
  flowId?: number;
  partId?: number;
  date: string;            // YYYY-MM-DD
  partQty: number;
  plannedQty?: number;
  workHours?: string;      // HH:MM
  workShiftName?: string;
  orderNo?: string;
  comment?: string;
}

export function useSaveProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveProductionInput) =>
      unwrap<{ id: number }>(apiClient.post('/user/saveProductionData', {
        flow_id: input.flowId ?? 0,
        equipment_id: input.equipmentId,
        part_id: input.partId ?? 0,
        date: input.date,
        part_qty: input.partQty,
        planned_qty: input.plannedQty ?? 0,
        work_hours: input.workHours ?? '',
        work_shift_name: input.workShiftName ?? '',
        order_no: input.orderNo ?? '',
        comment: input.comment ?? '',
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myresult', 'production'] }),
  });
}

export interface SaveScrapInput {
  equipmentId: number;
  flowId?: number;
  date: string;            // YYYY-MM-DD
  scrapTypeId: number;
  scrapReasonId: number;
  quantity: number;
  workShiftName?: string;
  orderNo?: string;
  comment?: string;
}

export function useSaveScrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveScrapInput) =>
      unwrap<{ id: number }>(apiClient.post('/user/saveScrapData', {
        flow_id: input.flowId ?? 0,
        equipment_id: input.equipmentId,
        date: input.date,
        scrap_type_id: input.scrapTypeId,
        scrap_reason_id: input.scrapReasonId,
        quantity: input.quantity,
        work_shift_name: input.workShiftName ?? '',
        order_no: input.orderNo ?? '',
        comment: input.comment ?? '',
      })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myresult', 'scrap'] }),
  });
}

/** Time-of-day → shift label (06–14 A, 14–22 B, 22–06 C). */
export function currentShiftName(d: Date = new Date()): string {
  const h = d.getHours();
  if (h >= 6 && h < 14) return 'Shift A';
  if (h >= 14 && h < 22) return 'Shift B';
  return 'Shift C';
}

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
export function todayLocal(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

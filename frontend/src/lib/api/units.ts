import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

export interface UnitCard {
  id: number;
  unitName: string | null;
  equipmentId: number;
  equipmentName: string | null;
  signalType: 'on' | 'off' | 'warning';
  runningStatus: 'on' | 'off';
  unitConnected: 'yes' | 'no';
  hasUnregisterData: 'yes' | 'no';
  lastOnline: string | null;
  updatedAt: string | null;
  unregisteredCount: number;
}

export interface UnitStatus {
  id: number;
  runningStatus: 'on' | 'off';
  unitConnected: 'yes' | 'no';
  hasUnregisterData: 'yes' | 'no';
  signalType: 'on' | 'off' | 'warning';
  updatedAt: string | null;
  startTime: string | null;
  endTime: string | null;
  machineDataId: number | null;
  latestIsRegistered: 'no' | 'yes' | 'pre' | null;
}

export interface UnregisteredBucket {
  id: number;
  machineId: number;
  startTime: string;
  endTime: string | null;
  productionTime: string | null;
  isValidData: boolean;
}

export interface UnregisteredPage {
  data: UnregisteredBucket[];
  total: number;
  page: number;
  perPage: number;
}

export interface ShiftAssignment {
  id: number | null;
  name: string;
  type?: string;
}

export interface RegisterStopsInput {
  type: '' | 'pre-reg';
  stopBucketIds: number[];
  stopReasonComposite: string;       // "<typeId>-<reasonId>"
  partId?: number | null;
  orderNo?: string | null;
  workShiftMap: Record<string, ShiftAssignment>;
  comment?: string | null;
  picture?: string | null;
}

export interface RegisterStopsResult {
  created: number;
  stopDataIds: number[];
}

export interface StopFormPrefill {
  stopReasonComposite?: string;
  partId?: number | null;
  orderNo?: string | null;
  comment?: string | null;
}

export interface UnitWebSettings {
  unchecked: number[];
  order: number[];
}

/** Initial card list — fetched once, then status-polled. */
export function useUnitsList() {
  return useQuery({
    queryKey: ['units', 'list'] as const,
    queryFn: async () => (await apiClient.get<UnitCard[]>('/units')).data,
    staleTime: 10_000,
  });
}

/** 5-second polling of running_status / unit_connected / latest machine_data. */
export function useUnitsStatus(machineIds: number[]) {
  const key = machineIds.join(',');
  return useQuery({
    queryKey: ['units', 'status', key] as const,
    queryFn: async () =>
      (await apiClient.get<UnitStatus[]>('/units/status', { params: { machineIds: key } })).data,
    enabled: machineIds.length > 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useUnregisteredBuckets(
  machineId: number | null,
  enabled: boolean,
  page = 1,
  perPage = 10,
) {
  return useQuery({
    queryKey: ['units', 'unregistered', machineId, page, perPage] as const,
    queryFn: async () =>
      (await apiClient.get<UnregisteredPage>(
        `/units/${machineId}/unregistered`, { params: { page, perPage } },
      )).data,
    enabled: enabled && machineId !== null,
    staleTime: 2_000,
  });
}

export function useRegisterStops(machineId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterStopsInput) =>
      (await apiClient.post<RegisterStopsResult>(`/units/${machineId}/stop-data`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units', 'list'] });
      qc.invalidateQueries({ queryKey: ['units', 'unregistered', machineId] });
      qc.invalidateQueries({ queryKey: ['units', 'status'] });
    },
  });
}

export function useUploadStopPicture(machineId: number | null) {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await apiClient.post<{ filename: string; key: string }>(
        `/units/${machineId}/stop-data/upload`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
  });
}

/** 24h Redis-backed "last used" prefill for the stop registration modal. */
export function useStopDialogPrefill(equipmentId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['units', 'stop-dialog', 'prefill', equipmentId] as const,
    queryFn: async () =>
      (await apiClient.get<StopFormPrefill>('/units/stop-dialog/last-used', {
        params: { equipmentId },
      })).data,
    enabled: enabled && equipmentId !== null,
    staleTime: 60_000,
  });
}

/** Per-user hidden + sort-order preferences for the unit list. */
export function useUnitWebSettings() {
  return useQuery({
    queryKey: ['units', 'settings'] as const,
    queryFn: async () => (await apiClient.get<UnitWebSettings>('/units/settings')).data,
    staleTime: 60_000,
  });
}

export function useSaveUnitWebSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UnitWebSettings) =>
      (await apiClient.post<UnitWebSettings>('/units/settings', input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['units', 'settings'] });
      qc.invalidateQueries({ queryKey: ['units', 'list'] });
    },
  });
}

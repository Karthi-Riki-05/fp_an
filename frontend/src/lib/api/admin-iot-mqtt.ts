'use client';

/**
 * Admin API for the MQTT v2 IoT fleet.
 *
 * Identity here is the physical UNIT (one Raspberry Pi), not the machine: a Pi
 * carries up to four machines on pins 1-4 over a single broker connection, so
 * credentials, presence and firmware are all per-unit.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';

// ── types ────────────────────────────────────────────────────────────────────

export interface MqttUnitRow {
  username: string;
  companyId: number;
  unitName: string;
  disabled: boolean;
  firmware: string | null;
  lastSeenAt: string | null;
  provisionedAt: string | null;
}

export interface OtaStatusRow {
  unitName: string;
  firmware: string | null;
  otaState: OtaState | null;
  otaVersion: string | null;
  otaDetail: string | null;
  otaUpdatedAt: string | null;
  lastSeenAt: string | null;
  disabled: boolean;
}

export type OtaState = 'downloading' | 'verifying' | 'applying' | 'success' | 'failed';

/** Returned once at provisioning. The password is not recoverable afterwards. */
export interface UnitCredentials {
  username: string;
  clientId: string;
  password: string;
  companyId: number;
  unitName: string;
  brokerUrl: string | null;
  topicPrefix: string;
  aclPattern: string;
  provisionedAt: string;
}

export interface FirmwareRelease {
  version: string;
  url: string;
  sha256: string | null;
  size: number | null;
  notes: string;
  mandatory: boolean;
  releasedAt?: string;
  releasedBy?: string | null;
  source?: 'db' | 'env';
}

export interface FirmwareReleaseInput {
  version: string;
  url: string;
  sha256: string;
  size?: number | null;
  notes?: string;
  mandatory?: boolean;
}

function headersFor(tenantId: number | null | undefined) {
  return tenantId ? { 'X-Tenant-Id': String(tenantId) } : {};
}

const UNITS_KEY = (t: number | null | undefined) => ['admin', 'mqtt-units', t] as const;
const OTA_KEY = (t: number | null | undefined) => ['admin', 'mqtt-ota-status', t] as const;
const FW_KEY = ['admin', 'iot-firmware'] as const;

// ── units ────────────────────────────────────────────────────────────────────

export function useMqttUnits(tenantId: number | null | undefined) {
  return useQuery({
    queryKey: UNITS_KEY(tenantId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MqttUnitRow[]; total: number }>(
        '/admin/iot/mqtt-units',
        { headers: headersFor(tenantId) },
      );
      return data.data;
    },
    staleTime: 15_000,
  });
}

export function useProvisionUnit(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { unitName: string; firmware?: string | null }) => {
      const { data } = await apiClient.post<{ success: boolean; data: UnitCredentials }>(
        '/admin/iot/mqtt-units/provision',
        input,
        { headers: headersFor(tenantId) },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNITS_KEY(tenantId) });
      qc.invalidateQueries({ queryKey: OTA_KEY(tenantId) });
    },
  });
}

export function useRevokeUnit(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unitName: string) => {
      const { data } = await apiClient.post('/admin/iot/mqtt-units/revoke', { unitName }, {
        headers: headersFor(tenantId),
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNITS_KEY(tenantId) });
      qc.invalidateQueries({ queryKey: OTA_KEY(tenantId) });
    },
  });
}

export function useSendUnitConfig(tenantId: number | null | undefined) {
  return useMutation({
    mutationFn: async (input: {
      unitName: string;
      off_on_ms?: number;
      on_off_ms?: number;
      pins?: Record<string, boolean>;
    }) => {
      const { data } = await apiClient.post('/admin/iot/mqtt-units/config', input, {
        headers: headersFor(tenantId),
      });
      return data;
    },
  });
}

export function useRebootUnit(tenantId: number | null | undefined) {
  return useMutation({
    mutationFn: async (input: { unitName: string; delaySeconds?: number }) => {
      const { data } = await apiClient.post('/admin/iot/mqtt-units/reboot', input, {
        headers: headersFor(tenantId),
      });
      return data;
    },
  });
}

// ── firmware ─────────────────────────────────────────────────────────────────

export function useFirmwareRelease() {
  return useQuery({
    queryKey: FW_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: FirmwareRelease | null; otaReady: boolean }>(
        '/admin/iot/firmware',
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export function usePublishRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FirmwareReleaseInput) => {
      const { data } = await apiClient.put<{ success: boolean; data: FirmwareRelease }>(
        '/admin/iot/firmware',
        input,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FW_KEY }),
  });
}

export interface OtaPushResult {
  sent?: number;
  failed?: Array<{ unitName: string; error: string }>;
  total?: number;
  cmdId?: string;
  version?: string;
  unitName?: string;
}

/** Omit unitName to target every enabled unit in the company. */
export function usePushOta(tenantId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { unitName?: string; force?: boolean }) => {
      const { data } = await apiClient.post<{ success: boolean; data: OtaPushResult }>(
        '/admin/iot/mqtt-units/ota',
        input,
        { headers: headersFor(tenantId) },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: OTA_KEY(tenantId) }),
  });
}

export function useOtaStatus(tenantId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: OTA_KEY(tenantId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: OtaStatusRow[]; total: number }>(
        '/admin/iot/mqtt-units/ota-status',
        { headers: headersFor(tenantId) },
      );
      return data.data;
    },
    enabled,
    staleTime: 5_000,
  });
}

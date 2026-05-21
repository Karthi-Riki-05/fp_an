/**
 * Zustand store for SuperAdmin real-time machine state.
 *
 * Machines are keyed by `${tenantId}:${machineId}` so the store can hold
 * live state for machines across all companies simultaneously.
 */

import { create } from 'zustand';

export interface AdminLiveMachineState {
  tenantId: number;
  machineId: number;
  runningStatus: string;
  unitConnected: string;
  lastOnline: string | null;
  openStop: { machineDataId: number; startTime: string } | null;
  lastStop: {
    machineDataId: number;
    startTime: string;
    endTime: string;
    productionTime: string;
  } | null;
}

// Socket event shapes (backend injects tenantId via emitToTenant/emitToMachine)
export interface AdminMachineEvent {
  tenantId: number;
  machineId: number;
  [key: string]: unknown;
}

export interface AdminStopStartedEvent extends AdminMachineEvent {
  machineDataId: number;
  startTime: string;
  equipmentId: number | null;
  ts: number;
}

export interface AdminStopEndedEvent extends AdminMachineEvent {
  machineDataId: number;
  startTime: string;
  endTime: string;
  productionTime: string;
  autoRegistered: boolean;
  stopDataId: number | null;
  ts: number;
}

export interface AdminStatusChangedEvent extends AdminMachineEvent {
  runningStatus?: string;
  unitConnected?: string;
  lastOnline?: string;
  ts: number;
}

function key(tenantId: number, machineId: number): string {
  return `${tenantId}:${machineId}`;
}

interface AdminSocketStoreState {
  machines: Record<string, AdminLiveMachineState>;
  connectedTenantIds: number[];
  socketConnected: boolean;

  setSocketConnected: (v: boolean) => void;
  setJoinedTenants: (ids: number[]) => void;
  applyStatusChanged: (e: AdminStatusChangedEvent) => void;
  applyStopStarted: (e: AdminStopStartedEvent) => void;
  applyStopEnded: (e: AdminStopEndedEvent) => void;
  applySnapshot: (
    tenantId: number,
    machines: Array<{
      machineId: number;
      runningStatus: string;
      unitConnected: string;
      lastOnline: string | null;
      equipmentId: number;
    }>,
  ) => void;
  getMachinesForTenant: (tenantId: number) => AdminLiveMachineState[];
}

export const useAdminSocketStore = create<AdminSocketStoreState>((set, get) => ({
  machines: {},
  connectedTenantIds: [],
  socketConnected: false,

  setSocketConnected: (v) => set({ socketConnected: v }),
  setJoinedTenants: (ids) => set({ connectedTenantIds: ids }),

  applyStatusChanged: (e) =>
    set((s) => {
      const k = key(e.tenantId, e.machineId);
      const prev = s.machines[k];
      return {
        machines: {
          ...s.machines,
          [k]: {
            tenantId: e.tenantId,
            machineId: e.machineId,
            runningStatus: e.runningStatus ?? prev?.runningStatus ?? 'on',
            unitConnected: e.unitConnected ?? prev?.unitConnected ?? 'yes',
            lastOnline: e.lastOnline ?? prev?.lastOnline ?? null,
            openStop: prev?.openStop ?? null,
            lastStop: prev?.lastStop ?? null,
          },
        },
      };
    }),

  applyStopStarted: (e) =>
    set((s) => {
      const k = key(e.tenantId, e.machineId);
      const prev = s.machines[k];
      return {
        machines: {
          ...s.machines,
          [k]: {
            tenantId: e.tenantId,
            machineId: e.machineId,
            runningStatus: 'off',
            unitConnected: prev?.unitConnected ?? 'yes',
            lastOnline: prev?.lastOnline ?? null,
            openStop: { machineDataId: e.machineDataId, startTime: e.startTime },
            lastStop: prev?.lastStop ?? null,
          },
        },
      };
    }),

  applyStopEnded: (e) =>
    set((s) => {
      const k = key(e.tenantId, e.machineId);
      const prev = s.machines[k];
      return {
        machines: {
          ...s.machines,
          [k]: {
            tenantId: e.tenantId,
            machineId: e.machineId,
            runningStatus: 'on',
            unitConnected: prev?.unitConnected ?? 'yes',
            lastOnline: prev?.lastOnline ?? null,
            openStop: null,
            lastStop: {
              machineDataId: e.machineDataId,
              startTime: e.startTime,
              endTime: e.endTime,
              productionTime: e.productionTime,
            },
          },
        },
      };
    }),

  applySnapshot: (tenantId, snapshotMachines) =>
    set((s) => {
      const updated = { ...s.machines };
      for (const m of snapshotMachines) {
        const k = key(tenantId, m.machineId);
        updated[k] = {
          tenantId,
          machineId: m.machineId,
          runningStatus: m.runningStatus,
          unitConnected: m.unitConnected,
          lastOnline: m.lastOnline,
          openStop: updated[k]?.openStop ?? null,
          lastStop: updated[k]?.lastStop ?? null,
        };
      }
      return { machines: updated };
    }),

  getMachinesForTenant: (tenantId) => {
    const { machines } = get();
    return Object.values(machines).filter((m) => m.tenantId === tenantId);
  },
}));

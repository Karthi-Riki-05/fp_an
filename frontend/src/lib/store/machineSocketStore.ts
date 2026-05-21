/**
 * Zustand store — holds real-time machine state updates delivered via
 * Socket.io events.  Components read from this store; the
 * MachineSocketProvider populates it.
 */

import { create } from 'zustand';
import type {
  MachineStatusChangedEvent,
  MachineStopStartedEvent,
  MachineStopEndedEvent,
} from '../socket';

export interface LiveMachineState {
  machineId: number;
  runningStatus: string;
  unitConnected: string;
  lastOnline: string | null;
  /** Most recently opened stop record (before end_time is known). */
  openStop: { machineDataId: number; startTime: string } | null;
  /** Most recently closed stop record. */
  lastStop: { machineDataId: number; startTime: string; endTime: string; productionTime: string } | null;
}

interface MachineSocketState {
  machines: Record<number, LiveMachineState>;
  connected: boolean;
  lastSyncTs: number | null;

  setConnected: (v: boolean) => void;
  applyStatusChanged: (e: MachineStatusChangedEvent) => void;
  applyStopStarted: (e: MachineStopStartedEvent) => void;
  applyStopEnded: (e: MachineStopEndedEvent) => void;
  applySnapshot: (machines: Array<{ machineId: number; runningStatus: string; unitConnected: string; lastOnline: string | null; equipmentId: number }>) => void;
}

export const useMachineSocketStore = create<MachineSocketState>((set) => ({
  machines: {},
  connected: false,
  lastSyncTs: null,

  setConnected: (v) => set({ connected: v }),

  applyStatusChanged: (e) =>
    set((s) => ({
      machines: {
        ...s.machines,
        [e.machineId]: {
          ...s.machines[e.machineId],
          machineId: e.machineId,
          runningStatus: e.runningStatus ?? s.machines[e.machineId]?.runningStatus ?? 'on',
          unitConnected: e.unitConnected ?? s.machines[e.machineId]?.unitConnected ?? 'yes',
          lastOnline: e.lastOnline ?? s.machines[e.machineId]?.lastOnline ?? null,
          openStop: s.machines[e.machineId]?.openStop ?? null,
          lastStop: s.machines[e.machineId]?.lastStop ?? null,
        },
      },
    })),

  applyStopStarted: (e) =>
    set((s) => ({
      machines: {
        ...s.machines,
        [e.machineId]: {
          ...s.machines[e.machineId],
          machineId: e.machineId,
          runningStatus: 'off',
          unitConnected: s.machines[e.machineId]?.unitConnected ?? 'yes',
          lastOnline: s.machines[e.machineId]?.lastOnline ?? null,
          openStop: { machineDataId: e.machineDataId, startTime: e.startTime },
          lastStop: s.machines[e.machineId]?.lastStop ?? null,
        },
      },
    })),

  applyStopEnded: (e) =>
    set((s) => ({
      machines: {
        ...s.machines,
        [e.machineId]: {
          ...s.machines[e.machineId],
          machineId: e.machineId,
          runningStatus: 'on',
          unitConnected: s.machines[e.machineId]?.unitConnected ?? 'yes',
          lastOnline: s.machines[e.machineId]?.lastOnline ?? null,
          openStop: null,
          lastStop: {
            machineDataId: e.machineDataId,
            startTime: e.startTime,
            endTime: e.endTime,
            productionTime: e.productionTime,
          },
        },
      },
    })),

  applySnapshot: (snapshotMachines) =>
    set((s) => {
      const updated = { ...s.machines };
      for (const m of snapshotMachines) {
        updated[m.machineId] = {
          machineId: m.machineId,
          runningStatus: m.runningStatus,
          unitConnected: m.unitConnected,
          lastOnline: m.lastOnline,
          openStop: updated[m.machineId]?.openStop ?? null,
          lastStop: updated[m.machineId]?.lastStop ?? null,
        };
      }
      return { machines: updated, lastSyncTs: Date.now() };
    }),
}));

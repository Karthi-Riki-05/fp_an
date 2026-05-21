/**
 * useLiveMachine — returns real-time state for a single machine.
 *
 * Falls back gracefully when no Socket.io state is available yet
 * (e.g. initial load, broker down) so components can blend REST
 * data with live updates.
 *
 * Usage:
 *   const live = useLiveMachine(machineId);
 *   // live.runningStatus overrides the REST-fetched value when available.
 */

import { useMachineSocketStore, type LiveMachineState } from '../lib/store/machineSocketStore';

export function useLiveMachine(machineId: number): LiveMachineState | null {
  return useMachineSocketStore((s) => s.machines[machineId] ?? null);
}

/**
 * useLiveMachines — returns a map of all machines with live state.
 * Useful for list views that show status indicators per row.
 */
export function useLiveMachines(): Record<number, LiveMachineState> {
  return useMachineSocketStore((s) => s.machines);
}

/**
 * useSocketConnected — true when the Socket.io connection is active.
 * Components can use this to show a "live" badge or fall back to polling.
 */
export function useSocketConnected(): boolean {
  return useMachineSocketStore((s) => s.connected);
}

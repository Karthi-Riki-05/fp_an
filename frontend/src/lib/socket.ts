/**
 * Socket.io client singleton for real-time machine status updates.
 *
 * The browser sends the access_token httpOnly cookie automatically when
 * withCredentials is true.  The server parses it from the Cookie header in
 * its auth middleware — no explicit token is needed client-side.
 *
 * Usage:
 *   const socket = getSocket();  // connects on first call
 *   socket.disconnect();          // on logout / layout unmount
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket && _socket.connected) return _socket;

  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  _socket = io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,   // sends access_token cookie automatically
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  });

  return _socket;
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}

export function getActiveSocket(): Socket | null {
  return _socket;
}

// ── typed event payloads ──────────────────────────────────────────────────────

export interface MachineStatusChangedEvent {
  machineId: number;
  runningStatus?: 'on' | 'off' | 'warning';
  unitConnected?: 'yes' | 'no';
  lastOnline?: string;
  ts: number;
}

export interface MachineStopStartedEvent {
  machineId: number;
  machineDataId: number;
  startTime: string;
  equipmentId: number | null;
  ts: number;
}

export interface MachineStopEndedEvent {
  machineId: number;
  machineDataId: number;
  startTime: string;
  endTime: string;
  productionTime: string;
  autoRegistered: boolean;
  stopDataId: number | null;
  ts: number;
}

export interface MachineOnlineEvent {
  machineId: number;
  connected: true;
  reason: string;
  ts: number;
}

export interface MachineOfflineEvent {
  machineId: number;
  connected: false;
  reason: string;
  ts: number;
}

export interface MachineEnrolledEvent {
  machineId: number;
  pinNo: number;
  unitName: string;
  tenantId: number;
  ts: number;
}

export interface MachineReplayCompleteEvent {
  machineId: number;
  committed: number;
  total: number;
  failedAt: number | null;
  ts: number;
}

export interface MachineFirmwareUpdateEvent {
  machineId: number;
  currentVersion: string;
  latestVersion: string;
  ts: number;
}

export interface ResyncSnapshotEvent {
  machines: Array<{
    machineId: number;
    runningStatus: string;
    unitConnected: string;
    lastOnline: string | null;
    equipmentId: number;
  }>;
  recentStops: Array<{
    id: number;
    machineId: number;
    startTime: string;
    endTime: string | null;
    productionTime: string | null;
  }>;
  ts: number;
}

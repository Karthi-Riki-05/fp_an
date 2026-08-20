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

// ── MQTT v2 fleet events ──────────────────────────────────────────────────────
// Presence, OTA and integrity signals. These are per physical UNIT (one
// Raspberry Pi), not per machine — a unit carries up to 4 machines on pins 1-4.

export interface UnitPresenceEvent {
  tenantId: number;
  unitName: string;
  online: boolean;
  /** 'connect' | 'shutdown' | 'lwt' — 'lwt' means the unit dropped without saying goodbye. */
  reason: string;
  firmware: string | null;
  ip: string | null;
  ts: number;
}

export interface UnitOtaProgressEvent {
  tenantId: number;
  unitName: string;
  state: 'downloading' | 'verifying' | 'applying' | 'success' | 'failed';
  version: string | null;
  detail: string | null;
  cmdId: string | null;
  ts: number;
}

/** Emitted when a unit's event sequence skips — events were lost in transit. */
export interface SequenceGapEvent {
  tenantId: number;
  machineId: number;
  unitName: string;
  expected: number;
  received: number;
  missing: number;
  ts: number;
}

export interface UnitSnapshotEvent {
  tenantId: number;
  unitName: string;
  machines: Array<{
    machineId: number;
    pinNo: number;
    reportedState: string | null;
    dbState: string;
    enabled: boolean;
  }>;
  /** Pins where the device and the database disagree — means events were lost. */
  drift: UnitSnapshotEvent['machines'];
  firmware: string | null;
  droppedCount: number;
  ts: number;
}

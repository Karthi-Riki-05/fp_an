'use client';

/**
 * MachineSocketProvider — mounts once inside the authenticated layout.
 *
 * The browser sends the access_token httpOnly cookie automatically via
 * withCredentials — no explicit token prop is needed here.
 *
 * Lifecycle:
 *   • Connects when mounted (authenticated layout renders).
 *   • Emits client:resync on (re)connect to catch up on missed events.
 *   • Writes all machine events into useMachineSocketStore.
 *   • Disconnects on unmount (logout / layout teardown).
 */

import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../../lib/socket';
import { useMachineSocketStore } from '../../lib/store/machineSocketStore';
import type {
  MachineStatusChangedEvent,
  MachineStopStartedEvent,
  MachineStopEndedEvent,
  ResyncSnapshotEvent,
} from '../../lib/socket';

export function MachineSocketProvider() {
  const applyStatusChanged = useMachineSocketStore((s) => s.applyStatusChanged);
  const applyStopStarted = useMachineSocketStore((s) => s.applyStopStarted);
  const applyStopEnded = useMachineSocketStore((s) => s.applyStopEnded);
  const applySnapshot = useMachineSocketStore((s) => s.applySnapshot);
  const setConnected = useMachineSocketStore((s) => s.setConnected);
  const lastSyncTs = useMachineSocketStore((s) => s.lastSyncTs);
  const lastSyncTsRef = useRef(lastSyncTs);

  useEffect(() => {
    lastSyncTsRef.current = lastSyncTs;
  }, [lastSyncTs]);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      socket.emit('client:resync', { lastSeenTs: lastSyncTsRef.current });
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onSnapshot(data: ResyncSnapshotEvent) {
      applySnapshot(data.machines);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('resync:snapshot', onSnapshot);
    socket.on('machine:status:changed', (e: MachineStatusChangedEvent) => applyStatusChanged(e));
    socket.on('machine:stop:started', (e: MachineStopStartedEvent) => applyStopStarted(e));
    socket.on('machine:stop:ended', (e: MachineStopEndedEvent) => applyStopEnded(e));
    socket.on('machine:online', (e: MachineStatusChangedEvent) =>
      applyStatusChanged({ ...e, unitConnected: 'yes' }),
    );
    socket.on('machine:offline', (e: MachineStatusChangedEvent) =>
      applyStatusChanged({ ...e, unitConnected: 'no' }),
    );

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('resync:snapshot', onSnapshot);
      socket.off('machine:status:changed');
      socket.off('machine:stop:started');
      socket.off('machine:stop:ended');
      socket.off('machine:online');
      socket.off('machine:offline');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      disconnectSocket();
      setConnected(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

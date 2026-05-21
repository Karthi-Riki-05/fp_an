'use client';

/**
 * AdminSocketProvider — mounts inside the SuperAdmin layout (AdminShell).
 *
 * On connect it emits `admin:join:all` so the socket is added to every active
 * tenant room.  Incoming machine events (which now carry a `tenantId` field
 * injected by the backend's emitToTenant wrapper) are written into
 * useAdminSocketStore keyed by `${tenantId}:${machineId}`.
 *
 * Lifecycle mirrors MachineSocketProvider but uses the separate admin socket
 * singleton so it never interferes with operator-facing connections.
 */

import { useEffect } from 'react';
import { getAdminSocket, disconnectAdminSocket } from '../../lib/adminSocket';
import {
  useAdminSocketStore,
  type AdminStatusChangedEvent,
  type AdminStopStartedEvent,
  type AdminStopEndedEvent,
} from '../../lib/store/adminSocketStore';

export function AdminSocketProvider() {
  const setSocketConnected = useAdminSocketStore((s) => s.setSocketConnected);
  const setJoinedTenants  = useAdminSocketStore((s) => s.setJoinedTenants);
  const applyStatusChanged = useAdminSocketStore((s) => s.applyStatusChanged);
  const applyStopStarted  = useAdminSocketStore((s) => s.applyStopStarted);
  const applyStopEnded    = useAdminSocketStore((s) => s.applyStopEnded);
  const applySnapshot     = useAdminSocketStore((s) => s.applySnapshot);

  useEffect(() => {
    const socket = getAdminSocket();

    function onConnect() {
      setSocketConnected(true);
      socket.emit('admin:join:all');
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onAdminJoined(data: { tenantIds: number[] }) {
      setJoinedTenants(data.tenantIds);
      // Request a snapshot for each joined tenant.
      for (const tenantId of data.tenantIds) {
        socket.emit('client:resync:tenant', { tenantId }, (snap: unknown) => {
          if (snap && typeof snap === 'object' && 'machines' in snap) {
            applySnapshot(
              tenantId,
              (snap as { machines: Parameters<typeof applySnapshot>[1] }).machines,
            );
          }
        });
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:joined', onAdminJoined);

    socket.on('machine:status:changed', (e: AdminStatusChangedEvent) => applyStatusChanged(e));
    socket.on('machine:stop:started',   (e: AdminStopStartedEvent)   => applyStopStarted(e));
    socket.on('machine:stop:ended',     (e: AdminStopEndedEvent)      => applyStopEnded(e));
    socket.on('machine:online',  (e: AdminStatusChangedEvent) =>
      applyStatusChanged({ ...e, unitConnected: 'yes' }),
    );
    socket.on('machine:offline', (e: AdminStatusChangedEvent) =>
      applyStatusChanged({ ...e, unitConnected: 'no' }),
    );

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:joined', onAdminJoined);
      socket.off('machine:status:changed');
      socket.off('machine:stop:started');
      socket.off('machine:stop:ended');
      socket.off('machine:online');
      socket.off('machine:offline');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      disconnectAdminSocket();
      setSocketConnected(false);
      setJoinedTenants([]);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

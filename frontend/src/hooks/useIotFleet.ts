'use client';

/**
 * Live fleet state from the MQTT v2 socket events.
 *
 * The admin pages read presence and OTA progress from here rather than polling:
 * a unit going offline is pushed by the broker's Last Will within ~90 s, and OTA
 * steps arrive as the device reports them.
 *
 * State is keyed by unitName because these events describe a physical Raspberry
 * Pi, not an individual machine.
 */

import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import type {
  SequenceGapEvent,
  UnitOtaProgressEvent,
  UnitPresenceEvent,
  UnitSnapshotEvent,
} from '../lib/socket';

export interface LiveUnitState {
  unitName: string;
  online?: boolean;
  reason?: string;
  firmware?: string | null;
  ip?: string | null;
  lastChangeTs?: number;
  otaState?: UnitOtaProgressEvent['state'];
  otaVersion?: string | null;
  otaDetail?: string | null;
  otaTs?: number;
  droppedCount?: number;
  /** Pins where the device's reported state disagrees with the database. */
  driftPins?: number[];
}

export interface FleetGapWarning {
  unitName: string;
  machineId: number;
  missing: number;
  ts: number;
}

export function useIotFleet() {
  const [units, setUnits] = useState<Record<string, LiveUnitState>>({});
  const [gaps, setGaps] = useState<FleetGapWarning[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const merge = (unitName: string, patch: Partial<LiveUnitState>) =>
      setUnits((prev) => ({
        ...prev,
        [unitName]: { ...(prev[unitName] ?? { unitName }), ...patch },
      }));

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onPresence = (e: UnitPresenceEvent) =>
      merge(e.unitName, {
        online: e.online,
        reason: e.reason,
        firmware: e.firmware,
        ip: e.ip,
        lastChangeTs: e.ts,
      });

    const onOta = (e: UnitOtaProgressEvent) =>
      merge(e.unitName, {
        otaState: e.state,
        otaVersion: e.version,
        otaDetail: e.detail,
        otaTs: e.ts,
      });

    const onSnapshot = (e: UnitSnapshotEvent) =>
      merge(e.unitName, {
        firmware: e.firmware,
        droppedCount: e.droppedCount,
        driftPins: (e.drift ?? []).map((d) => d.pinNo),
      });

    // Keep only the most recent warnings — this is a live indicator, not a log.
    const onGap = (e: SequenceGapEvent) =>
      setGaps((prev) =>
        [{ unitName: e.unitName, machineId: e.machineId, missing: e.missing, ts: e.ts }, ...prev].slice(0, 20),
      );

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('machine:unit:online', onPresence);
    socket.on('machine:unit:offline', onPresence);
    socket.on('machine:ota:progress', onOta);
    socket.on('machine:unit:snapshot', onSnapshot);
    socket.on('machine:sequence:gap', onGap);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('machine:unit:online', onPresence);
      socket.off('machine:unit:offline', onPresence);
      socket.off('machine:ota:progress', onOta);
      socket.off('machine:unit:snapshot', onSnapshot);
      socket.off('machine:sequence:gap', onGap);
    };
  }, []);

  return { units, gaps, connected };
}

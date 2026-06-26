'use strict';
const { withTenant } = require('../prisma/client');
const { getOeeMetrics } = require('./admin-chart-data.service');

/**
 * getAndon — live data for a public Andon TV board scoped to one flow.
 *
 * Returns the flow's machines with current status (from the `machines`
 * table), today's lost time, today's OEE headline, and a ticker of recent
 * unlogged stops.
 *
 * Schema notes / deviations from the spec:
 *   • `MachineRunningStatus` enum is only `on` / `off` — there is no
 *     machine-level `warning` state. We synthesise WARNING from
 *     `unit_connected = 'no'` (sensor offline) or a missing machines row.
 *   • Flow → equipment is via `flow_design_attributes` where `type='Equipment'`
 *     (`relation_id` = equipment.id).
 *   • Per-node "OEE %" is an availability proxy: 1 − lostMinutesToday /
 *     minutesSinceLocalMidnight (true per-machine OEE needs per-equipment
 *     planned/qty/cycle data — tracked as a follow-up). The headline OEE in
 *     the stat row is the tenant-wide `getOeeMetrics()` for today.
 */
async function getAndon(tenant, flowId) {
  const id = Number(flowId);

  const [board, oeeToday] = await Promise.all([
    withTenant(tenant, async (tx) => {
      const flowRows = await tx.$queryRawUnsafe(
        `SELECT name FROM flow_designs WHERE id = $1 AND deleted_at IS NULL`, id
      );

      const machineRows = await tx.$queryRawUnsafe(
        `SELECT e.id                AS equipment_id,
                e.name              AS equipment_name,
                m.id                AS machine_id,
                m.unit_name         AS unit_name,
                m.running_status::text AS running_status,
                m.unit_connected    AS unit_connected,
                m.last_online       AS last_online,
                COALESCE(s.lost_seconds, 0) AS lost_seconds
         FROM flow_design_attributes fda
         JOIN equipment e ON e.id = fda.relation_id AND e.deleted_at IS NULL
         LEFT JOIN machines m ON m.equipment_id = e.id
         LEFT JOIN (
           SELECT flow_object_key, SUM(sum_of_time) AS lost_seconds
           FROM stop_data
           WHERE deleted_at IS NULL AND date = CURRENT_DATE
           GROUP BY flow_object_key
         ) s ON s.flow_object_key = e.id
         WHERE fda.flow_design_id = $1 AND fda.type = 'Equipment'
         ORDER BY e.name`, id
      );

      const ticker = await tx.$queryRawUnsafe(
        `SELECT e.name AS machine_name, sd.created_at, sd.sum_of_time
         FROM stop_data sd
         LEFT JOIN equipment e ON e.id = sd.flow_object_key
         WHERE sd.flow_id = $1 AND sd.deleted_at IS NULL AND sd.date = CURRENT_DATE
           AND COALESCE(sd.stop_type_id, 0) = 0
         ORDER BY sd.created_at DESC NULLS LAST
         LIMIT 20`, id
      );

      return { flowName: flowRows[0]?.name ?? `Flow ${id}`, machineRows, ticker };
    }),
    getOeeMetrics(tenant, undefined, undefined), // undefined from/to → today..today
  ]);

  const now = new Date();
  const minutesSinceMidnight = Math.max(1, now.getHours() * 60 + now.getMinutes());
  const clampPct = (n) => Math.min(100, Math.max(0, Math.round(n)));

  // Dedupe equipment nodes (an equipment can have >1 machines row) — keep the
  // worst status (off beats disconnected beats on) and the max lost time.
  const byEquip = new Map();
  for (const r of board.machineRows) {
    const eqId = Number(r.equipment_id);
    const lostMinutes = Number(r.lost_seconds || 0) / 60;
    let status;
    if (r.machine_id == null) status = 'warning';
    else if (r.running_status === 'off') status = 'stopped';
    else if (r.unit_connected === 'no') status = 'warning';
    else status = 'running';

    const node = {
      equipmentId: eqId,
      name: r.unit_name || r.equipment_name || `#${eqId}`,
      status,
      lostMinutesToday: Math.round(lostMinutes),
      oee: clampPct((1 - lostMinutes / minutesSinceMidnight) * 100),
      lastOnline: r.last_online ?? null,
    };

    const prev = byEquip.get(eqId);
    if (!prev) { byEquip.set(eqId, node); continue; }
    const rank = { stopped: 3, warning: 2, running: 1 };
    if (rank[node.status] > rank[prev.status]) prev.status = node.status;
    prev.lostMinutesToday = Math.max(prev.lostMinutesToday, node.lostMinutesToday);
    prev.oee = Math.min(prev.oee, node.oee);
  }
  const machines = [...byEquip.values()];

  const counts = {
    running: machines.filter((m) => m.status === 'running').length,
    stopped: machines.filter((m) => m.status === 'stopped').length,
    warning: machines.filter((m) => m.status === 'warning').length,
  };

  const lostSecondsTotal = board.ticker.reduce((s, r) => s + Number(r.sum_of_time || 0), 0)
    + board.machineRows.reduce((s, r) => s + Number(r.lost_seconds || 0), 0);
  // Lost time today across the flow, in hours (from per-equipment stop sums).
  const lostHoursToday = Math.round(
    (board.machineRows.reduce((s, r) => s + Number(r.lost_seconds || 0), 0) / 3600) * 10
  ) / 10;

  const ticker = board.ticker.map((r) => {
    const ts = r.created_at ? new Date(r.created_at).getTime() : now.getTime();
    const minsAgo = Math.max(0, Math.round((now.getTime() - ts) / 60000));
    return {
      machineName: r.machine_name || 'Unknown',
      minutesAgo: minsAgo,
      text: `${r.machine_name || 'Unknown'} stopped ${minsAgo} min ago`,
    };
  });

  return {
    flowId: id,
    flowName: board.flowName,
    oee: oeeToday.oee,
    counts,
    lostHoursToday,
    machines,
    ticker,
    serverTime: now.toISOString(),
  };
}

module.exports = { getAndon };

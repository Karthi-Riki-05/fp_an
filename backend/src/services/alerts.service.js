'use strict';
const { withTenant } = require('../prisma/client');

/**
 * getAlerts — operator alert feed for the authenticated tenant.
 *
 * Combines two real sources into a single, newest-first list:
 *
 *   • CRITICAL — "unlogged stops": stop_data rows with no stop type assigned
 *     yet (an IoT-registered stop the operator still has to classify).
 *     NOTE: stop_data.stop_type_id is NOT nullable (Int @default(0)), so the
 *     spec's `stop_type_id IS NULL` can never match — "unlogged" here means
 *     stop_type_id = 0 (no type chosen) AND reason = 0.
 *   • WARNING — warning_data rows.
 *     NOTE: warning_data has NO `acknowledged_at` and NO `deleted_at` column
 *     (verified against the live schema), so the spec's
 *     `deleted_at IS NULL AND acknowledged_at IS NULL` filter is not possible.
 *     We instead return warnings from the last `windowDays` days (there is no
 *     acknowledge state to filter on yet).
 *
 * INFO alerts have no backing table — they are a frontend-only concept for now.
 *
 * Each item: { id, type:'stop'|'warning', severity:'critical'|'warning',
 *              machineName, message, createdAt, equipmentId, flowId }
 */
async function getAlerts(tenant, { windowDays = 7, limit = 100 } = {}) {
  return withTenant(tenant, async (tx) => {
    const stops = await tx.$queryRawUnsafe(
      `SELECT sd.id,
              e.name        AS machine_name,
              sd.flow_object_key AS equipment_id,
              sd.flow_id    AS flow_id,
              sd.created_at AS created_at,
              sd.date       AS date
       FROM stop_data sd
       LEFT JOIN equipment e ON e.id = sd.flow_object_key
       WHERE sd.deleted_at IS NULL
         AND COALESCE(sd.stop_type_id, 0) = 0
         AND COALESCE(sd.reason, 0) = 0
       ORDER BY sd.created_at DESC NULLS LAST
       LIMIT $1`,
      limit
    );

    // Warnings — exclude acknowledged ones (Sprint 3 / Task 2). The
    // `acknowledged_at` column is added by migration 20260603000002 to every
    // tenant schema; the ack filter is only applied when that column exists
    // (see the column-presence probe below).
    const warningsBase = (ackFilter) =>
      `SELECT wd.id,
              e.name               AS machine_name,
              wd.equipment_id      AS equipment_id,
              wd.notification_text AS message,
              wd.created_at        AS created_at
       FROM warning_data wd
       LEFT JOIN equipment e ON e.id = wd.equipment_id
       WHERE wd.created_at >= (CURRENT_DATE - ($1::int)) ${ackFilter}
       ORDER BY wd.created_at DESC NULLS LAST
       LIMIT $2`;
    // Decide whether to apply the "unacknowledged only" filter by checking if
    // the column actually exists in the resolved tenant schema FIRST. The old
    // approach ran the filtered query inside try/catch and fell back on error —
    // but a failed statement aborts the whole Postgres transaction (withTenant
    // wraps everything in one tx), so the fallback query then died with
    // `25P02: current transaction is aborted`. A SELECT against
    // information_schema never errors, so it can't poison the transaction.
    // Tenants migrated by 20260603000002 get the filter; un-migrated tenants
    // fall back to the unfiltered window instead of 500-ing.
    const ackCols = await tx.$queryRawUnsafe(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_name = 'warning_data'
          AND column_name = 'acknowledged_at'
          AND table_schema = ANY (current_schemas(false))
        LIMIT 1`
    );
    const hasAck = Array.isArray(ackCols) && ackCols.length > 0;
    const warnings = await tx.$queryRawUnsafe(
      warningsBase(hasAck ? 'AND wd.acknowledged_at IS NULL' : ''),
      windowDays,
      limit
    );

    const stopItems = stops.map((r) => ({
      id: Number(r.id),
      type: 'stop',
      severity: 'critical',
      machineName: r.machine_name || 'Unknown machine',
      message: 'Unlogged stop — needs a reason',
      createdAt: r.created_at ?? r.date ?? null,
      equipmentId: Number(r.equipment_id ?? 0),
      flowId: Number(r.flow_id ?? 0),
    }));

    const warnItems = warnings.map((r) => ({
      id: Number(r.id),
      type: 'warning',
      severity: 'warning',
      machineName: r.machine_name || 'Unknown machine',
      message: r.message || 'Warning',
      createdAt: r.created_at ?? null,
      equipmentId: Number(r.equipment_id ?? 0),
      flowId: 0,
    }));

    const items = [...stopItems, ...warnItems].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return {
      items,
      unread: items.length,
      counts: {
        critical: stopItems.length,
        warning: warnItems.length,
        info: 0,
      },
    };
  });
}

/**
 * acknowledgeWarning — mark a warning_data row acknowledged (Sprint 3 / Task 2).
 * Returns true if a row was updated. Requires migration 20260603000002.
 */
async function acknowledgeWarning(tenant, id, userId) {
  return withTenant(tenant, async (tx) => {
    const affected = await tx.$executeRawUnsafe(
      `UPDATE warning_data
       SET acknowledged_at = now(), acknowledged_by = $2
       WHERE id = $1 AND acknowledged_at IS NULL`,
      Number(id), Number(userId) || null
    );
    return affected > 0;
  });
}

module.exports = { getAlerts, acknowledgeWarning };

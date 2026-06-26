'use strict';
const { withTenant } = require('../prisma/client');

async function getChartData(tenant, settings, from, to) {
  const { flow_id, equip_id, chart_type = 'stop_data', prod_group } = settings;
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    const baseWhere = `flow_id = $1 AND date BETWEEN $2::date AND $3::date AND deleted_at IS NULL`;
    const params = [flow_id ?? 0, start, end];

    if (chart_type === 'stop_data') {
      return tx.$queryRawUnsafe(
        `SELECT sr.id AS reason_id, sr.name, SUM(sd.quantity) AS quantity, SUM(sd.sum_of_time) AS sum_of_time
         FROM stop_data sd LEFT JOIN stop_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sr.id, sr.name ORDER BY quantity DESC`, ...params
      );
    } else if (chart_type === 'stop_count') {
      return tx.$queryRawUnsafe(
        `SELECT sd.date, sr.name, SUM(sd.quantity) AS quantity, SUM(sd.time) AS total_time
         FROM stop_data sd LEFT JOIN stop_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sd.date, sr.name ORDER BY sd.date DESC`, ...params
      );
    } else if (chart_type === 'scrap_data') {
      return tx.$queryRawUnsafe(
        `SELECT sr.id AS reason_id, sr.name, SUM(sd.quantity) AS quantity
         FROM scrap_data sd LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sr.id, sr.name ORDER BY quantity DESC`, ...params
      );
    } else if (chart_type === 'production_data') {
      const groupCol = prod_group === 'part' ? 'p.part_no || \'-\' || p.name'
        : prod_group === 'equipment' ? 'e.name'
        : prod_group === 'work_shift' ? 'pd.work_shift_name'
        : 'pd.order_no';
      const joinClause = prod_group === 'part'
        ? 'LEFT JOIN parts p ON p.id = pd.part_id'
        : prod_group === 'equipment'
        ? 'LEFT JOIN equipment e ON e.id = pd.flow_object_key'
        : '';
      return tx.$queryRawUnsafe(
        `SELECT pd.date, ${groupCol} AS name, SUM(pd.part_qty) AS ok_qty, SUM(pd.planned_qty) AS planned_qty
         FROM production_data pd ${joinClause}
         WHERE ${baseWhere} GROUP BY pd.date, ${groupCol} ORDER BY pd.date DESC`, ...params
      );
    }
    return [];
  });
}

/**
 * getOeeMetrics — tenant-wide OEE for a date range, computed from real data.
 *
 * OEE = Availability × Performance × Quality, returned as 0–100 percentages
 * alongside the three component factors (also 0–100).
 *
 *   Availability = run time / planned time
 *                = (plannedMinutes − downtimeMinutes) / plannedMinutes
 *   Performance  = (idealCycleTimeMinutes × actualQty) / runTimeMinutes
 *   Quality      = (actualQty − scrapQty) / actualQty
 *
 * IMPORTANT — the live schema does not match the column names in the task
 * spec, so the following mappings/decisions were made (see SPRINT_PLAN.md):
 *   • Planned time: shift_schedules has NO duration column. Planned minutes
 *     come from shift_schedule_data event windows (start→end). Recurring
 *     events (is_recurring/rc_data) ARE now expanded across the range via
 *     generate_series (Sprint 2 / Task 3); frequency is inferred from the
 *     free-text rc_data column (week/month/daily heuristic).
 *   • Downtime: stop_data.sum_of_time is in SECONDS → /60 for minutes.
 *     "Exclude from OEE" is types.exclude_type = true joined via
 *     stop_data.stop_type_id (a boolean flag, not a string label).
 *   • Ideal cycle time: there is no idealCycleTime column. Read from the typed
 *     equipment_properties.cycle_time_seconds (Sprint 3 / Task 6), falling back
 *     to parsing the legacy free-text cycle_time VARCHAR. Averaged across
 *     equipment, converted to minutes/part.
 *   • Production: actualQty = SUM(part_qty), scrapQty = SUM(scrap_data.quantity).
 *
 * All component ratios are clamped to [0,1] so a sparse/incomplete data range
 * cannot produce nonsensical >100% figures. When planned time or actual qty
 * is zero the dependent factor is reported as 0 and `computable` flags which
 * inputs were missing so the UI can show an honest empty state.
 */
async function getOeeMetrics(tenant, from, to) {
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    // 1) Planned minutes from shift schedule events overlapping the range.
    //    NON-recurring events contribute their stored window (start→end).
    //    RECURRING events (is_recurring = true) are EXPANDED across the range
    //    with generate_series at a frequency inferred from the free-text
    //    `rc_data` column. The case-insensitive 'week'/'month' match
    //    intentionally covers ALL three plausible encodings (Sprint 4 / Task 4):
    //      • JSON     {"freq":"weekly"}      → contains "week"
    //      • iCal     FREQ=WEEKLY;BYDAY=MO   → contains "week" (ILIKE)
    //      • plaintext "weekly"              → contains "week"
    //    default daily otherwise. (Live rc_data values could not be inspected
    //    here — no DB — so the substring match is kept; run the verification
    //    query in SPRINT_PLAN before assuming the encoding.) Each occurrence
    //    contributes the same per-event duration; only occurrences within
    //    [from,to] count. The series starts at the event's own start date so
    //    weekly/monthly recurrences keep their original weekday/day-of-month.
    const plannedRows = await tx.$queryRawUnsafe(
      `WITH non_recurring AS (
         SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ssd."end" - ssd.start)) / 60.0), 0) AS mins
         FROM shift_schedule_data ssd
         JOIN shift_schedules ss ON ss.id = ssd.schedule_id AND ss.deleted_at IS NULL
         WHERE COALESCE(ssd.is_recurring, false) = false
           AND ssd.start IS NOT NULL AND ssd."end" IS NOT NULL AND ssd."end" > ssd.start
           AND ssd.start::date <= $2::date AND ssd."end"::date >= $1::date
       ),
       recurring AS (
         SELECT COALESCE(SUM(occ.mins), 0) AS mins
         FROM (
           SELECT EXTRACT(EPOCH FROM (ssd."end" - ssd.start)) / 60.0 AS mins,
                  generate_series(
                    ssd.start::date,
                    $2::date,
                    CASE
                      WHEN ssd.rc_data ILIKE '%week%'  THEN '1 week'::interval
                      WHEN ssd.rc_data ILIKE '%month%' THEN '1 month'::interval
                      ELSE '1 day'::interval
                    END
                  ) AS occ_date
           FROM shift_schedule_data ssd
           JOIN shift_schedules ss ON ss.id = ssd.schedule_id AND ss.deleted_at IS NULL
           WHERE COALESCE(ssd.is_recurring, false) = true
             AND ssd.start IS NOT NULL AND ssd."end" IS NOT NULL AND ssd."end" > ssd.start
             AND ssd.start::date <= $2::date
         ) occ
         WHERE occ.occ_date::date BETWEEN $1::date AND $2::date
       )
       SELECT (SELECT mins FROM non_recurring) + (SELECT mins FROM recurring) AS planned_minutes`,
      start, end
    );

    // 2) Downtime minutes from stop_data, excluding stop types flagged exclude_type.
    const downtimeRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(SUM(sd.sum_of_time) / 60.0, 0) AS downtime_minutes
       FROM stop_data sd
       LEFT JOIN types t ON t.id = sd.stop_type_id
       WHERE sd.date BETWEEN $1::date AND $2::date
         AND sd.deleted_at IS NULL
         AND COALESCE(t.exclude_type, false) = false`,
      start, end
    );

    // 3) Production quantities.
    const prodRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(SUM(pd.part_qty), 0) AS actual_qty,
              COALESCE(SUM(pd.planned_qty), 0) AS planned_qty
       FROM production_data pd
       WHERE pd.date BETWEEN $1::date AND $2::date AND pd.deleted_at IS NULL`,
      start, end
    );

    // 4) Scrap quantity.
    const scrapRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(SUM(sc.quantity), 0) AS scrap_qty
       FROM scrap_data sc
       WHERE sc.date BETWEEN $1::date AND $2::date AND sc.deleted_at IS NULL`,
      start, end
    );

    // 5) Ideal cycle time (seconds/part). Prefer the typed
    //    `cycle_time_seconds` column (Sprint 3 / Task 6); fall back to parsing
    //    the legacy free-text `cycle_time` VARCHAR for rows not yet backfilled.
    //    If the typed column is missing (migration 20260603000003 not applied)
    //    the query throws → fall back to the legacy parse-only query.
    let cycleRows;
    try {
      cycleRows = await tx.$queryRawUnsafe(
        `SELECT AVG(
                  COALESCE(
                    ep.cycle_time_seconds,
                    NULLIF(regexp_replace(ep.cycle_time, '[^0-9.]', '', 'g'), '')::double precision
                  )
                ) AS avg_cycle_seconds
         FROM equipment_properties ep
         WHERE ep.cycle_time_seconds IS NOT NULL
            OR ep.cycle_time ~ '^[0-9]+(\\.[0-9]+)?$'`
      );
    } catch (err) {
      cycleRows = await tx.$queryRawUnsafe(
        `SELECT AVG(NULLIF(ep.cycle_time, '')::numeric) AS avg_cycle_seconds
         FROM equipment_properties ep
         WHERE ep.cycle_time ~ '^[0-9]+(\\.[0-9]+)?$'`
      );
    }

    const plannedMinutes = Number(plannedRows[0]?.planned_minutes ?? 0);
    const downtimeMinutes = Number(downtimeRows[0]?.downtime_minutes ?? 0);
    const actualQty = Number(prodRows[0]?.actual_qty ?? 0);
    const scrapQty = Number(scrapRows[0]?.scrap_qty ?? 0);
    const avgCycleSeconds = Number(cycleRows[0]?.avg_cycle_seconds ?? 0);
    const idealCycleMinutes = avgCycleSeconds / 60.0;

    const runTimeMinutes = Math.max(0, plannedMinutes - downtimeMinutes);

    const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

    const availability = plannedMinutes > 0 ? clamp01(runTimeMinutes / plannedMinutes) : 0;
    const performance = runTimeMinutes > 0 && idealCycleMinutes > 0
      ? clamp01((actualQty * idealCycleMinutes) / runTimeMinutes)
      : 0;
    const quality = actualQty > 0 ? clamp01((actualQty - scrapQty) / actualQty) : 0;
    const oee = availability * performance * quality;

    const pct = (n) => Math.round(n * 1000) / 10; // one decimal place, 0–100

    return {
      oee: pct(oee),
      availability: pct(availability),
      performance: pct(performance),
      quality: pct(quality),
      // Transparency for the UI / debugging — raw inputs behind the numbers.
      inputs: {
        plannedMinutes: Math.round(plannedMinutes),
        downtimeMinutes: Math.round(downtimeMinutes),
        runTimeMinutes: Math.round(runTimeMinutes),
        actualQty,
        scrapQty,
        idealCycleSeconds: Math.round(avgCycleSeconds * 100) / 100,
      },
      // Flags which factors had the data needed to be meaningful.
      computable: {
        availability: plannedMinutes > 0,
        performance: runTimeMinutes > 0 && idealCycleMinutes > 0,
        quality: actualQty > 0,
      },
      range: { from: start, to: end },
    };
  });
}

/**
 * getDashboardChart — daily Production / Scrap / Stop series for the dashboard
 * line chart (Sprint 2 / Task 4).
 *
 * A continuous date axis is built with generate_series so days with no data
 * still appear (as 0) and the three series stay aligned. `flowId` is optional
 * — when falsy, all flows in the tenant are aggregated.
 *
 * Returns: { dates: string[], production: number[], scrap: number[], stops: number[] }
 *   • production — SUM(production_data.part_qty) per day
 *   • scrap      — SUM(scrap_data.quantity) per day
 *   • stops      — COUNT(stop_data rows) per day
 */
async function getDashboardChart(tenant, from, to, flowId) {
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);
  const fid = Number(flowId) || 0;
  const flowFilter = fid > 0 ? 'AND flow_id = $3' : '';
  const params = fid > 0 ? [start, end, fid] : [start, end];

  return withTenant(tenant, async (tx) => {
    const rows = await tx.$queryRawUnsafe(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
              COALESCE(p.qty, 0)  AS production,
              COALESCE(s.qty, 0)  AS scrap,
              COALESCE(st.cnt, 0) AS stops
       FROM generate_series($1::date, $2::date, '1 day') d
       LEFT JOIN (
         SELECT date, SUM(part_qty) AS qty FROM production_data
         WHERE date BETWEEN $1::date AND $2::date AND deleted_at IS NULL ${flowFilter}
         GROUP BY date
       ) p ON p.date = d::date
       LEFT JOIN (
         SELECT date, SUM(quantity) AS qty FROM scrap_data
         WHERE date BETWEEN $1::date AND $2::date AND deleted_at IS NULL ${flowFilter}
         GROUP BY date
       ) s ON s.date = d::date
       LEFT JOIN (
         SELECT date, COUNT(*) AS cnt FROM stop_data
         WHERE date BETWEEN $1::date AND $2::date AND deleted_at IS NULL ${flowFilter}
         GROUP BY date
       ) st ON st.date = d::date
       ORDER BY d`, ...params
    );

    return {
      dates: rows.map((r) => r.date),
      production: rows.map((r) => Number(r.production)),
      scrap: rows.map((r) => Number(r.scrap)),
      stops: rows.map((r) => Number(r.stops)),
      range: { from: start, to: end, flowId: fid },
    };
  });
}

/**
 * getLossModel — OEE waterfall metrics + a loss breakdown for the Loss Model
 * page (Sprint 3 / Task 4). Optional `machineId` (equipment id) scopes every
 * figure to one machine; omit for the whole tenant.
 *
 * The three OEE buckets are expressed in minutes so the table and waterfall
 * agree with the headline %:
 *   • Availability losses — stop_data downtime grouped by stop type (types not
 *     flagged exclude_type). Excluded types are listed separately for context.
 *   • Performance loss — the speed/minor-stop gap = runTime × (1 − performance).
 *   • Quality losses — scrap grouped by reason, converted to minutes via the
 *     ideal cycle time (scrapQty × idealCycleMinutes).
 */
async function getLossModel(tenant, from, to, machineId) {
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);
  const mid = Number(machineId) || 0;
  const p = mid > 0 ? [start, end, mid] : [start, end];
  const machineJoin = mid > 0
    ? 'JOIN equipment_shift_schedule ess ON ess.schedule_id = ssd.schedule_id AND ess.equipment_id = $3'
    : '';
  const stopFilter = mid > 0 ? 'AND sd.flow_object_key = $3' : '';
  const scrapFilter = mid > 0 ? 'AND sc.flow_object_key = $3' : '';
  const prodFilter = mid > 0 ? 'AND pd.flow_object_key = $3' : '';

  return withTenant(tenant, async (tx) => {
    const plannedRows = await tx.$queryRawUnsafe(
      `WITH non_recurring AS (
         SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ssd."end" - ssd.start)) / 60.0), 0) AS mins
         FROM shift_schedule_data ssd
         JOIN shift_schedules ss ON ss.id = ssd.schedule_id AND ss.deleted_at IS NULL
         ${machineJoin}
         WHERE COALESCE(ssd.is_recurring, false) = false
           AND ssd.start IS NOT NULL AND ssd."end" IS NOT NULL AND ssd."end" > ssd.start
           AND ssd.start::date <= $2::date AND ssd."end"::date >= $1::date
       ),
       recurring AS (
         SELECT COALESCE(SUM(occ.mins), 0) AS mins FROM (
           SELECT EXTRACT(EPOCH FROM (ssd."end" - ssd.start)) / 60.0 AS mins,
                  generate_series(ssd.start::date, $2::date,
                    CASE WHEN ssd.rc_data ILIKE '%week%'  THEN '1 week'::interval
                         WHEN ssd.rc_data ILIKE '%month%' THEN '1 month'::interval
                         ELSE '1 day'::interval END) AS occ_date
           FROM shift_schedule_data ssd
           JOIN shift_schedules ss ON ss.id = ssd.schedule_id AND ss.deleted_at IS NULL
           ${machineJoin}
           WHERE COALESCE(ssd.is_recurring, false) = true
             AND ssd.start IS NOT NULL AND ssd."end" IS NOT NULL AND ssd."end" > ssd.start
             AND ssd.start::date <= $2::date
         ) occ WHERE occ.occ_date::date BETWEEN $1::date AND $2::date
       )
       SELECT (SELECT mins FROM non_recurring) + (SELECT mins FROM recurring) AS planned_minutes`,
      ...p
    );

    const stopRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(t.name, 'Unclassified') AS type_name,
              COALESCE(t.exclude_type, false)  AS excluded,
              COALESCE(SUM(sd.sum_of_time) / 60.0, 0) AS minutes,
              COUNT(*) AS occurrences
       FROM stop_data sd
       LEFT JOIN types t ON t.id = sd.stop_type_id
       WHERE sd.date BETWEEN $1::date AND $2::date AND sd.deleted_at IS NULL ${stopFilter}
       GROUP BY t.name, t.exclude_type
       ORDER BY minutes DESC`,
      ...p
    );

    const scrapRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(sr.name, 'Unclassified') AS reason_name,
              COALESCE(SUM(sc.quantity), 0) AS qty,
              COUNT(*) AS occurrences
       FROM scrap_data sc
       LEFT JOIN scrap_reasons sr ON sr.id = sc.reason
       WHERE sc.date BETWEEN $1::date AND $2::date AND sc.deleted_at IS NULL ${scrapFilter}
       GROUP BY sr.name
       ORDER BY qty DESC`,
      ...p
    );

    const prodRows = await tx.$queryRawUnsafe(
      `SELECT COALESCE(SUM(pd.part_qty), 0) AS actual_qty
       FROM production_data pd
       WHERE pd.date BETWEEN $1::date AND $2::date AND pd.deleted_at IS NULL ${prodFilter}`,
      ...p
    );

    // Ideal cycle time (seconds/part) — typed column preferred, machine-scoped.
    const cycleWhere = mid > 0 ? 'ep.equip_id = $1 AND (' : '(';
    const cycleParams = mid > 0 ? [mid] : [];
    let cycleRows;
    try {
      cycleRows = await tx.$queryRawUnsafe(
        `SELECT AVG(COALESCE(ep.cycle_time_seconds,
                    NULLIF(regexp_replace(ep.cycle_time, '[^0-9.]', '', 'g'), '')::double precision)) AS avg_cycle_seconds
         FROM equipment_properties ep
         WHERE ${cycleWhere} ep.cycle_time_seconds IS NOT NULL OR ep.cycle_time ~ '^[0-9]+(\\.[0-9]+)?$')`,
        ...cycleParams
      );
    } catch (err) {
      cycleRows = await tx.$queryRawUnsafe(
        `SELECT AVG(NULLIF(ep.cycle_time, '')::numeric) AS avg_cycle_seconds
         FROM equipment_properties ep
         WHERE ${mid > 0 ? 'ep.equip_id = $1 AND ' : ''}ep.cycle_time ~ '^[0-9]+(\\.[0-9]+)?$'`,
        ...cycleParams
      );
    }

    const plannedMinutes = Number(plannedRows[0]?.planned_minutes ?? 0);
    const downtimeMinutes = stopRows
      .filter((r) => !r.excluded)
      .reduce((s, r) => s + Number(r.minutes || 0), 0);
    const actualQty = Number(prodRows[0]?.actual_qty ?? 0);
    const scrapQty = scrapRows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const idealCycleMinutes = Number(cycleRows[0]?.avg_cycle_seconds ?? 0) / 60.0;
    const runTimeMinutes = Math.max(0, plannedMinutes - downtimeMinutes);

    const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
    const availability = plannedMinutes > 0 ? clamp01(runTimeMinutes / plannedMinutes) : 0;
    const performance = runTimeMinutes > 0 && idealCycleMinutes > 0
      ? clamp01((actualQty * idealCycleMinutes) / runTimeMinutes) : 0;
    const quality = actualQty > 0 ? clamp01((actualQty - scrapQty) / actualQty) : 0;
    const oee = availability * performance * quality;
    const pct = (n) => Math.round(n * 1000) / 10;
    const pctOfPlanned = (mins) => (plannedMinutes > 0 ? Math.round((mins / plannedMinutes) * 1000) / 10 : 0);

    // Build the loss table.
    const losses = [];
    for (const r of stopRows) {
      const minutes = Math.round(Number(r.minutes || 0));
      losses.push({
        lossType: r.excluded ? 'Excluded' : 'Availability',
        category: r.type_name,
        minutesLost: minutes,
        pctOfPlanned: pctOfPlanned(minutes),
        occurrences: Number(r.occurrences || 0),
      });
    }
    const perfLossMinutes = Math.round(runTimeMinutes * (1 - performance));
    if (perfLossMinutes > 0) {
      losses.push({
        lossType: 'Performance',
        category: 'Speed loss / minor stops',
        minutesLost: perfLossMinutes,
        pctOfPlanned: pctOfPlanned(perfLossMinutes),
        occurrences: null,
      });
    }
    for (const r of scrapRows) {
      const qty = Number(r.qty || 0);
      const minutes = Math.round(qty * idealCycleMinutes);
      losses.push({
        lossType: 'Quality',
        category: r.reason_name,
        minutesLost: minutes,
        pctOfPlanned: pctOfPlanned(minutes),
        occurrences: Number(r.occurrences || 0),
      });
    }

    return {
      metrics: {
        oee: pct(oee),
        availability: pct(availability),
        performance: pct(performance),
        quality: pct(quality),
      },
      losses,
      inputs: {
        plannedMinutes: Math.round(plannedMinutes),
        downtimeMinutes: Math.round(downtimeMinutes),
        runTimeMinutes: Math.round(runTimeMinutes),
        actualQty,
        scrapQty,
        idealCycleSeconds: Math.round(Number(cycleRows[0]?.avg_cycle_seconds ?? 0) * 100) / 100,
      },
      range: { from: start, to: end, machineId: mid },
    };
  });
}

module.exports = { getChartData, getOeeMetrics, getDashboardChart, getLossModel };

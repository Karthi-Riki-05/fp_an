'use strict';
/* eslint-disable no-console */

/**
 * Sample data for the Flow Monitor equipment-click registration modal.
 *
 * Seeds, idempotently, into the tenant schema:
 *   - 3 parts (`parts`) + Part-entity rows in `types`
 *   - 3 work shifts (`work_shifts`)
 *   - 3 shift schedules (`shift_schedules`)
 *   - 3 stop categories (`stop_category`) + 3 stop reasons (`stop_reasons`)
 *   - 3 scrap categories (`types`, entity='ScrapReason') + 3 scrap reasons
 *   - equipment_parts / equipment_stop_reasons / equipment_scrap_reasons
 *     junction rows linking every active equipment to every seeded type
 *   - 3 production_data sample rows (one per work-shift × part rotation)
 *   - 3 scrap_data sample rows
 *
 * Notes on the table shapes the brief got slightly wrong:
 *   - `equipment_parts` is a junction by **part type**, not part id —
 *     it carries `(equipment_id, part_type_id)`. So we link to the
 *     parts' `type_id`s, not the parts directly.
 *   - `equipment_stop_reasons.reason_type_id` → `stop_category.id`
 *     (NOT `stop_reasons.id` — that's the category, not the reason).
 *   - `equipment_scrap_reasons.reason_type_id` →
 *     `types.id where entity='ScrapReason'`.
 *   - `parts` / `stop_reasons` / `scrap_reasons` all use `status smallint`
 *     (1 = active), not `is_active`.
 *   - `shift_schedules` uses `title`, not `name`.
 *
 * Targets the schema for the SEED_COMPANY_EMAIL user. Defaults to
 * `tenant_2` (matches the dev seed); override via TENANT_SCHEMA=tenant_N.
 * For Volvo: TENANT_SCHEMA=tenant_66.
 *
 * Run: node backend/prisma/seeds/monitor-sample-data.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const SCHEMA = process.env.TENANT_SCHEMA || 'tenant_2';

if (!/^[a-z][a-z0-9_]{0,62}$/.test(SCHEMA)) {
  throw new Error(`Refusing unsafe schema name: ${SCHEMA}`);
}

const PARTS = [
  { partNo: '123', name: 'Kontorsstol röd', description: 'Standard office chair red',  typeName: 'Bracket' },
  { partNo: '124', name: 'Kontorsstol blå', description: 'Standard office chair blue', typeName: 'Shaft' },
  { partNo: '125', name: 'Kontorsstol grön', description: 'Standard office chair green', typeName: 'Frame' },
];

const WORK_SHIFTS = [
  { name: 'FM', startTime: '06:00', endTime: '14:00', workingDays: '1,2,3,4,5' },
  { name: 'EM', startTime: '14:00', endTime: '22:00', workingDays: '1,2,3,4,5' },
  { name: 'NM', startTime: '22:00', endTime: '06:00', workingDays: '1,2,3,4,5' },
];

const SHIFT_SCHEDULES = [
  { title: 'Standard Week',   description: 'Mon-Fri FM+EM shifts' },
  { title: 'Extended Week',   description: 'Mon-Sat all shifts'   },
  { title: 'Continuous 24/7', description: 'Mon-Sun three-shift rotation' },
];

const STOP_CATEGORIES = [
  { name: 'Teknisk störning', kind: 'Availability', reasons: ['Haveri', 'El-fel', 'Sensorfel'] },
  { name: 'Underhåll',        kind: 'Availability', reasons: ['Förebyggande underhåll'] },
  { name: 'Operatör',         kind: 'Performance',  reasons: ['Operatörspaus'] },
];
// Flatten: we still want >=3 stop_reasons rows even if categories vary.

const SCRAP_CATEGORIES = [
  { name: 'Materialfel',       reasons: ['Materialfel', 'Kassation'] },
  { name: 'Hanteringsskador',  reasons: ['Slagmärke'] },
  { name: 'Kvalitetsavvikelse', reasons: ['Måttavvikelse'] },
];

// Production + scrap data rotation. Each row uses the i-th work shift +
// i-th part (mod n). flow_id and equipment_id are resolved at runtime.
const PRODUCTION_SAMPLES = [
  { workHours: '07:55', partQty: 120, plannedQty: 130, orderNo: 'M1234',  comment: 'Smooth shift' },
  { workHours: '07:30', partQty: 105, plannedQty: 130, orderNo: 'M1235',  comment: 'Late start' },
  { workHours: '08:00', partQty: 135, plannedQty: 130, orderNo: 'M1236',  comment: 'Over plan' },
];

const SCRAP_SAMPLES = [
  { quantity: 3, orderNo: 'M1234', comment: 'Materialfel batch A' },
  { quantity: 1, orderNo: 'M1235', comment: 'Edge dent' },
  { quantity: 2, orderNo: 'M1236', comment: 'Out-of-spec dimension' },
];

// ── Type helpers ────────────────────────────────────────────────────────────

async function ensurePartType(prisma, name) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".types
     WHERE name = $1 AND entity = 'Part' AND deleted_at IS NULL LIMIT 1`,
    name,
  );
  if (existing[0]) return existing[0].id;
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".types (name, type, entity, is_active, sort_order)
     VALUES ($1, 'NotApplicable', 'Part', true, 0)
     RETURNING id::int AS id`,
    name,
  );
  return inserted[0].id;
}

async function ensureScrapReasonType(prisma, name) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".types
     WHERE name = $1 AND entity = 'ScrapReason' AND deleted_at IS NULL LIMIT 1`,
    name,
  );
  if (existing[0]) return existing[0].id;
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".types (name, type, entity, is_active, sort_order)
     VALUES ($1, 'NotApplicable', 'ScrapReason', true, 0)
     RETURNING id::int AS id`,
    name,
  );
  return inserted[0].id;
}

// ── Core entity helpers ────────────────────────────────────────────────────

async function ensurePart(prisma, typeId, def) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".parts
     WHERE part_no = $1 AND deleted_at IS NULL LIMIT 1`,
    def.partNo,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".parts
       (name, part_no, description, status, type_id, sort_order)
     VALUES ($1, $2, $3, 1, $4, 0)
     RETURNING id::int AS id`,
    def.name, def.partNo, def.description, typeId,
  );
  return { id: inserted[0].id, created: true };
}

async function ensureWorkShift(prisma, def) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".work_shifts
     WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
    def.name,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".work_shifts
       (name, start_time, end_time, working_days, status)
     VALUES ($1, $2::time, $3::time, $4, 1)
     RETURNING id::int AS id`,
    def.name, def.startTime, def.endTime, def.workingDays,
  );
  return { id: inserted[0].id, created: true };
}

async function ensureShiftSchedule(prisma, def) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".shift_schedules
     WHERE title = $1 AND deleted_at IS NULL LIMIT 1`,
    def.title,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".shift_schedules (title, description, status)
     VALUES ($1, $2, true)
     RETURNING id::int AS id`,
    def.title, def.description,
  );
  return { id: inserted[0].id, created: true };
}

async function ensureStopCategory(prisma, def) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".stop_category
     WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
    def.name,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  // Enum type lives in `tenant_template` (per-tenant tables reference the
  // template enum; only table rows live in the per-tenant schema).
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".stop_category (name, type, is_active)
     VALUES ($1, $2::tenant_template."StopCategoryKind", true)
     RETURNING id::int AS id`,
    def.name, def.kind,
  );
  return { id: inserted[0].id, created: true };
}

async function ensureStopReason(prisma, typeId, name) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".stop_reasons
     WHERE name = $1 AND type_id = $2 AND deleted_at IS NULL LIMIT 1`,
    name, typeId,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".stop_reasons (name, type_id, status, sort_order)
     VALUES ($1, $2, 1, 0)
     RETURNING id::int AS id`,
    name, typeId,
  );
  return { id: inserted[0].id, created: true };
}

async function ensureScrapReason(prisma, typeId, name) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".scrap_reasons
     WHERE name = $1 AND type_id = $2 AND deleted_at IS NULL LIMIT 1`,
    name, typeId,
  );
  if (existing[0]) return { id: existing[0].id, created: false };
  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "${SCHEMA}".scrap_reasons (name, type_id, status, sort_order)
     VALUES ($1, $2, 1, 0)
     RETURNING id::int AS id`,
    name, typeId,
  );
  return { id: inserted[0].id, created: true };
}

// ── Junction helpers ────────────────────────────────────────────────────────

async function ensureEquipmentLink(prisma, table, equipmentId, typeId) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}"."${table}"
     WHERE equipment_id = $1 AND ${table === 'equipment_parts' ? 'part_type_id' : 'reason_type_id'} = $2
       AND deleted_at IS NULL LIMIT 1`,
    equipmentId, typeId,
  );
  if (existing[0]) return false;
  const col = table === 'equipment_parts' ? 'part_type_id' : 'reason_type_id';
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${SCHEMA}"."${table}" (equipment_id, ${col}, status)
     VALUES ($1, $2, 1)`,
    equipmentId, typeId,
  );
  return true;
}

// ── Sample data helpers (production_data / scrap_data) ─────────────────────

async function ensureProductionSample(prisma, ctx, sample, idx) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".production_data
     WHERE order_no = $1 AND flow_id = $2 AND flow_object_key = $3 AND deleted_at IS NULL LIMIT 1`,
    sample.orderNo, ctx.flowId, ctx.equipmentId,
  );
  if (existing[0]) return false;
  const partId = ctx.partIds[idx % ctx.partIds.length];
  const shift = ctx.shifts[idx % ctx.shifts.length];
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${SCHEMA}".production_data
       (flow_id, flow_object_key, part_id, work_shift_id, work_shift_name,
        work_hours, part_qty, planned_qty, order_no, date, comment,
        created_by, created_by_email, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE - ($10 || ' days')::interval, $11, 0, '', 'monitor-sample-seed')`,
    ctx.flowId, ctx.equipmentId, partId, shift.id, shift.name,
    sample.workHours, sample.partQty, sample.plannedQty, sample.orderNo,
    String(idx), sample.comment,
  );
  return true;
}

async function ensureScrapSample(prisma, ctx, sample, idx) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id::int AS id FROM "${SCHEMA}".scrap_data
     WHERE order_no = $1 AND flow_id = $2 AND flow_object_key = $3 AND deleted_at IS NULL LIMIT 1`,
    sample.orderNo, ctx.flowId, ctx.equipmentId,
  );
  if (existing[0]) return false;
  const partId = ctx.partIds[idx % ctx.partIds.length];
  const shift = ctx.shifts[idx % ctx.shifts.length];
  const scrapTypeId = ctx.scrapCategoryIds[idx % ctx.scrapCategoryIds.length];
  const scrapReasonId = ctx.scrapReasonIds[idx % ctx.scrapReasonIds.length];
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${SCHEMA}".scrap_data
       (flow_id, flow_object_key, part_id, work_shift_id, work_shift_name,
        order_no, quantity, reason, scrap_type_id, date, comment,
        created_by, created_by_email, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE - ($10 || ' days')::interval, $11, 0, '', 'monitor-sample-seed')`,
    ctx.flowId, ctx.equipmentId, partId, shift.id, shift.name,
    sample.orderNo, sample.quantity, scrapReasonId, scrapTypeId,
    String(idx), sample.comment,
  );
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`[monitor-seed] target schema: ${SCHEMA}`);

    // 1. Part TYPE rows (one per seeded part) ──────────────────────────────
    const partTypeIds = [];
    for (const p of PARTS) partTypeIds.push(await ensurePartType(prisma, p.typeName));
    console.log(`[monitor-seed] part types: ${partTypeIds.join(', ')}`);

    // 2. Parts ─────────────────────────────────────────────────────────────
    const partIds = [];
    let newParts = 0;
    for (let i = 0; i < PARTS.length; i++) {
      const r = await ensurePart(prisma, partTypeIds[i], PARTS[i]);
      partIds.push(r.id);
      if (r.created) newParts++;
    }
    console.log(`[monitor-seed] parts: ${partIds.join(', ')} (${newParts} new)`);

    // 3. Work shifts ───────────────────────────────────────────────────────
    const shifts = [];
    let newShifts = 0;
    for (const ws of WORK_SHIFTS) {
      const r = await ensureWorkShift(prisma, ws);
      shifts.push({ id: r.id, name: ws.name });
      if (r.created) newShifts++;
    }
    console.log(`[monitor-seed] work shifts: ${shifts.map((s) => `${s.name}(${s.id})`).join(', ')} (${newShifts} new)`);

    // 4. Shift schedules ───────────────────────────────────────────────────
    let newScheds = 0;
    for (const ss of SHIFT_SCHEDULES) {
      const r = await ensureShiftSchedule(prisma, ss);
      if (r.created) newScheds++;
    }
    console.log(`[monitor-seed] shift schedules: ${newScheds} new`);

    // 5. Stop categories + reasons ─────────────────────────────────────────
    const stopCategoryIds = [];
    let newCats = 0, newStopReasons = 0;
    for (const cat of STOP_CATEGORIES) {
      const c = await ensureStopCategory(prisma, cat);
      stopCategoryIds.push(c.id);
      if (c.created) newCats++;
      for (const reasonName of cat.reasons) {
        const r = await ensureStopReason(prisma, c.id, reasonName);
        if (r.created) newStopReasons++;
      }
    }
    console.log(`[monitor-seed] stop categories: ${stopCategoryIds.join(', ')} (${newCats} new); ${newStopReasons} new reasons`);

    // 6. Scrap categories (in `types`) + reasons ───────────────────────────
    const scrapCategoryIds = [];
    const scrapReasonIds = [];
    let newScrapCats = 0, newScrapReasons = 0;
    for (const cat of SCRAP_CATEGORIES) {
      const tId = await ensureScrapReasonType(prisma, cat.name);
      scrapCategoryIds.push(tId);
      // ensureScrapReasonType returns the id; we can't easily detect "new",
      // so just count rows we add below.
      for (const reasonName of cat.reasons) {
        const r = await ensureScrapReason(prisma, tId, reasonName);
        scrapReasonIds.push(r.id);
        if (r.created) newScrapReasons++;
      }
      newScrapCats++;
    }
    console.log(`[monitor-seed] scrap categories: ${scrapCategoryIds.join(', ')}; ${newScrapReasons} new reasons`);

    // 7. Equipment junction links ──────────────────────────────────────────
    const equipment = await prisma.$queryRawUnsafe(
      `SELECT id::int AS id, name FROM "${SCHEMA}".equipment
       WHERE deleted_at IS NULL ORDER BY id`,
    );
    if (equipment.length === 0) {
      console.warn(`[monitor-seed] no equipment in ${SCHEMA} — skipping junction links + samples`);
    } else {
      let partLinks = 0, stopLinks = 0, scrapLinks = 0;
      for (const eq of equipment) {
        for (const ptId of partTypeIds)     if (await ensureEquipmentLink(prisma, 'equipment_parts',         eq.id, ptId)) partLinks++;
        for (const scId of stopCategoryIds) if (await ensureEquipmentLink(prisma, 'equipment_stop_reasons',  eq.id, scId)) stopLinks++;
        for (const sxId of scrapCategoryIds) if (await ensureEquipmentLink(prisma, 'equipment_scrap_reasons', eq.id, sxId)) scrapLinks++;
      }
      console.log(`[monitor-seed] junction links (new): parts=${partLinks}, stop=${stopLinks}, scrap=${scrapLinks}`);

      // 8. Production + scrap samples — pick the first flow_id and the
      // first equipment for the sample rows. The Monitor's lists query
      // surfaces ALL rows in the tenant; this is a smoke-data seed, not
      // a per-equipment fixture.
      const flowRow = await prisma.$queryRawUnsafe(
        `SELECT id::int AS id FROM "${SCHEMA}".flow_designs
         WHERE deleted_at IS NULL ORDER BY id LIMIT 1`,
      );
      if (!flowRow[0]) {
        console.warn(`[monitor-seed] no flow_designs in ${SCHEMA} — skipping production_data + scrap_data samples`);
      } else {
        const ctx = {
          flowId: flowRow[0].id,
          equipmentId: equipment[0].id,
          partIds,
          shifts,
          scrapCategoryIds,
          scrapReasonIds,
        };
        let newProd = 0, newScrap = 0;
        for (let i = 0; i < PRODUCTION_SAMPLES.length; i++) {
          if (await ensureProductionSample(prisma, ctx, PRODUCTION_SAMPLES[i], i)) newProd++;
        }
        for (let i = 0; i < SCRAP_SAMPLES.length; i++) {
          if (await ensureScrapSample(prisma, ctx, SCRAP_SAMPLES[i], i)) newScrap++;
        }
        console.log(`[monitor-seed] samples (new): production_data=${newProd}, scrap_data=${newScrap}`);
      }
    }

    console.log('[monitor-seed] done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[monitor-seed] FAILED', err);
  process.exit(1);
});

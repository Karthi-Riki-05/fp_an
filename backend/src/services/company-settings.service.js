'use strict';
const { prisma } = require('../prisma/client');

/**
 * Company settings (Sprint 4 / Task 2). Stored as a JSONB blob in
 * public.company_settings keyed by companyId (the tenant id). Raw SQL on the
 * global client so it works without a Prisma client regen.
 */

// Sensible defaults so the form is fully populated on first load.
const DEFAULTS = {
  company: { name: '', industry: '', country: 'SE', timezone: 'Europe/Stockholm', logoUrl: '' },
  oee: { targetOee: 85, plannedTimeMethod: 'shift_schedule', workingDays: [1, 2, 3, 4, 5] },
  notifications: { stopAlertThresholdMin: 5, emailAlerts: false, alertEmail: '' },
};

async function getSettings(companyId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT data FROM public.company_settings WHERE company_id = $1`,
    Number(companyId),
  );
  const stored = rows[0]?.data ?? {};
  // Deep-merge stored over defaults so new keys always have a value.
  return {
    company: { ...DEFAULTS.company, ...(stored.company ?? {}) },
    oee: { ...DEFAULTS.oee, ...(stored.oee ?? {}) },
    notifications: { ...DEFAULTS.notifications, ...(stored.notifications ?? {}) },
  };
}

async function updateSettings(companyId, patch) {
  const current = await getSettings(companyId);
  // Shallow-merge each section so a partial PATCH only touches sent fields.
  const next = {
    company: { ...current.company, ...(patch.company ?? {}) },
    oee: { ...current.oee, ...(patch.oee ?? {}) },
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
  };
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.company_settings (company_id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (company_id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    Number(companyId), JSON.stringify(next),
  );
  return next;
}

module.exports = { getSettings, updateSettings, DEFAULTS };

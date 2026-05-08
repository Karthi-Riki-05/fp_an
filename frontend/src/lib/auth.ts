import type { MeResponse } from './api/types';

/**
 * Backend access — mirrors the legacy @permission('view-backend') gate.
 *
 * Both Administrator (all=true) and Company (tenant admin) roles have the
 * `view-backend` permission per the seed (see backend/prisma/seed.ts
 * COMPANY_PERMISSIONS). Until /me returns the full permission list, we
 * approximate by checking role names — keeps the frontend in sync with
 * the backend without an extra API round-trip.
 */
export function canAccessBackend(me: MeResponse | undefined | null): boolean {
  if (!me) return false;
  if (me.isAdmin) return true;
  return me.roles.includes('Company');
}

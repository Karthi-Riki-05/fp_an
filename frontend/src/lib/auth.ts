import type { MeResponse } from './api/types';

type Me = MeResponse | undefined | null;

/** Generic permission check — true if me holds any of the listed permissions. */
export function hasPermission(me: Me, ...permissions: string[]): boolean {
  if (!me) return false;
  if (me.isAdmin) return true;                  // all=true Administrator shortcut
  return permissions.some((p) => me.permissions?.includes(p));
}

/** Mirrors the legacy @permission('view-backend') gate. */
export function canAccessBackend(me: Me): boolean {
  return hasPermission(me, 'view-backend');
}

/** Convenience for role-based UI affordances. */
export function hasRole(me: Me, ...roles: string[]): boolean {
  if (!me) return false;
  return roles.some((r) => me.roles?.includes(r));
}

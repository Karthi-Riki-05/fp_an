/** Shared response shapes between frontend and backend. */

export interface MeResponse {
  id: number;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  image: string;
  confirmed: boolean;
  // activeTenantId: for Company users = their own user.id;
  //                 for sub-Users = their companyId (the Company user's id);
  //                 for Administrators = the X-Tenant-Id header value (Company user id),
  //                                       or null when no context is selected.
  // Field name kept from the pre-removal Tenant model era — see MIGRATION_NOTES §13.
  activeTenantId: number | null;
  isAdmin: boolean;
  roles: string[];
  /** Effective permission names. Admins (Administrator role with all=true) get every permission. */
  permissions: string[];
  // `tenants[]` is now a single-row array synthesized from the Company user's
  // own row (or empty for Administrators). Frontend keeps reading it for the
  // tenant-name display in shells/dashboards. See MIGRATION_NOTES §13.
  tenants: Array<{
    id: number;
    slug: string;
    name: string;
    schemaName: string;
    timezone: string;
    status: 'active' | 'suspended' | 'archived';
  }>;
  /** Set when this session is impersonating another user. id of the original Super Admin. */
  impersonatorId: number | null;
  /** When impersonating, the original Super Admin's name + email — for the banner. */
  impersonator: { id: number; name: string; email: string } | null;
  /** Per-user UI preferences blob. Indexed by `key` (top-level) and
   *  optional `subKey`. Updated via POST /me/settings/table. Used by:
   *    - tablePreferences.unit_web_settings.units = { hidden:[], order:[] }
   *  See me.routes.js for the full list of consumers. */
  tablePreferences: Record<string, unknown>;
}

export interface LoginResponse {
  user: {
    id: number;
    email: string;
    name: string;
    tenantId: number | null;
    roles: string[];
  };
  expiresIn: number;
}

/**
 * Legacy tenant-row shape kept only to type `MeResponse.tenants[]` (synthesized
 * server-side from the Company user's row after the Tenant model removal).
 * No CRUD endpoints back this type anymore — use `useCompaniesForPicker()`
 * from `lib/api/companies.ts` for company selectors. See MIGRATION_NOTES §13.
 */
export interface TenantSummary {
  id: number;
  slug: string;
  name: string;
  schemaName: string;
  timezone: string;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
}

export interface AdminUser {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  confirmed: boolean;
  active: boolean;
  /** ISO timestamp string. */
  createdAt: string;
  roles: string[];
}

export interface GlobalAdminUser extends AdminUser {
  companyId: number;
  companyName: string;
}

export interface AdminUserListResponse {
  data: AdminUser[];
  total: number;
  page: number;
  perPage: number;
}

export interface GlobalUserListResponse {
  data: GlobalAdminUser[];
  total: number;
  page: number;
  perPage: number;
}

export interface Equipment {
  id: number;
  companyId: number;
  sortOrder: number;
  parentId: number;
  typeId: number;
  name: string | null;
  description: string | null;
  icon: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

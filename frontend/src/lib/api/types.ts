/** Shared response shapes between frontend and backend. */

export interface MeResponse {
  id: number;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  image: string;
  confirmed: boolean;
  activeTenantId: number | null;
  isAdmin: boolean;
  roles: string[];
  /** Effective permission names. Admins (Administrator role with all=true) get every permission. */
  permissions: string[];
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

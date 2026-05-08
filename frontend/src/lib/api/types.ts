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
  tenants: Array<{
    id: number;
    slug: string;
    name: string;
    schemaName: string;
    timezone: string;
    status: 'active' | 'suspended' | 'archived';
  }>;
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

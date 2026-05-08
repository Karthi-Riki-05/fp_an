import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Stub. Phase 3 pairs this with RolesGuard.
// Usage: @Roles('Administrator', 'Company')
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

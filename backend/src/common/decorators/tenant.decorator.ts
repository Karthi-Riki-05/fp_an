import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  tenantId: number;
  schemaName: string;
  timezone: string;
}

// Stub. Phase 3's TenantInterceptor populates request.tenant from the JWT;
// this decorator extracts it for handler use. See MIGRATION_NOTES.md §17.
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenant;
  },
);

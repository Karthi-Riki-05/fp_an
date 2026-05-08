import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface TenantContext {
  tenantId: number;
  schemaName: string;
  timezone: string;
}

/**
 * Extracts the tenant context attached by TenantInterceptor.
 * Throws if used on a route that doesn't pass through the interceptor.
 */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.tenant) {
      throw new Error(
        'TenantContext is missing — annotate the route/controller with TenantInterceptor.',
      );
    }
    return req.tenant;
  },
);

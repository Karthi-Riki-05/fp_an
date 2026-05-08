import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Resolves the tenant context for the current request and attaches it to
 * `request.tenant`. Source priority:
 *
 *   1. X-Tenant-Id header (only honoured for admins — non-admins are pinned
 *      to the tenant in their JWT).
 *   2. Tenant id from the JWT claim.
 *
 * Verifies the user belongs to the resolved tenant (admins bypass).
 *
 * Per MIGRATION_NOTES.md §11.2 + §13.23. Phase 3 v1: the interceptor only
 * RESOLVES the tenant; per-request search_path switching happens in the
 * service layer via `prisma.withTenant(...)`. That keeps the
 * interceptor cheap and the schema switching close to the actual SQL.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('not-authenticated');

    const headerTenant = req.headers['x-tenant-id'];
    const overrideTenantId =
      typeof headerTenant === 'string' ? Number(headerTenant) : undefined;

    let tenantId: number | null;
    if (overrideTenantId && Number.isInteger(overrideTenantId)) {
      if (!user.isAdmin) throw new ForbiddenException('x-tenant-id-admin-only');
      tenantId = overrideTenantId;
    } else {
      tenantId = user.tenantId;
    }

    if (!tenantId) {
      throw new BadRequestException(
        'no-tenant-context — pass X-Tenant-Id (admin) or login with a tenant-bound user',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, schemaName: true, timezone: true, status: true },
    });
    if (!tenant) throw new BadRequestException('tenant-not-found');
    if (tenant.status !== 'active') throw new ForbiddenException('tenant-inactive');

    if (!user.isAdmin) {
      const member = await this.prisma.tenantUser.findFirst({
        where: { userId: user.id, tenantId: tenant.id, status: true },
        select: { id: true },
      });
      if (!member) throw new ForbiddenException('not-a-member-of-tenant');
    }

    req.tenant = {
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      timezone: tenant.timezone,
    };

    return next.handle();
  }
}

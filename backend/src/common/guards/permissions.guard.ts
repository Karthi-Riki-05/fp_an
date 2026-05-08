import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('not-authenticated');
    if (user.isAdmin) return true; // Administrator (all=true) shortcut

    // Resolve the user's effective permission names from role_permissions.
    const grants = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId: user.id } } } },
      include: { permission: { select: { name: true } } },
    });
    const owned = new Set(grants.map((g) => g.permission.name));
    const ok = required.every((p) => owned.has(p));
    if (!ok) throw new ForbiddenException('permission-required');
    return true;
  }
}

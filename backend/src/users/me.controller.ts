import { Controller, Get, NotFoundException } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        userRoles: { include: { role: { select: { name: true, all: true } } } },
        tenantUsers: {
          where: { status: true },
          include: {
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                schemaName: true,
                timezone: true,
                status: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!user) throw new NotFoundException('user-not-found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      image: user.image,
      confirmed: user.confirmed,
      activeTenantId: authUser.tenantId,
      isAdmin: authUser.isAdmin,
      roles: user.userRoles.map((ur) => ur.role.name),
      tenants: user.tenantUsers.map((tu) => tu.tenant),
    };
  }
}

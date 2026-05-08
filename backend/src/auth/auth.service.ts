import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt-payload';
import { PasswordService } from './password.service';

export interface LoginResult {
  accessToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    tenantId: number | null;
    roles: string[];
  };
  /** Expiry in seconds — used to set the cookie Max-Age. */
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, plainPassword: string): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: {
        userRoles: { include: { role: true } },
        tenantUsers: { where: { status: true }, orderBy: { id: 'asc' } },
      },
    });

    if (!user || !user.password) {
      // Constant-ish — same exception text whether user exists or not.
      throw new UnauthorizedException('invalid-credentials');
    }

    const { ok, needsRehash } = await this.password.verify(plainPassword, user.password);
    if (!ok) throw new UnauthorizedException('invalid-credentials');

    if (needsRehash) {
      const fresh = await this.password.hash(plainPassword);
      await this.prisma.user.update({ where: { id: user.id }, data: { password: fresh } });
      this.logger.log(`Rehashed password for user ${user.id} (legacy → bcrypt)`);
    }

    if (user.status !== 1) throw new UnauthorizedException('user-disabled');

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const isAdmin = user.userRoles.some((ur) => ur.role.all);
    // Admins act at platform scope by default; non-admins are bound to their first tenant.
    const tenantId: number | null = isAdmin ? null : user.tenantUsers[0]?.tenantId ?? null;

    const ttl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const expiresInSec = parseTtlToSeconds(ttl);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId,
      roles: roleNames,
      kind: 'web',
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: ttl,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId,
        roles: roleNames,
      },
      expiresIn: expiresInSec,
    };
  }
}

/** Parses '15m', '1h', '7d', or seconds — matches the subset @nestjs/jwt accepts. */
function parseTtlToSeconds(ttl: string): number {
  if (/^\d+$/.test(ttl)) return Number(ttl);
  const m = ttl.match(/^(\d+)\s*([smhd])$/);
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default:  return 900;
  }
}

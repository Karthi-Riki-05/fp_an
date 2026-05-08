import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../jwt-payload';

/** Reads JWT from the Authorization: Bearer header. Mobile / IoT path. */
@Injectable()
export class JwtBearerStrategy extends PassportStrategy(Strategy, 'jwt-bearer') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.kind !== 'web') throw new UnauthorizedException('wrong-token-kind');
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      isAdmin: payload.roles.includes('Administrator'),
    };
  }
}

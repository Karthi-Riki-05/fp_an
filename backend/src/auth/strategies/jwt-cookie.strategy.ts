import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../jwt-payload';

const ACCESS_COOKIE = 'access_token';

/** Reads JWT from the access_token httpOnly cookie. Web app path. */
@Injectable()
export class JwtCookieStrategy extends PassportStrategy(Strategy, 'jwt-cookie') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[ACCESS_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.kind !== 'web') throw new UnauthorizedException('wrong-token-kind');
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.email, // populated more richly by AuthService.buildAuthUser later
      tenantId: payload.tenantId,
      roles: payload.roles,
      isAdmin: payload.roles.includes('Administrator'),
    };
  }
}

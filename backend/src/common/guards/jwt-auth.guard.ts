import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Cookie-or-bearer JWT auth. Tries the cookie strategy first, falls back to
 * the Authorization: Bearer header. Routes annotated with @Public() bypass.
 *
 * Auth strategy duality per MIGRATION_NOTES.md §5 (A4).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt-cookie', 'jwt-bearer']) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

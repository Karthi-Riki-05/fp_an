import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Stub. Phase 3 (auth module) replaces this with a Passport JWT strategy that
// accepts EITHER a cookie (web) or Authorization: Bearer header (programmatic).
// See MIGRATION_NOTES.md §5 (auth strategy duality).
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

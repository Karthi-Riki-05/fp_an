import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Stub. Phase 3 wires this to the Reflector + @Roles() decorator and
// checks against the public.user_roles join via PrismaService.
// See MIGRATION_NOTES.md §4.5 + §5.
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

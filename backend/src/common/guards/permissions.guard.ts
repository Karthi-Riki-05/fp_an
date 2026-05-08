import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Stub. Phase 3 wires this to @Permissions() decorator and the
// 26-permission inventory documented in MIGRATION_NOTES.md §4.5.
@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

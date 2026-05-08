import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Stub. Phase 3 replaces this with a Passport JwtBearerStrategy that ALSO
// validates the device_id claim against the machines table.
// See MIGRATION_NOTES.md §5.
@Injectable()
export class IotAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

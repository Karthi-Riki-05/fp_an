import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

// Stub. Phase 3's AuditService listens to NestJS event emissions
// and writes to public.history, replacing the legacy
// UserEventListener / RoleEventListener.
// See MIGRATION_NOTES.md §6.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

// Stub. Phase 2/3 reads tenant_id from the JWT, sets the Postgres
// search_path on the request-scoped PrismaService, and rejects requests
// where the user does not belong to the requested tenant.
// See MIGRATION_NOTES.md §11.2 + §11.5 + §11.6.
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }
}

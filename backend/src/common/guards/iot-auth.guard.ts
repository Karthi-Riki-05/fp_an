import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * IoT routes accept ONLY bearer-header tokens. Phase 3.x adds device_id
 * claim verification against the machines table. For Phase 3 v1 the guard
 * shares the web bearer strategy; the dedicated IoT JWT secret + device
 * binding is wired in 3.2.
 */
@Injectable()
export class IotAuthGuard extends AuthGuard('jwt-bearer') {}

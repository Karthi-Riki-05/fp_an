import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime_s: number;
  timestamp: string;
  checks: {
    db: 'ok' | 'unknown' | 'fail';
    redis: 'ok' | 'unknown' | 'fail';
  };
  version: string;
}

@Injectable()
export class HealthService {
  private readonly bootedAt = Date.now();

  check(): HealthStatus {
    return {
      status: 'ok',
      uptime_s: Math.floor((Date.now() - this.bootedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        db: 'unknown',
        redis: 'unknown',
      },
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }
}

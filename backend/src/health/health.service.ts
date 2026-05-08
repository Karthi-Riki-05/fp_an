import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface HealthCheck {
  status: 'ok' | 'fail';
  latency_ms?: number;
  error?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime_s: number;
  timestamp: string;
  checks: {
    db: HealthCheck;
    redis: HealthCheck;
  };
  version: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly bootedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const overall = db.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';

    return {
      status: overall,
      uptime_s: Math.floor((Date.now() - this.bootedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: { db, redis },
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  private async checkDb(): Promise<HealthCheck> {
    try {
      const { latency_ms } = await this.prisma.ping();
      return { status: 'ok', latency_ms };
    } catch (err) {
      this.logger.warn(`db probe failed: ${(err as Error).message}`);
      return { status: 'fail', error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    try {
      const { latency_ms } = await this.redis.ping();
      return { status: 'ok', latency_ms };
    } catch (err) {
      this.logger.warn(`redis probe failed: ${(err as Error).message}`);
      return { status: 'fail', error: (err as Error).message };
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { Redis } from 'ioredis';

/**
 * RedisService — single shared ioredis client, used for cache, BullMQ
 * (Phase 3+), and SSE pub/sub (post-v1).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL', 'redis://redis:6379');
    this.client = new IORedis(url, {
      maxRetriesPerRequest: null, // BullMQ requirement; safe for general use.
      enableReadyCheck: true,
      lazyConnect: false,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.client.on('ready', () => this.logger.log('Redis ready.'));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<{ ok: boolean; latency_ms: number }> {
    const t0 = Date.now();
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error(`Unexpected PING reply: ${reply}`);
    }
    return { ok: true, latency_ms: Date.now() - t0 };
  }
}

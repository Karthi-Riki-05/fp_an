import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — wraps PrismaClient and adds tenant search_path support.
 *
 * Usage:
 *   - default queries hit the public schema (the @@schema("public") models).
 *   - `withTenant(schemaName)` returns a callback that runs all queries
 *     inside a transaction with `SET LOCAL search_path = "<schema>", public`,
 *     so tenant-scoped models (the @@schema("tenant_template") ones) resolve
 *     to the per-tenant schema for that request.
 *
 * Phase 3 wires this into TenantInterceptor so every authenticated request
 * automatically operates inside its tenant schema. For now the service is
 * available for HealthService to probe the connection.
 *
 * See MIGRATION_NOTES.md §11.2, §11.5, §11.6.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Validate a Postgres schema name (per-tenant schema). Postgres identifiers
   * are limited to 63 chars; we additionally restrict to a safe subset to
   * prevent SQL injection in raw search_path manipulation.
   */
  private static isSafeSchemaName(schemaName: string): boolean {
    return /^[a-z][a-z0-9_]{0,62}$/.test(schemaName);
  }

  /**
   * Run a function inside a transaction with the given tenant schema first
   * on the search_path. Returns whatever the callback returns.
   *
   * Note on isolation: Prisma's $transaction uses a single Postgres session,
   * so SET LOCAL applies to every query inside `cb`. After commit/rollback
   * the search_path returns to the connection's default (public).
   */
  async withTenant<T>(
    schemaName: string,
    cb: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    if (!PrismaService.isSafeSchemaName(schemaName)) {
      throw new Error(`Refusing unsafe tenant schema name: ${schemaName}`);
    }
    return this.$transaction(async (tx) => {
      // SET LOCAL is scoped to the current transaction.
      await tx.$executeRawUnsafe(`SET LOCAL search_path = "${schemaName}", public`);
      return cb(tx);
    });
  }

  /**
   * Light DB-reachability probe used by HealthService.
   */
  async ping(): Promise<{ ok: boolean; latency_ms: number }> {
    const t0 = Date.now();
    await this.$queryRawUnsafe('SELECT 1');
    return { ok: true, latency_ms: Date.now() - t0 };
  }
}

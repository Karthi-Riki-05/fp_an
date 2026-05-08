import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

/**
 * Provisioning per MIGRATION_NOTES.md §11.2:
 *   - INSERT INTO public.tenants → returns id, schema_name.
 *   - CREATE SCHEMA "tenant_<id>".
 *   - For each table T in tenant_template, CREATE TABLE "tenant_<id>"."<T>"
 *     (LIKE "tenant_template"."<T>" INCLUDING ALL).
 *
 * NOTE on FK enforcement: PostgreSQL's `LIKE INCLUDING ALL` covers defaults,
 * indexes, generated columns, identity, comments, and CHECK constraints, but
 * NOT foreign keys. For Phase 3 v1 the per-tenant tables therefore have the
 * same column shapes/indexes as tenant_template but no intra-tenant FK
 * enforcement. Phase 6 (data migration) generates a canonical migration that
 * adds the FKs per tenant. Application-layer code still treats relations as
 * FKs (Prisma typed relations); this is purely about DB-level enforcement.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tenant.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        schemaName: true,
        timezone: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug: dto.slug }, { name: dto.name }] },
      select: { id: true },
    });
    if (existing) throw new ConflictException('tenant-slug-or-name-taken');

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          schemaName: `tenant_${dto.slug}`,
          timezone: dto.timezone ?? 'Europe/Stockholm',
        },
      });

      // Patch the schema name to include the numeric id once we have it,
      // so multiple tenants with similar slugs can't collide on schemas.
      const schemaName = `tenant_${tenant.id}`;
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { schemaName },
      });

      await this.provisionSchema(tx, schemaName);

      return {
        ...tenant,
        schemaName,
      };
    });
  }

  /**
   * Clones the tenant_template schema into the given target schema.
   * Idempotent: re-running on an existing schema is a no-op (skips tables
   * that already exist).
   */
  async provisionSchema(
    tx: { $executeRawUnsafe: PrismaService['$executeRawUnsafe']; $queryRawUnsafe: PrismaService['$queryRawUnsafe'] },
    schemaName: string,
  ): Promise<void> {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) {
      throw new Error(`unsafe schema name: ${schemaName}`);
    }

    await tx.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    const tables = await tx.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );

    for (const { table_name } of tables) {
      // Skip if the destination already has this table (idempotency).
      const exists = await tx.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) AS count FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2`,
        schemaName,
        table_name,
      );
      if (exists[0]?.count && Number(exists[0].count) > 0) continue;

      // Inline values are safe — both names came from information_schema and
      // we additionally validate schemaName above.
      await tx.$executeRawUnsafe(
        `CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`,
      );
    }

    this.logger.log(`Provisioned ${tables.length} tables in schema "${schemaName}".`);
  }

  findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  findById(id: number) {
    return this.prisma.tenant.findUnique({ where: { id } });
  }
}

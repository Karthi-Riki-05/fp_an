import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/decorators/tenant.decorator';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

/**
 * Tenant-scoped Equipment service.
 *
 * Prisma's `multiSchema` ties each model to a fixed schema at compile time,
 * so we cannot generate model methods that target the dynamic per-tenant
 * schema. Instead, every query in this service runs through
 * `prisma.withTenant(schemaName, …)`, which:
 *
 *   1. Opens a transaction.
 *   2. Issues `SET LOCAL search_path = "tenant_<id>", public`.
 *   3. Runs the callback's queries — they hit `tenant_<id>.equipment` even
 *      though the Prisma-generated SQL refers to the unqualified
 *      `"equipment"` table.
 *
 * For Phase 3 v1, methods use raw SQL because Prisma's generated client
 * always emits fully-qualified `tenant_template.equipment` table names
 * (since that's the schema attribute on the model). Raw SQL respects
 * search_path; the typed Prisma client doesn't. Phase 3.x ships a thin
 * wrapper that issues parameterised raw queries with the right shape.
 */
@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenant: TenantContext, opts: { includeDeleted?: boolean } = {}) {
    const where = opts.includeDeleted ? '' : 'WHERE deleted_at IS NULL';
    return this.prisma.withTenant(tenant.schemaName, (tx) =>
      tx.$queryRawUnsafe<EquipmentRow[]>(
        `SELECT id, company_id AS "companyId", sort_order AS "sortOrder",
                parent_id AS "parentId", type_id AS "typeId", name,
                description, icon, is_active AS "isActive",
                created_at AS "createdAt", updated_at AS "updatedAt",
                deleted_at AS "deletedAt"
         FROM equipment ${where}
         ORDER BY parent_id, sort_order, id`,
      ),
    );
  }

  async findOne(tenant: TenantContext, id: number): Promise<EquipmentRow> {
    const rows = await this.prisma.withTenant(tenant.schemaName, (tx) =>
      tx.$queryRawUnsafe<EquipmentRow[]>(
        `SELECT id, company_id AS "companyId", sort_order AS "sortOrder",
                parent_id AS "parentId", type_id AS "typeId", name,
                description, icon, is_active AS "isActive",
                created_at AS "createdAt", updated_at AS "updatedAt",
                deleted_at AS "deletedAt"
         FROM equipment
         WHERE id = $1 AND deleted_at IS NULL`,
        id,
      ),
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('equipment-not-found');
    return row;
  }

  async create(tenant: TenantContext, dto: CreateEquipmentDto): Promise<EquipmentRow> {
    const rows = await this.prisma.withTenant(tenant.schemaName, (tx) =>
      tx.$queryRawUnsafe<EquipmentRow[]>(
        `INSERT INTO equipment
           (company_id, sort_order, parent_id, type_id, name, description, icon, is_active,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         RETURNING id, company_id AS "companyId", sort_order AS "sortOrder",
                   parent_id AS "parentId", type_id AS "typeId", name,
                   description, icon, is_active AS "isActive",
                   created_at AS "createdAt", updated_at AS "updatedAt",
                   deleted_at AS "deletedAt"`,
        0,
        dto.sortOrder ?? 0,
        dto.parentId ?? 0,
        dto.typeId ?? 0,
        dto.name,
        dto.description ?? null,
        dto.icon ?? 'noimage.jpg',
        dto.isActive ?? true,
      ),
    );
    return rows[0];
  }

  async update(
    tenant: TenantContext,
    id: number,
    dto: UpdateEquipmentDto,
  ): Promise<EquipmentRow> {
    // Build the SET fragment dynamically from the provided fields.
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const push = (sql: string, value: unknown) => {
      sets.push(sql.replace('$?', `$${i++}`));
      values.push(value);
    };

    if (dto.name !== undefined)        push('name = $?',        dto.name);
    if (dto.parentId !== undefined)    push('parent_id = $?',   dto.parentId);
    if (dto.typeId !== undefined)      push('type_id = $?',     dto.typeId);
    if (dto.description !== undefined) push('description = $?', dto.description);
    if (dto.icon !== undefined)        push('icon = $?',        dto.icon);
    if (dto.sortOrder !== undefined)   push('sort_order = $?',  dto.sortOrder);
    if (dto.isActive !== undefined)    push('is_active = $?',   dto.isActive);

    if (sets.length === 0) {
      return this.findOne(tenant, id);
    }
    sets.push(`updated_at = now()`);

    values.push(id); // last positional for WHERE id = $N

    const rows = await this.prisma.withTenant(tenant.schemaName, (tx) =>
      tx.$queryRawUnsafe<EquipmentRow[]>(
        `UPDATE equipment SET ${sets.join(', ')}
         WHERE id = $${i} AND deleted_at IS NULL
         RETURNING id, company_id AS "companyId", sort_order AS "sortOrder",
                   parent_id AS "parentId", type_id AS "typeId", name,
                   description, icon, is_active AS "isActive",
                   created_at AS "createdAt", updated_at AS "updatedAt",
                   deleted_at AS "deletedAt"`,
        ...values,
      ),
    );
    if (rows.length === 0) throw new NotFoundException('equipment-not-found');
    return rows[0];
  }

  async softDelete(tenant: TenantContext, id: number): Promise<void> {
    const result = await this.prisma.withTenant(tenant.schemaName, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE equipment SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        id,
      ),
    );
    if (result === 0) throw new NotFoundException('equipment-not-found');
  }
}

export interface EquipmentRow {
  id: number;
  companyId: number;
  sortOrder: number;
  parentId: number;
  typeId: number;
  name: string | null;
  description: string | null;
  icon: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Re-export `Prisma` so consuming files don't need a second import path.
export { Prisma };

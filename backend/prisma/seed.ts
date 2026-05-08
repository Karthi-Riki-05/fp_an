/* eslint-disable no-console */
/**
 * Idempotent seed — safe to run on every startup.
 *
 * Seeds:
 *   - 26 permissions per MIGRATION_NOTES.md §4.5 (R1 v3)
 *   - 3 roles (Administrator / Company / User) and the role-permission matrix
 *   - One Super Admin user from SEED_SUPERADMIN_EMAIL/PASSWORD env (skipped if unset)
 *   - One demo Tenant `demo` with its tenant_<id> schema cloned from
 *     tenant_template (Phase 3 verification)
 *   - One demo tenant user `user@demo.local` (User role, attached to demo)
 *
 * All passwords are stored as bcryptjs hashes.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

interface PermissionSeed {
  name: string;
  display_name: string;
  sort: number;
}

interface RoleSeed {
  name: string;
  all: boolean;
  sort: number;
  permissions: string[];
}

const PERMISSIONS: PermissionSeed[] = [
  { name: 'view-backend',           display_name: 'View Backend',                  sort: 1 },
  { name: 'manage-users',           display_name: 'Manage Users',                  sort: 2 },
  { name: 'manage-roles',           display_name: 'Manage Roles',                  sort: 3 },
  { name: 'manage-tenants',         display_name: 'Manage Tenants',                sort: 4 },
  { name: 'impersonate-users',      display_name: 'Impersonate Users',             sort: 5 },
  { name: 'manage-equipment',       display_name: 'Manage Equipment',              sort: 10 },
  { name: 'manage-flow-designs',    display_name: 'Manage Flow Designs',           sort: 11 },
  { name: 'manage-parts',           display_name: 'Manage Parts',                  sort: 12 },
  { name: 'manage-orders',          display_name: 'Manage Orders',                 sort: 13 },
  { name: 'manage-work-shifts',     display_name: 'Manage Work Shifts',            sort: 14 },
  { name: 'manage-shift-schedules', display_name: 'Manage Shift Schedules',        sort: 15 },
  { name: 'manage-machines',        display_name: 'Manage Machines',               sort: 16 },
  { name: 'manage-folders',         display_name: 'Manage File Folders',           sort: 17 },
  { name: 'manage-workstations',    display_name: 'Manage Workstations',           sort: 18 },
  { name: 'manage-types',           display_name: 'Manage Types',                  sort: 20 },
  { name: 'manage-stop-reasons',    display_name: 'Manage Stop Reasons',           sort: 21 },
  { name: 'manage-scrap-reasons',   display_name: 'Manage Scrap Reasons',          sort: 22 },
  { name: 'manage-cms',             display_name: 'Manage CMS',                    sort: 30 },
  { name: 'manage-feedback',        display_name: 'Manage Feedback',               sort: 31 },
  { name: 'manage-warning-data',    display_name: 'Manage Warning Data',           sort: 32 },
  { name: 'manage-loss-model',      display_name: 'Manage Loss Model',             sort: 33 },
  { name: 'manage-import-export',   display_name: 'Manage Import/Export',          sort: 40 },
  { name: 'send-notifications',     display_name: 'Send Notifications',            sort: 41 },
  { name: 'write-production-data',  display_name: 'Write Production Data',         sort: 50 },
  { name: 'write-scrap-data',       display_name: 'Write Scrap Data',              sort: 51 },
  { name: 'write-stop-data',        display_name: 'Write Stop Data',               sort: 52 },
];

if (PERMISSIONS.length !== 26) {
  throw new Error(`Permission seed list has ${PERMISSIONS.length}, expected 26`);
}

const COMPANY_PERMISSIONS = [
  'view-backend',
  'manage-users',
  'manage-equipment',
  'manage-flow-designs',
  'manage-parts',
  'manage-orders',
  'manage-work-shifts',
  'manage-shift-schedules',
  'manage-machines',
  'manage-folders',
  'manage-workstations',
  'manage-types',
  'manage-stop-reasons',
  'manage-scrap-reasons',
  'manage-cms',
  'manage-feedback',
  'manage-warning-data',
  'manage-loss-model',
  'manage-import-export',
  'send-notifications',
  'write-production-data',
  'write-scrap-data',
  'write-stop-data',
];

const USER_PERMISSIONS = [
  'write-production-data',
  'write-scrap-data',
  'write-stop-data',
];

const ROLES: RoleSeed[] = [
  { name: 'Administrator', all: true,  sort: 1, permissions: PERMISSIONS.map((p) => p.name) },
  { name: 'Company',       all: false, sort: 2, permissions: COMPANY_PERMISSIONS },
  { name: 'User',          all: false, sort: 3, permissions: USER_PERMISSIONS },
];

function ensure(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

async function provisionTenantSchema(prisma: PrismaClient, schemaName: string): Promise<number> {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) {
    throw new Error(`unsafe schema name: ${schemaName}`);
  }
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  let cloned = 0;
  for (const { table_name } of tables) {
    const exists = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) AS count FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      schemaName,
      table_name,
    );
    if (exists[0]?.count && Number(exists[0].count) > 0) continue;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`,
    );
    cloned++;
  }
  return cloned;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // -------- permissions --------
    console.log('[seed] permissions');
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: { displayName: perm.display_name, sort: perm.sort },
        create: { name: perm.name, displayName: perm.display_name, sort: perm.sort },
      });
    }

    // -------- roles + role-permission matrix --------
    console.log('[seed] roles + role-permission grants');
    const permByName = new Map(
      (await prisma.permission.findMany()).map((p) => [p.name, p.id]),
    );

    const roleByName = new Map<string, number>();
    for (const role of ROLES) {
      const dbRole = await prisma.role.upsert({
        where: { name: role.name },
        update: { all: role.all, sort: role.sort },
        create: { name: role.name, all: role.all, sort: role.sort },
      });
      roleByName.set(role.name, dbRole.id);

      await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
      const grants = role.permissions
        .map((p) => permByName.get(p))
        .filter((id): id is number => typeof id === 'number')
        .map((permissionId) => ({ roleId: dbRole.id, permissionId }));
      if (grants.length > 0) {
        await prisma.rolePermission.createMany({ data: grants, skipDuplicates: true });
      }
      console.log(`  ${role.name}: ${grants.length} permissions`);
    }

    // -------- demo tenant (provision before users so user2 can attach to it) --------
    console.log('[seed] demo tenant');
    let demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
    if (!demo) {
      demo = await prisma.tenant.create({
        data: {
          slug: 'demo',
          name: 'Demo Tenant',
          schemaName: 'tenant_demo_pending',
          timezone: 'Europe/Stockholm',
        },
      });
    }
    const demoSchemaName = `tenant_${demo.id}`;
    if (demo.schemaName !== demoSchemaName) {
      demo = await prisma.tenant.update({
        where: { id: demo.id },
        data: { schemaName: demoSchemaName },
      });
    }
    const cloned = await provisionTenantSchema(prisma, demoSchemaName);
    console.log(`  schema ${demoSchemaName}: ${cloned} tables cloned`);

    // -------- cleanup: drop legacy dev emails on each run --------
    const LEGACY_DEV_EMAILS = ['admin@fpanalyzer.local', 'user@demo.local'];
    const deleted = await prisma.user.deleteMany({
      where: { email: { in: LEGACY_DEV_EMAILS } },
    });
    if (deleted.count > 0) {
      console.log(`[seed] cleaned up ${deleted.count} legacy dev users`);
    }

    // -------- dev users: user1 (Administrator) + user2 (Company in demo tenant) --------
    const adminRoleId = roleByName.get('Administrator');
    const companyRoleId = roleByName.get('Company');

    const adminEmail    = ensure(process.env.SEED_SUPERADMIN_EMAIL);
    const adminPassword = ensure(process.env.SEED_SUPERADMIN_PASSWORD);
    if (adminEmail && adminPassword && adminRoleId) {
      console.log(`[seed] admin user (${adminEmail})`);
      const hash = await bcrypt.hash(adminPassword, 12);
      const u = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { name: 'Admin User', firstName: 'Admin', lastName: 'User', confirmed: true, status: 1 },
        create: {
          name: 'Admin User',
          firstName: 'Admin',
          lastName: 'User',
          email: adminEmail,
          password: hash,
          confirmed: true,
          status: 1,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: adminRoleId } },
        update: {},
        create: { userId: u.id, roleId: adminRoleId },
      });
    } else {
      console.log('[seed] SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipping admin user');
    }

    const companyEmail    = ensure(process.env.SEED_COMPANY_EMAIL);
    const companyPassword = ensure(process.env.SEED_COMPANY_PASSWORD);
    if (companyEmail && companyPassword && companyRoleId && demo) {
      console.log(`[seed] company-role user (${companyEmail}) attached to demo tenant`);
      const hash = await bcrypt.hash(companyPassword, 12);
      const u = await prisma.user.upsert({
        where: { email: companyEmail },
        update: { name: 'Company User', firstName: 'Company', lastName: 'User', confirmed: true, status: 1 },
        create: {
          name: 'Company User',
          firstName: 'Company',
          lastName: 'User',
          email: companyEmail,
          password: hash,
          confirmed: true,
          status: 1,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: companyRoleId } },
        update: {},
        create: { userId: u.id, roleId: companyRoleId },
      });
      await prisma.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: demo.id, userId: u.id } },
        update: { status: true, roleId: companyRoleId },
        create: { tenantId: demo.id, userId: u.id, roleId: companyRoleId, status: true },
      });
    } else {
      console.log('[seed] SEED_COMPANY_EMAIL/PASSWORD not set — skipping company user');
    }

    const fingerprint = createHash('sha256')
      .update(PERMISSIONS.map((p) => p.name).sort().join(','))
      .digest('hex')
      .slice(0, 12);
    console.log(`[seed] done. permission set fingerprint=${fingerprint}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED', err);
  process.exit(1);
});

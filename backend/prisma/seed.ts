/* eslint-disable no-console */
/**
 * Idempotent seed — safe to run on every startup.
 *
 * Seeds:
 *  - 26 permissions per MIGRATION_NOTES.md §4.5
 *  - 3 roles (Administrator / Company / User), R1 v3 mappings
 *  - role-permission grants
 *  - one Super Admin user from SEED_SUPERADMIN_EMAIL/PASSWORD env (skipped if unset)
 *
 * Phase 3 will add a demo Tenant + sample tenant-scoped data; for now the
 * seed only touches the public schema, so it works against a fresh DB
 * without needing per-tenant schemas to exist yet.
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

interface PermissionSeed {
  name: string;
  display_name: string;
  sort: number;
}

interface RoleSeed {
  name: string;
  all: boolean;
  sort: number;
  permissions: string[]; // permission names
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

/**
 * Light-weight password hash — bcrypt would be preferred but pulling it into
 * the seed-only path adds a native build dep we don't otherwise need at this
 * stage. Phase 3's auth module replaces this with the real bcrypt-based
 * argon2/bcrypt hash. The format is intentionally distinguishable from
 * legacy bcrypt hashes ($2y$...) so the auth layer can detect and re-hash.
 */
async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(plain, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function ensure(name: string, value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('[seed] permissions');
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: { displayName: perm.display_name, sort: perm.sort },
        create: { name: perm.name, displayName: perm.display_name, sort: perm.sort },
      });
    }

    console.log('[seed] roles + role-permission grants');
    const permByName = new Map(
      (await prisma.permission.findMany()).map((p) => [p.name, p.id]),
    );

    for (const role of ROLES) {
      const dbRole = await prisma.role.upsert({
        where: { name: role.name },
        update: { all: role.all, sort: role.sort },
        create: { name: role.name, all: role.all, sort: role.sort },
      });

      // Reset role's permissions to the canonical seed list — idempotent.
      await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
      const grants = role.permissions
        .map((permName) => permByName.get(permName))
        .filter((id): id is number => typeof id === 'number')
        .map((permissionId) => ({ roleId: dbRole.id, permissionId }));

      if (grants.length > 0) {
        await prisma.rolePermission.createMany({ data: grants, skipDuplicates: true });
      }
      console.log(`  ${role.name}: ${grants.length} permissions`);
    }

    const seedEmail = ensure('SEED_SUPERADMIN_EMAIL', process.env.SEED_SUPERADMIN_EMAIL);
    const seedPassword = ensure('SEED_SUPERADMIN_PASSWORD', process.env.SEED_SUPERADMIN_PASSWORD);
    if (seedEmail && seedPassword) {
      console.log(`[seed] super-admin user (${seedEmail})`);
      const passwordHash = await hashPassword(seedPassword);
      const user = await prisma.user.upsert({
        where: { email: seedEmail },
        update: {
          // Don't overwrite an existing password on every boot; only set if missing.
          name: 'Super Admin',
          firstName: 'Super',
          lastName: 'Admin',
          confirmed: true,
          status: 1,
        },
        create: {
          name: 'Super Admin',
          firstName: 'Super',
          lastName: 'Admin',
          email: seedEmail,
          password: passwordHash,
          confirmed: true,
          status: 1,
        },
      });
      const adminRole = await prisma.role.findUnique({ where: { name: 'Administrator' } });
      if (adminRole) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
          update: {},
          create: { userId: user.id, roleId: adminRole.id },
        });
      }
    } else {
      console.log('[seed] SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipping super-admin');
    }

    // Sanity output — fingerprint of seeded perms (helps spot drift).
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

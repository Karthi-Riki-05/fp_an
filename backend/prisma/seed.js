'use strict';
/* eslint-disable no-console */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createHash } = require('node:crypto');

const PERMISSIONS = [
  { name: 'view-backend',           displayName: 'View Backend',                sort: 1 },
  { name: 'manage-users',           displayName: 'Manage Users',                sort: 2 },
  { name: 'manage-roles',           displayName: 'Manage Roles',                sort: 3 },
  { name: 'manage-tenants',         displayName: 'Manage Tenants',              sort: 4 },
  { name: 'impersonate-users',      displayName: 'Impersonate Users',           sort: 5 },
  { name: 'manage-equipment',       displayName: 'Manage Equipment',            sort: 10 },
  { name: 'manage-flow-designs',    displayName: 'Manage Flow Designs',         sort: 11 },
  { name: 'view-flow-monitor',      displayName: 'View Flow Monitor',           sort: 11 },
  { name: 'view-flow-analyzer',     displayName: 'View Flow Analyzer',          sort: 11 },
  { name: 'manage-parts',           displayName: 'Manage Parts',                sort: 12 },
  { name: 'manage-orders',          displayName: 'Manage Orders',               sort: 13 },
  { name: 'manage-work-shifts',     displayName: 'Manage Work Shifts',          sort: 14 },
  { name: 'manage-shift-schedules', displayName: 'Manage Shift Schedules',      sort: 15 },
  { name: 'manage-machines',        displayName: 'Manage Machines',             sort: 16 },
  { name: 'manage-folders',         displayName: 'Manage File Folders',         sort: 17 },
  { name: 'manage-workstations',    displayName: 'Manage Workstations',         sort: 18 },
  { name: 'manage-types',           displayName: 'Manage Types',                sort: 20 },
  { name: 'manage-stop-reasons',    displayName: 'Manage Stop Reasons',         sort: 21 },
  { name: 'manage-scrap-reasons',   displayName: 'Manage Scrap Reasons',        sort: 22 },
  { name: 'manage-cms',             displayName: 'Manage CMS',                  sort: 30 },
  { name: 'manage-feedback',        displayName: 'Manage Feedback',             sort: 31 },
  { name: 'manage-warning-data',    displayName: 'Manage Warning Data',         sort: 32 },
  { name: 'manage-loss-model',      displayName: 'Manage Loss Model',           sort: 33 },
  { name: 'manage-sliders',         displayName: 'Manage Sliders',              sort: 34 },
  { name: 'manage-testimonials',    displayName: 'Manage Testimonials',         sort: 35 },
  { name: 'manage-social',          displayName: 'Manage Social Links',         sort: 36 },
  { name: 'manage-import-export',   displayName: 'Manage Import/Export',        sort: 40 },
  { name: 'send-notifications',     displayName: 'Send Notifications',          sort: 41 },
  { name: 'write-production-data',  displayName: 'Write Production Data',       sort: 50 },
  { name: 'write-scrap-data',       displayName: 'Write Scrap Data',            sort: 51 },
  { name: 'write-stop-data',        displayName: 'Write Stop Data',             sort: 52 },
];

if (PERMISSIONS.length !== 31) {
  throw new Error(`Permission seed list has ${PERMISSIONS.length}, expected 31`);
}

const COMPANY_PERMISSIONS = [
  'view-backend', 'manage-users', 'manage-equipment', 'manage-flow-designs',
  'view-flow-monitor', 'view-flow-analyzer',
  'manage-parts', 'manage-orders', 'manage-work-shifts', 'manage-shift-schedules',
  'manage-machines', 'manage-folders', 'manage-workstations', 'manage-types',
  'manage-stop-reasons', 'manage-scrap-reasons', 'manage-cms', 'manage-feedback',
  'manage-warning-data', 'manage-loss-model', 'manage-import-export',
  'send-notifications', 'write-production-data', 'write-scrap-data', 'write-stop-data',
];

const USER_PERMISSIONS = [
  'view-flow-monitor', 'view-flow-analyzer',
  'write-production-data', 'write-scrap-data', 'write-stop-data',
];

const ROLES = [
  { name: 'Administrator', all: true,  sort: 1, permissions: PERMISSIONS.map((p) => p.name) },
  { name: 'Company',       all: false, sort: 2, permissions: COMPANY_PERMISSIONS },
  { name: 'User',          all: false, sort: 3, permissions: USER_PERMISSIONS },
];

function ensure(value) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

async function provisionTenantSchema(prisma, schemaName) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schemaName)) throw new Error(`unsafe schema name: ${schemaName}`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'tenant_template' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  let cloned = 0;
  for (const { table_name } of tables) {
    const exists = await prisma.$queryRawUnsafe(
      `SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      schemaName, table_name,
    );
    if (exists[0]?.count && Number(exists[0].count) > 0) continue;
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schemaName}"."${table_name}" (LIKE "tenant_template"."${table_name}" INCLUDING ALL)`);
    cloned++;
  }
  return cloned;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // Permissions
    console.log('[seed] permissions');
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { name: perm.name },
        update: { displayName: perm.displayName, sort: perm.sort },
        create: { name: perm.name, displayName: perm.displayName, sort: perm.sort },
      });
    }

    // Roles + role-permission matrix
    console.log('[seed] roles + role-permission grants');
    const permByName = new Map((await prisma.permission.findMany()).map((p) => [p.name, p.id]));
    const roleByName = new Map();

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
        .filter((id) => typeof id === 'number')
        .map((permissionId) => ({ roleId: dbRole.id, permissionId }));
      if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants, skipDuplicates: true });
      console.log(`  ${role.name}: ${grants.length} permissions`);
    }

    // Demo tenant — post Tenant-removal: there is no Tenant table. The
    // demo company is just the Company-role user (seeded below) and the
    // schema is `tenant_${companyUser.id}`. Schema provisioning happens
    // after the Company user is created.

    // Cleanup legacy dev emails
    const LEGACY_DEV_EMAILS = ['admin@fpanalyzer.local', 'user@demo.local'];
    const deleted = await prisma.user.deleteMany({ where: { email: { in: LEGACY_DEV_EMAILS } } });
    if (deleted.count > 0) console.log(`[seed] cleaned up ${deleted.count} legacy dev users`);

    // Admin user
    const adminRoleId = roleByName.get('Administrator');
    const companyRoleId = roleByName.get('Company');

    const adminEmail = ensure(process.env.SEED_SUPERADMIN_EMAIL);
    const adminPassword = ensure(process.env.SEED_SUPERADMIN_PASSWORD);
    if (adminEmail && adminPassword && adminRoleId) {
      console.log(`[seed] admin user (${adminEmail})`);
      const hash = await bcrypt.hash(adminPassword, 12);
      const u = await prisma.user.upsert({
        where: { email: adminEmail },
        update: { name: 'Admin User', firstName: 'Admin', lastName: 'User', confirmed: true, status: 1 },
        create: { name: 'Admin User', firstName: 'Admin', lastName: 'User', email: adminEmail, password: hash, confirmed: true, status: 1 },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: adminRoleId } },
        update: {},
        create: { userId: u.id, roleId: adminRoleId },
      });
    } else {
      console.log('[seed] SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipping admin user');
    }

    // Company user — IS the company, per the Tenant-removal refactor.
    const companyEmail = ensure(process.env.SEED_COMPANY_EMAIL);
    const companyPassword = ensure(process.env.SEED_COMPANY_PASSWORD);
    if (companyEmail && companyPassword && companyRoleId) {
      console.log(`[seed] company-role user (${companyEmail})`);
      const hash = await bcrypt.hash(companyPassword, 12);
      const u = await prisma.user.upsert({
        where: { email: companyEmail },
        update: { name: 'Company User', firstName: 'Company', lastName: 'User', confirmed: true, status: 1 },
        create: { name: 'Company User', firstName: 'Company', lastName: 'User', email: companyEmail, password: hash, confirmed: true, status: 1 },
      });
      await prisma.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: companyRoleId } }, update: {}, create: { userId: u.id, roleId: companyRoleId } });
      // Provision the per-Company schema. provisionTenantSchema is
      // idempotent — safe to call on every seed run.
      const schemaName = `tenant_${u.id}`;
      const cloned = await provisionTenantSchema(prisma, schemaName);
      console.log(`  schema ${schemaName}: ${cloned} tables cloned`);
    } else {
      console.log('[seed] SEED_COMPANY_EMAIL/PASSWORD not set — skipping company user');
    }

    const fingerprint = createHash('sha256').update(PERMISSIONS.map((p) => p.name).sort().join(',')).digest('hex').slice(0, 12);
    console.log(`[seed] done. permission set fingerprint=${fingerprint}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED', err);
  process.exit(1);
});

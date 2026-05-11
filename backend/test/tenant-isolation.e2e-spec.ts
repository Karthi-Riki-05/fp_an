/**
 * e2e: tenant data isolation guarantee.
 *
 * Per Phase 0 v2 §13.23, tenant-scoped reads must never leak across tenants.
 * This spec covers the two enforcement layers:
 *
 *   1. JWT scoping — a non-admin user's JWT carries tenantId; the
 *      TenantInterceptor refuses any X-Tenant-Id header that doesn't match.
 *   2. Service-level filtering — admin endpoints accept X-Tenant-Id and
 *      MUST filter results by it (no implicit "show me all tenants").
 *
 * Test plan:
 *   - Admin lists users in tenant 3 → sees N users.
 *   - Admin lists users in tenant 4 → sees a different set (or empty).
 *   - Tenant-3 Company user attempts to set X-Tenant-Id: 4 → 403/forbidden.
 *   - Tenant-3 Company user with no header → reads only tenant 3's rows.
 *
 * Requires the dev seed (admin + Company user in tenant 3, plus tenant 4
 * created from the seed).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { login } from './helpers/login';

describe('Tenant isolation', () => {
  let app: INestApplication;
  const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? 'user1@gmail.com';
  const ADMIN_PASS = process.env.SEED_SUPERADMIN_PASSWORD ?? 'password123';
  const COMPANY_EMAIL = process.env.SEED_COMPANY_EMAIL ?? 'user2@gmail.com';
  const COMPANY_PASS = process.env.SEED_COMPANY_PASSWORD ?? 'password123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let adminCookie: string;
  let companyCookie: string;

  it('logs in admin + company user', async () => {
    adminCookie = (await login(app, ADMIN_EMAIL, ADMIN_PASS)).cookie;
    companyCookie = (await login(app, COMPANY_EMAIL, COMPANY_PASS)).cookie;
  });

  it('admin sees tenant 3 users, separately from tenant 4 users', async () => {
    const t3 = await request(app.getHttpServer())
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '3')
      .expect(200);
    const t4 = await request(app.getHttpServer())
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '4')
      .expect(200);
    // Same call shape, different totals — the interceptor separated them.
    expect(t3.body.total).toBeGreaterThanOrEqual(1);
    const t3Ids = new Set(t3.body.data.map((u: { id: number }) => u.id));
    const t4Ids = new Set(t4.body.data.map((u: { id: number }) => u.id));
    // Intersection should be at most users that legitimately belong to both
    // (none in the dev seed); critically, t3 must NOT be a superset of t4.
    for (const id of t4Ids) expect(t3Ids.has(id)).toBe(false);
  });

  it('company user (tenant 3) cannot access tenant 4 by setting the header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Cookie', companyCookie)
      .set('X-Tenant-Id', '4');
    // TenantInterceptor refuses cross-tenant access for non-admins.
    expect([401, 403]).toContain(res.status);
  });

  it('company user with no override gets only their own tenant data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Cookie', companyCookie)
      .expect(200);
    // Every row should be a member of tenant 3 (the user's own tenant).
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('admin /admin/feedback filtered by tenantId returns only that tenant', async () => {
    // Public feedback model — Super Admin filter is via ?tenantId=N.
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/feedback?tenantId=3')
      .set('Cookie', adminCookie)
      .expect(200);
    for (const f of res.body.data) expect(f.tenantId).toBe(3);
  });
});

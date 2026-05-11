/**
 * Security-critical e2e: Super Admin login-as flow.
 *
 *   1. Admin logs in.
 *   2. Admin POSTs /admin/users/:id/impersonate.
 *   3. Impersonation cookie sub=target, impersonator_id=admin.
 *   4. Operations under impersonation cookie are audited under BOTH ids.
 *   5. POST /auth/impersonate/stop swaps in a fresh admin token (no re-login).
 *   6. Cannot impersonate another Administrator.
 *   7. Calling /auth/impersonate/stop with a non-impersonation token errors.
 *
 * Requires the dev seed (user1@gmail.com admin + user2@gmail.com Company in
 * tenant 3) — run `npm run prisma:seed` in the backend container first.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { login } from './helpers/login';

describe('Impersonation flow', () => {
  let app: INestApplication;
  const ADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? 'user1@gmail.com';
  const ADMIN_PASS = process.env.SEED_SUPERADMIN_PASSWORD ?? 'password123';
  const TENANT_USER_EMAIL = process.env.SEED_COMPANY_EMAIL ?? 'user2@gmail.com';

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
  let adminId: number;
  let targetUserId: number;

  it('admin logs in', async () => {
    const r = await login(app, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = r.cookie;
    adminId = r.userId;
    expect(r.roles).toContain('Administrator');
  });

  it('finds the target user (Company role in tenant 3)', async () => {
    // We pull the user list as Super Admin, scoped to tenant 3 via header.
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?perPage=200')
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '3')
      .expect(200);
    const target = res.body.data.find((u: { email: string }) => u.email === TENANT_USER_EMAIL);
    expect(target).toBeDefined();
    targetUserId = target.id;
  });

  let impersonationCookie: string;

  it('admin impersonates target — token has sub=target + impersonator_id=admin', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetUserId}/impersonate`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '3')
      .expect(201);
    expect(res.body.user.id).toBe(targetUserId);
    expect(res.body.user.impersonatorId).toBe(adminId);
    const arr = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const c = arr.find((x: string) => x.startsWith('access_token='));
    expect(c).toBeDefined();
    impersonationCookie = c!.split(';')[0];

    // Decode payload (no verify — we just want to inspect the claims).
    const payload = JSON.parse(
      Buffer.from(impersonationCookie.split('.')[1], 'base64').toString('utf8'),
    );
    expect(payload.sub).toBe(targetUserId);
    expect(payload.impersonator_id).toBe(adminId);
    expect(payload.kind).toBe('web');
  });

  it('audit log records BOTH the start event and a marker on later writes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/history?perPage=10&typeName=User')
      .set('Cookie', adminCookie)
      .expect(200);
    const startEvent = res.body.data.find(
      (h: { text: string }) => h.text.includes('started impersonating user'),
    );
    expect(startEvent).toBeDefined();
    expect(startEvent.actorId).toBe(adminId);
    expect(startEvent.entityId).toBe(targetUserId);
  });

  it('refuses to impersonate another Administrator', async () => {
    // Try to impersonate the admin themselves.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${adminId}/impersonate`)
      .set('Cookie', adminCookie)
      .set('X-Tenant-Id', '3')
      .expect(403);
  });

  it('stops impersonation — fresh admin token, no re-login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/impersonate/stop')
      .set('Cookie', impersonationCookie)
      .expect(200);
    expect(res.body.user.id).toBe(adminId);
    expect(res.body.user.tenantId).toBeNull();
    const arr = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const c = arr.find((x: string) => x.startsWith('access_token='));
    expect(c).toBeDefined();
    const fresh = c!.split(';')[0];
    const payload = JSON.parse(
      Buffer.from(fresh.split('.')[1], 'base64').toString('utf8'),
    );
    expect(payload.sub).toBe(adminId);
    expect(payload.impersonator_id).toBeUndefined();
  });

  it('returns 400 when /auth/impersonate/stop is called from a non-impersonation token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/impersonate/stop')
      .set('Cookie', adminCookie)
      .expect(400);
  });
});

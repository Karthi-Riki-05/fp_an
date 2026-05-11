'use strict';

const request = require('supertest');

/**
 * Login helper for e2e tests.
 * Returns { cookie, userId, roles, tenantId }.
 */
async function login(app, email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const setCookies = res.headers['set-cookie'] ?? [];
  const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
  const accessCookie = arr.find((c) => c.startsWith('access_token='));
  if (!accessCookie) throw new Error(`login(${email}) did not return access_token cookie`);
  const cookie = accessCookie.split(';')[0];
  return { cookie, userId: res.body.user.id, roles: res.body.user.roles ?? [], tenantId: res.body.user.tenantId };
}

module.exports = { login };

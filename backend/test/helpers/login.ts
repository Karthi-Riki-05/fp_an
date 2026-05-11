import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Logs in via the /auth/login endpoint and returns the access_token cookie
 * string ready to drop into a `Cookie: ...` header on subsequent requests.
 * Throws if the login fails — callers should let the exception bubble up.
 */
export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ cookie: string; userId: number; roles: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const setCookies = (res.headers['set-cookie'] as unknown as string[] | string) ?? [];
  const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
  const accessCookie = arr.find((c: string) => c.startsWith('access_token='));
  if (!accessCookie) throw new Error('login did not return access_token cookie');
  // The cookie value before the first ';' is the bit Express reads back.
  const cookie = accessCookie.split(';')[0];
  return {
    cookie,
    userId: res.body.user.id,
    roles: res.body.user.roles ?? [],
  };
}

export function withCookie(cookie: string) {
  return { Cookie: cookie } as const;
}

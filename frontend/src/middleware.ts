import { NextRequest, NextResponse } from 'next/server';

/**
 * Cookie-presence-only redirect logic. Validity is enforced server-side by
 * the backend; this middleware only routes:
 *
 *   - Anonymous user hitting an authenticated path → /login?next=<path>
 *   - Authenticated user (cookie present) hitting /login → /dashboard
 */

const AUTH_COOKIE = 'access_token';

/** Decode the (unverified) roles claim from the access-token JWT. Routing
 *  only — the backend still verifies the signature on every request. */
function rolesFromToken(token?: string): string[] {
  if (!token) return [];
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(json.roles) ? json.roles : [];
  } catch {
    return [];
  }
}

/** Role-based landing page: Administrator + Company → admin portal;
 *  operators (User) → mobile dashboard. */
function homeFor(roles: string[]): string {
  return roles.includes('Administrator') || roles.includes('Company')
    ? '/admin/dashboard'
    : '/dashboard';
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const hasCookie = Boolean(token);
  const home = () => homeFor(rolesFromToken(token));

  // Legacy /feedback URL → authenticated company-user feedback page.
  if (pathname === '/feedback') {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/feedback';
    return NextResponse.redirect(url);
  }

  // Root: redirect based on auth — logged-in → /dashboard, anon → /login.
  // The old (public) "/" coming-soon page is no longer reachable; it now
  // requires login like every other authenticated surface.
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = hasCookie ? home() : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // /login is always accessible. If user already has a cookie, send them home
  // (role-aware: Company/Administrator → admin portal, operators → /dashboard).
  if (pathname.startsWith('/login')) {
    if (hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = home();
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Pages requiring auth. Match by path prefix.
  const protectedPrefixes = [
    '/dashboard',
    '/equipment',
    '/admin',
    '/monitor',
    '/analyzer',
    '/myresult',
    '/units',
    '/machines',
    '/orders',
    '/boards',
    '/feedback',
    '/profile',
  ];
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except Next.js internals and static files.
  matcher: ['/((?!_next/|api/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)'],
};

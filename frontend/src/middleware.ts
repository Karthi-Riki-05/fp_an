import { NextRequest, NextResponse } from 'next/server';

/**
 * Cookie-presence-only redirect logic. Validity is enforced server-side by
 * the backend; this middleware only routes:
 *
 *   - Anonymous user hitting an authenticated path → /login?next=<path>
 *   - Authenticated user (cookie present) hitting /login → /dashboard
 */

const AUTH_COOKIE = 'access_token';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(AUTH_COOKIE));

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
    url.pathname = hasCookie ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // /login is always accessible. If user already has a cookie, send them home.
  if (pathname.startsWith('/login')) {
    if (hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
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

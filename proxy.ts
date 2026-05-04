import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import {
  createAdminClient,
  decodeSessionIdFromAccessToken,
  getTwoFactorEnforcementStatus,
} from '@/lib/security/twoFactor';
import { normalizeRelativePath } from '@/lib/inviteFlow';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = await updateSession(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessionData } = await supabase.auth.getSession();

  const PROTECTED_PREFIXES = ['/dashboard', '/archive', '/create', '/succession', '/admin'];
  const isProtectedRoute = PROTECTED_PREFIXES.some((path) => pathname.startsWith(path));
  const isTwoFactorRoute = pathname.startsWith('/two-factor');

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    const redirectTo = url.pathname + url.search;
    url.pathname = '/login';
    url.searchParams.set('next', redirectTo);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const next = normalizeRelativePath(request.nextUrl.searchParams.get('next'));
    const isAuthDestination =
      next === '/login' ||
      next === '/signup' ||
      next.startsWith('/login?') ||
      next.startsWith('/signup?');
    const destination = next !== '/' && !isAuthDestination ? next : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (user && (isProtectedRoute || isTwoFactorRoute)) {
    try {
      const sessionId = decodeSessionIdFromAccessToken(sessionData.session?.access_token);
      const status = await getTwoFactorEnforcementStatus(createAdminClient(), user.id, sessionId);

      if (isTwoFactorRoute && (!status.enabled || !status.requiresChallenge)) {
        const next = request.nextUrl.searchParams.get('next') || '/dashboard';
        const target = new URL(next.startsWith('/') ? next : '/dashboard', request.url);
        return NextResponse.redirect(target);
      }

      if (!isTwoFactorRoute && status.requiresChallenge) {
        const url = request.nextUrl.clone();
        const redirectTo = url.pathname + url.search;
        url.pathname = '/two-factor';
        url.search = '';
        url.searchParams.set('next', redirectTo);
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('[proxy-two-factor]', error);
    }
  }

  const noCachePaths = [
    '/archive',
    '/create',
    '/dashboard',
    '/choice-pricing',
    '/personal-confirmation',
    '/family-confirmation',
    '/payment-success'
  ];

  const shouldNoCache = noCachePaths.some((path) => pathname.startsWith(path));

  if (shouldNoCache) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeRelativePath } from '@/lib/inviteFlow';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT run any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could cause hard-to-debug
  // session issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes: if the user is not logged in, redirect to login
  const protectedPaths = ['/dashboard', '/create', '/payment', '/personal-confirmation', '/family-confirmation'];
  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    const redirectTo = url.pathname + url.search;
    url.pathname = '/login';
    url.searchParams.set('next', redirectTo);
    return NextResponse.redirect(url);
  }

  // If user is logged in and tries to access /login or /signup, redirect to /dashboard
  // IMPORTANT: Clear search params to prevent infinite redirect loops
  // (e.g., /login?next=/dashboard → /dashboard?next=/dashboard → loop)
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup')
  ) {
    const next = normalizeRelativePath(request.nextUrl.searchParams.get('next'));
    const isAuthDestination =
      next === '/login' ||
      next === '/signup' ||
      next.startsWith('/login?') ||
      next.startsWith('/signup?');
    const destination = next !== '/' && !isAuthDestination ? next : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Prevent browser caching of state-critical pages
  // This forces the browser to always fetch fresh content after state changes
  const noCachePaths = ['/dashboard', '/payment-success', '/choice-pricing', '/personal-confirmation', '/family-confirmation'];
  const shouldNoCache = noCachePaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (shouldNoCache) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    supabaseResponse.headers.set('Pragma', 'no-cache');
    supabaseResponse.headers.set('Expires', '0');
  }

  return supabaseResponse;
}

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decodeSessionIdFromAccessToken } from '@/lib/security/twoFactor';
import { getSessionIntegrityState } from '@/lib/sessionDevices';

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Create an authenticated Supabase client for API routes.
 * This reads the session from cookies and verifies the user server-side.
 * Use this instead of trusting client-sent userId.
 */
export async function createAuthenticatedClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored in read-only contexts (GET routes)
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const sessionId = decodeSessionIdFromAccessToken(session?.access_token);
  const sessionExpiresAt = session?.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

  let sessionState = {
    sessionId,
    exists: Boolean(sessionId),
    revoked: false,
    revokedAt: null as string | null,
    expired: Boolean(
      session?.expires_at && session.expires_at * 1000 <= Date.now()
    ),
    expiresAt: sessionExpiresAt,
    deviceLabel: null as string | null,
    ipAddress: null as string | null,
    userAgent: null as string | null,
    lastSeenAt: null as string | null,
    createdAt: null as string | null,
  };

  if (user && sessionId) {
    const admin = getAdminClient();
    if (admin) {
      sessionState = await getSessionIntegrityState(admin, {
        userId: user.id,
        sessionId,
        expiresAt: sessionExpiresAt,
      });
    }
  }

  if ((sessionState.revoked || sessionState.expired) && sessionId) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return {
      supabase,
      user: null,
      error:
        error ||
        new Error(
          sessionState.revoked ? 'Session revoked' : 'Session expired'
        ),
      session,
      sessionId,
      sessionState,
    };
  }

  return { supabase, user, error, session, sessionId, sessionState };
}

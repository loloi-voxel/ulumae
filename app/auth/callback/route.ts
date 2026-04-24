import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  extractInviteTokenFromPath,
  getInvitePath,
  normalizeRelativePath,
  PENDING_INVITE_COOKIE,
  PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/inviteFlow';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const verificationType = searchParams.get('type');
  const requestedNext = normalizeRelativePath(searchParams.get('next'));
  const cookieInvite = request.headers
    .get('cookie')
    ?.split('; ')
    .find((entry) => entry.startsWith(`${PENDING_INVITE_COOKIE}=`))
    ?.split('=')[1];
  const fallbackInviteToken = cookieInvite ? decodeURIComponent(cookieInvite) : null;
  const next =
    requestedNext === '/' && fallbackInviteToken
      ? getInvitePath(fallbackInviteToken)
      : requestedNext;
  const inviteToken = extractInviteTokenFromPath(next) || fallbackInviteToken;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      if (inviteToken) {
        response.cookies.set(PENDING_INVITE_COOKIE, inviteToken, {
          path: '/',
          sameSite: 'lax',
          maxAge: PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
        });
      } else {
        response.cookies.delete(PENDING_INVITE_COOKIE);
      }

      return response;
    }
  }

  if (tokenHash && verificationType) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verificationType as EmailOtpType,
    });

    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      if (inviteToken) {
        response.cookies.set(PENDING_INVITE_COOKIE, inviteToken, {
          path: '/',
          sameSite: 'lax',
          maxAge: PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
        });
      } else {
        response.cookies.delete(PENDING_INVITE_COOKIE);
      }

      return response;
    }
  }

  if (inviteToken) {
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set(PENDING_INVITE_COOKIE, inviteToken, {
      path: '/',
      sameSite: 'lax',
      maxAge: PENDING_INVITE_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

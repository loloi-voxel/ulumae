import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/apiAuth';
import { sendEmail } from '@/lib/email/sender';
import { getSignupConfirmationEmail } from '@/lib/email/templates';
import { normalizeRelativePath } from '@/lib/inviteFlow';

interface SignupRequestBody {
  email?: string;
  password?: string;
  next?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignupRequestBody;
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    const next = normalizeRelativePath(body.next);

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || request.nextUrl.origin;
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;
    const admin = getSupabaseAdmin();

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo,
      },
    });

    if (error || !data.properties?.action_link || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Could not create your account.' },
        { status: 400 }
      );
    }

    const confirmationLink = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(
      data.properties.hashed_token
    )}&type=${encodeURIComponent(data.properties.verification_type)}&next=${encodeURIComponent(next)}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Confirm your ULUMAE account',
        html: getSignupConfirmationEmail(email, confirmationLink),
      });
    } catch (emailError: any) {
      try {
        await admin.auth.admin.deleteUser(data.user.id);
      } catch (cleanupError) {
        console.error('[signup] Failed to clean up user after email send failure:', cleanupError);
      }

      return NextResponse.json(
        { error: emailError?.message || 'Could not send the confirmation email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[signup] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Could not create your account.' },
      { status: 500 }
    );
  }
}

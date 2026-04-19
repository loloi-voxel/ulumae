import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { sendEmail } from '@/lib/email/sender';

const REFUND_INBOX = 'refunds@ulumae.com';

export async function POST(request: NextRequest) {
    const { user } = await createAuthenticatedClient();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: { message?: unknown } = {};
    try {
        payload = await request.json().catch(() => ({}));
    } catch {
        payload = {};
    }

    const message =
        typeof payload.message === 'string' ? payload.message.trim().slice(0, 2000) : '';

    const subject = `Refund request — ${user.email || user.id}`;
    const html = `
        <p>A user has submitted a refund request from the Settings page.</p>
        <ul>
            <li><strong>User ID:</strong> ${user.id}</li>
            <li><strong>Email:</strong> ${user.email || 'n/a'}</li>
            <li><strong>Requested at:</strong> ${new Date().toISOString()}</li>
        </ul>
        ${message ? `<p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br/>')}</p>` : ''}
    `;

    try {
        await sendEmail({ to: REFUND_INBOX, subject, html });
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Could not send refund request.' },
            { status: 500 }
        );
    }
}

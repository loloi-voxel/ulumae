import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
    isAssignableArchiveMemberRole,
    updateArchiveMemberRole,
} from '@/lib/archiveMemberAccess';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string, targetUserId: string }> }
) {
    try {
        const { memorialId, targetUserId } = await params;
        const { newRole } = await req.json();

        if (!newRole || !isAssignableArchiveMemberRole(newRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const access = await requireMemorialAccess({
            memorialId,
            action: 'manage_members',
        });
        if (!access.ok) return access.response;

        const { user, admin, context } = access;
        const result = await updateArchiveMemberRole(admin, context, {
            targetUserId,
            newRole,
        });

        if (result.changed) {
            await safeLogMemorialActivity(admin, {
                memorialId,
                action: 'member_role_updated',
                summary: `A member role was changed to ${result.newRole}.`,
                actorUserId: user.id,
                actorEmail: user.email ?? null,
                subjectUserId: targetUserId,
                details: {
                    oldRole: result.oldRole,
                    newRole: result.newRole,
                },
            });
        }

        return NextResponse.json({
            success: true,
            changed: result.changed,
            oldRole: result.oldRole,
            newRole: result.newRole,
        });
    } catch (error: any) {
        const message = error.message || 'Internal server error';
        const status =
            message === 'Member not found'
                ? 404
                : message.includes('owner')
                    ? 400
                    : message.includes('Family plan') || message.includes('Personal archives')
                        ? 403
                        : 500;

        return NextResponse.json({ error: message }, { status });
    }
}

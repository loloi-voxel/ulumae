import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import type { ArchivePermissionContext } from '@/lib/archivePermissions';
import {
    isAssignableArchiveMemberRole,
    removeArchiveMemberAccess,
    updateArchiveMemberRole,
} from '@/lib/archiveMemberAccess';
import { getOwnerFamilyMemorials } from '@/lib/familyWorkspace';
import type { WitnessRole } from '@/types/roles';

async function getAffectedMemorialIds(
    admin: SupabaseClient,
    context: ArchivePermissionContext,
    roles: Array<WitnessRole | null>
) {
    const includesCoGuardianChange = roles.some((role) => role === 'co_guardian');

    if (context.plan !== 'family' || !includesCoGuardianChange) {
        return [context.memorialId];
    }

    const memorials = await getOwnerFamilyMemorials(admin, context.ownerUserId);
    return memorials.length > 0
        ? memorials.map((memorial) => memorial.id)
        : [context.memorialId];
}

async function broadcastRoleChange(
    admin: SupabaseClient,
    memorialIds: string[],
    affectedUserId: string,
    newRole: WitnessRole | null
) {
    const uniqueMemorialIds = Array.from(new Set(memorialIds.filter(Boolean)));

    await Promise.all(
        uniqueMemorialIds.map(async (memorialId) => {
            const channel = admin.channel(`role-change:${memorialId}:${affectedUserId}`);

            try {
                await channel.send({
                    type: 'broadcast',
                    event: 'role_changed',
                    payload: {
                        memorialId,
                        affectedUserId,
                        newRole,
                        reason: 'owner_action',
                    },
                });
            } finally {
                await admin.removeChannel(channel).catch(() => undefined);
            }
        })
    );
}

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
                summary: `Role changed from ${result.oldRole} to ${result.newRole}.`,
                actorUserId: user.id,
                actorEmail: user.email ?? null,
                subjectUserId: targetUserId,
                details: {
                    oldRole: result.oldRole,
                    newRole: result.newRole,
                },
            });

            try {
                const affectedMemorialIds = await getAffectedMemorialIds(
                    admin,
                    context,
                    [result.oldRole, result.newRole]
                );

                await broadcastRoleChange(
                    admin,
                    affectedMemorialIds,
                    targetUserId,
                    result.newRole
                );
            } catch (broadcastError) {
                console.error('Role change broadcast error:', broadcastError);
            }
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
            message === 'Invalid role'
                ? 400
                : message.includes('owner') || message.includes('remove yourself')
                    ? 400
                    : message.includes('Family plan') || message.includes('Personal archives')
                        ? 403
                        : message === 'Member not found'
                            ? 404
                            : 500;

        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string, targetUserId: string }> }
) {
    try {
        const { memorialId, targetUserId } = await params;
        const access = await requireMemorialAccess({
            memorialId,
            action: 'manage_members',
        });
        if (!access.ok) return access.response;

        const { user, admin, context } = access;
        const result = await removeArchiveMemberAccess(admin, context, {
            targetUserId,
        });

        await safeLogMemorialActivity(admin, {
            memorialId,
            action: 'member_removed',
            summary: 'Archive access was revoked for a member.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: targetUserId,
            details: {
                removedRole: result.removedRole,
            },
        });

        try {
            const affectedMemorialIds = await getAffectedMemorialIds(
                admin,
                context,
                [result.removedRole, null]
            );

            await broadcastRoleChange(
                admin,
                affectedMemorialIds,
                targetUserId,
                null
            );
        } catch (broadcastError) {
            console.error('Role removal broadcast error:', broadcastError);
        }

        return NextResponse.json({ success: true, removedRole: result.removedRole });
    } catch (error: any) {
        const message = error.message || 'Internal server error';
        const status =
            message.includes('owner') || message.includes('remove yourself')
                ? 400
                : message === 'Member not found'
                    ? 404
                    : 500;

        return NextResponse.json({ error: message }, { status });
    }
}

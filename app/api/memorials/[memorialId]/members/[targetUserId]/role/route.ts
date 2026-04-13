// app/api/memorials/[memorialId]/members/[targetUserId]/role/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import {
    syncCoGuardianAcrossOwnerFamily,
    updateFamilyCoGuardianRole,
} from '@/lib/familyWorkspace';
import { safeLogMemorialActivity } from '@/lib/activityLog';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string, targetUserId: string }> }
) {
    try {
        const { memorialId, targetUserId } = await params;
        const { newRole } = await req.json();

        const VALID_ROLES = ['co_guardian', 'witness', 'reader'];
        if (!VALID_ROLES.includes(newRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // 1. AUTH + AUTHORIZATION (centralized)
        const access = await requireMemorialAccess({
            memorialId,
            action: 'manage_members',
        });
        if (!access.ok) return access.response;

        const { user, admin, context } = access;

        // 2. Prevent changing own role or owner role
        if (targetUserId === user.id || targetUserId === context.ownerUserId) {
            return NextResponse.json({ error: 'Cannot change the owner role' }, { status: 400 });
        }

        if (newRole === 'co_guardian' && context.plan !== 'family') {
            return NextResponse.json({ error: 'Co-Guardian is a Family plan role only' }, { status: 403 });
        }

        const { data: currentRoleRow } = await admin
            .from('user_memorial_roles')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', targetUserId)
            .maybeSingle();

        const isFamilyMemorial = context.plan === 'family';
        const isFamilyWideCoGuardianChange =
            isFamilyMemorial
            && (newRole === 'co_guardian' || currentRoleRow?.role === 'co_guardian');

        if (isFamilyWideCoGuardianChange) {
            if (newRole === 'co_guardian') {
                await syncCoGuardianAcrossOwnerFamily(admin, context.ownerUserId, targetUserId);
            } else {
                await updateFamilyCoGuardianRole(
                    admin,
                    context.ownerUserId,
                    targetUserId,
                    newRole as 'witness' | 'reader'
                );
            }
        } else {
            const { error } = await admin
                .from('user_memorial_roles')
                .update({ role: newRole })
                .eq('memorial_id', memorialId)
                .eq('user_id', targetUserId);

            if (error) throw error;
        }

        await safeLogMemorialActivity(admin, {
            memorialId,
            action: 'member_role_updated',
            summary: `A member role was changed to ${newRole}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: targetUserId,
            details: {
                newRole,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

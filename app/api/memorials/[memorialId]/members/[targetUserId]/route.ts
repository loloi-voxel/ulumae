// app/api/memorials/[memorialId]/members/[targetUserId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { removeFamilyCoGuardianAccess, syncCoGuardianAcrossOwnerFamily } from '@/lib/familyWorkspace';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { safeLogMemorialActivity } from '@/lib/activityLog';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { WitnessRole } from '@/types/roles';

const ASSIGNABLE_ROLES: WitnessRole[] = ['co_guardian', 'witness', 'reader'];

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string, targetUserId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId, targetUserId } = await params;
        const { user } = await createAuthenticatedClient();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { newRole } = await req.json();

        if (!newRole || !ASSIGNABLE_ROLES.includes(newRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'manage_members')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (targetUserId === user.id) {
            return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
        }

        // Fetch current role to detect co_guardian transitions
        const { data: currentRoleRow } = await supabaseAdmin
            .from('user_memorial_roles')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', targetUserId)
            .maybeSingle();

        if (!currentRoleRow) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        const oldRole = currentRoleRow.role as WitnessRole;

        if (oldRole === 'owner') {
            return NextResponse.json({ error: 'Cannot change the owner role' }, { status: 400 });
        }

        if (oldRole === newRole) {
            return NextResponse.json({ success: true });
        }

        const { data: memorial } = await supabaseAdmin
            .from('memorials')
            .select('user_id, mode')
            .eq('id', memorialId)
            .single();

        const isFamily = memorial?.mode === 'family';

        if (newRole === 'co_guardian' && !isFamily) {
            return NextResponse.json({ error: 'Co-Guardian is a Family plan role only' }, { status: 400 });
        }

        // Handle co_guardian transitions on family plans
        if (isFamily && memorial?.user_id) {
            if (oldRole === 'co_guardian' && newRole !== 'co_guardian') {
                // Demoting from co_guardian — remove cross-family access
                await removeFamilyCoGuardianAccess(supabaseAdmin, memorial.user_id, targetUserId);
                // Re-insert with the new role on this memorial only
                await supabaseAdmin
                    .from('user_memorial_roles')
                    .upsert({
                        user_id: targetUserId,
                        memorial_id: memorialId,
                        role: newRole,
                        joined_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,memorial_id' });
            } else if (oldRole !== 'co_guardian' && newRole === 'co_guardian') {
                // Promoting to co_guardian — sync across family
                await supabaseAdmin
                    .from('user_memorial_roles')
                    .update({ role: newRole })
                    .eq('memorial_id', memorialId)
                    .eq('user_id', targetUserId);
                await syncCoGuardianAcrossOwnerFamily(supabaseAdmin, memorial.user_id, targetUserId);
            } else {
                // Simple role change (e.g. witness → reader)
                await supabaseAdmin
                    .from('user_memorial_roles')
                    .update({ role: newRole })
                    .eq('memorial_id', memorialId)
                    .eq('user_id', targetUserId);
            }
        } else {
            await supabaseAdmin
                .from('user_memorial_roles')
                .update({ role: newRole })
                .eq('memorial_id', memorialId)
                .eq('user_id', targetUserId);
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'member_role_updated',
            summary: `Role changed from ${oldRole} to ${newRole}.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: targetUserId,
            details: { oldRole, newRole },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string, targetUserId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId, targetUserId } = await params;
        const { user } = await createAuthenticatedClient();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json({ error: 'Memorial not found' }, { status: 404 });
        }

        if (!hasPermission(permission.context, 'manage_members')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Prevent removing self (The owner must exist)
        if (targetUserId === user.id) {
            return NextResponse.json({ error: 'You cannot remove yourself as owner' }, { status: 400 });
        }

        const { data: memorialWithMode } = await supabaseAdmin
            .from('memorials')
            .select('user_id, mode')
            .eq('id', memorialId)
            .single();

        const { data: targetRole } = await supabaseAdmin
            .from('user_memorial_roles')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', targetUserId)
            .maybeSingle();

        const shouldRemoveAcrossFamily =
            memorialWithMode?.mode === 'family'
            && targetRole?.role === 'co_guardian';

        if (shouldRemoveAcrossFamily) {
            await removeFamilyCoGuardianAccess(supabaseAdmin, memorialWithMode.user_id, targetUserId);
        } else {
            const { error } = await supabaseAdmin
                .from('user_memorial_roles')
                .delete()
                .eq('memorial_id', memorialId)
                .eq('user_id', targetUserId);

            if (error) throw error;
        }

        await safeLogMemorialActivity(supabaseAdmin, {
            memorialId,
            action: 'member_removed',
            summary: 'Archive access was revoked for a member.',
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: targetUserId,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

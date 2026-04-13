import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import { syncCoGuardianAcrossOwnerFamily } from '@/lib/familyWorkspace';
import { safeLogMemorialActivity } from '@/lib/activityLog';

export async function POST(req: NextRequest, { params }: { params: Promise<{ memorialId: string }> }) {
    try {
        const { memorialId } = await params;
        const { witnessUserId } = await req.json();

        if (!witnessUserId || typeof witnessUserId !== 'string') {
            return NextResponse.json({ error: 'Missing witnessUserId' }, { status: 400 });
        }

        // AUTH: Use centralized permission layer — require manage_members permission
        const access = await requireMemorialAccess({
            memorialId,
            action: 'manage_members',
        });
        if (!access.ok) return access.response;

        const { user, admin, context } = access;

        // Only family plans support co-guardian promotion
        if (context.plan !== 'family') {
            return NextResponse.json({ error: 'Co-guardian promotion is only available for Family plan archives' }, { status: 403 });
        }

        // Cannot promote yourself
        if (witnessUserId === user.id) {
            return NextResponse.json({ error: 'Cannot promote yourself' }, { status: 400 });
        }

        // Verify the target user is actually a member of this memorial
        const { data: targetRole, error: roleError } = await admin
            .from('user_memorial_roles')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', witnessUserId)
            .maybeSingle();

        if (roleError || !targetRole) {
            return NextResponse.json({ error: 'User is not a member of this memorial' }, { status: 404 });
        }

        if (targetRole.role === 'co_guardian') {
            return NextResponse.json({ error: 'User is already a co-guardian' }, { status: 400 });
        }

        // Promote to co_guardian across all family memorials
        await syncCoGuardianAcrossOwnerFamily(admin, context.ownerUserId, witnessUserId);

        await safeLogMemorialActivity(admin, {
            memorialId,
            action: 'member_role_updated',
            summary: `Member promoted to co-guardian.`,
            actorUserId: user.id,
            actorEmail: user.email ?? null,
            subjectUserId: witnessUserId,
            details: { previousRole: targetRole.role, newRole: 'co_guardian' },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

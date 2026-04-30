import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import {
    getArchiveCapabilities,
    getRoleLabel,
    hasPermission,
    resolveArchivePermissionContext,
} from '@/lib/archivePermissions';
import { WitnessRole } from '@/types/roles';
import { getSupabaseAdmin } from '@/lib/apiAuth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ memorialId: string }> }
) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { memorialId } = await params;

        // 1. Authenticate
        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const permission = await resolveArchivePermissionContext(
            supabaseAdmin,
            memorialId,
            user.id
        );

        if (!permission.memorialExists || !permission.context) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        if (!hasPermission(permission.context, 'view_archive')) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        const { data: memorial, error: memorialError } = await supabaseAdmin
            .from('memorials')
            .select(`
            id,
            full_name,
            birth_date,
            death_date,
            profile_photo_url,
            mode,
            step6,
            step7,
            step8,
            step9
          `)
            .eq('id', memorialId)
            .single();

        if (memorialError || !memorial) {
            return NextResponse.json(
                { error: 'Archive not found' },
                { status: 404 }
            );
        }

        const userRole = permission.context.role as WitnessRole;
        const plan = permission.context.plan;
        const capabilities = getArchiveCapabilities(userRole, plan);

        // 4. Compute content richness
        // (determines which empty-state copy we show)
        const hasBiography =
            (memorial.step6?.biography || '').length > 100;
        const photoCount =
            (memorial.step8?.gallery || []).length +
            (memorial.step8?.interactiveGallery || []).length;
        const memoryCount =
            (memorial.step7?.sharedMemories || []).length +
            (memorial.step7?.impactStories || []).length;
        const videoCount =
            (memorial.step9?.videos || []).length;

        const contentScore =
            (hasBiography ? 2 : 0) +
            photoCount +
            memoryCount +
            videoCount;

        const archiveRichness: 'empty' | 'partial' | 'rich' =
            contentScore === 0
                ? 'empty'
                : contentScore < 5
                    ? 'partial'
                    : 'rich';

        // 5. Update last_visited_at
        await supabaseAdmin
            .from('user_memorial_roles')
            .update({
                last_visited_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('memorial_id', memorialId);

        return NextResponse.json({
            memorial: {
                id: memorial.id,
                fullName: memorial.full_name,
                birthDate: memorial.birth_date,
                deathDate: memorial.death_date,
                profilePhotoUrl: memorial.profile_photo_url
            },
            userRole,
            roleLabel: getRoleLabel(userRole),
            plan,
            capabilities,
            archiveRichness,
            stats: {
                photoCount,
                memoryCount,
                videoCount,
                hasBiography
            },
            joinedAt: permission.context.isOwner ? null : null
        });

    } catch (err: any) {
        console.error('[welcome-data]', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

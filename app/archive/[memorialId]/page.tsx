import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ArchiveHubClient from './_components/ArchiveHubClient';
import CoGuardianFamilyWorkspace from './_components/CoGuardianFamilyWorkspace';
import { WitnessRole } from '@/types/roles';
import {
    getMemorialCreationRequestCount,
    getOwnerFamilyMemorials,
    getPendingMemorialCreationRequest,
    syncCoGuardianAcrossOwnerFamily,
} from '@/lib/familyWorkspace';
import { createClient } from '@supabase/supabase-js';
import {
    getArchiveCapabilities,
    getArchivePlan,
    getPermissionSignature,
    getRoleLabel,
    resolveArchivePermissionContext,
} from '@/lib/archivePermissions';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function deriveFamilyName(fullName: string | null) {
    if (!fullName) {
        return 'Family';
    }

    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] || 'Family';
}

export default async function ArchivePage({
    params
}: {
    params: Promise<{ memorialId: string }>
}) {
    const { memorialId } = await params;
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                }
            }
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect(`/login?next=/archive/${memorialId}`);
    }

    const { data: memorial, error: memError } = await supabase
        .from('memorials')
        .select('id, full_name, profile_photo_url, mode, user_id, deleted')
        .eq('id', memorialId)
        .single();

    if (memError || !memorial) {
        redirect('/dashboard');
    }

    if (memorial.deleted) {
        redirect('/dashboard');
    }

    const permission = await resolveArchivePermissionContext(
        supabaseAdmin,
        memorialId,
        user.id
    );

    if (!permission.context) {
        redirect('/dashboard');
    }

    const userRole = permission.context.role;

    if (userRole === 'co_guardian' && memorial.mode === 'family') {
        await syncCoGuardianAcrossOwnerFamily(
            supabaseAdmin,
            memorial.user_id,
            user.id
        );

        const familyMemorials = await getOwnerFamilyMemorials(
            supabaseAdmin,
            memorial.user_id
        );
        const pendingCreationRequest = await getPendingMemorialCreationRequest(
            supabaseAdmin,
            memorial.user_id,
            user.id
        );

        const memorialsWithCounts = await Promise.all(
            familyMemorials.map(async (familyMemorial) => {
                const { count } = await supabaseAdmin
                    .from('memorial_contributions')
                    .select('*', { count: 'exact', head: true })
                    .eq('memorial_id', familyMemorial.id)
                    .eq('status', 'pending_approval');

                return {
                    id: familyMemorial.id,
                    fullName: familyMemorial.full_name,
                    birthDate: familyMemorial.birth_date,
                    deathDate: familyMemorial.death_date,
                    profilePhotoUrl: familyMemorial.profile_photo_url,
                    status: familyMemorial.status,
                    pendingCount: count || 0,
                };
            })
        );

        return (
            <CoGuardianFamilyWorkspace
                memorialId={memorialId}
                familyName={deriveFamilyName(memorial.full_name)}
                memorials={memorialsWithCounts}
                pendingCreationRequest={pendingCreationRequest ? {
                    id: pendingCreationRequest.id,
                    proposedName: pendingCreationRequest.proposed_name,
                    requestMessage: pendingCreationRequest.request_message,
                    createdAt: pendingCreationRequest.created_at,
                } : null}
            />
        );
    }

    let pendingContributionCount = 0;
    let pendingAccessRequestCount = 0;
    if (userRole === 'owner' || userRole === 'co_guardian') {
      const { count } = await supabase
            .from('memorial_contributions')
            .select('*', { count: 'exact', head: true })
            .eq('memorial_id', memorialId)
            .eq('status', 'pending_approval');
        pendingContributionCount = count || 0;

        const { count: accessCount } = await supabase
            .from('memorial_access_requests')
            .select('*', { count: 'exact', head: true })
            .eq('memorial_id', memorialId)
            .eq('status', 'pending');
        pendingAccessRequestCount = accessCount || 0;
    }

    let pendingCreationRequestCount = 0;
    if (userRole === 'owner' && memorial.mode === 'family') {
        pendingCreationRequestCount = await getMemorialCreationRequestCount(
            supabaseAdmin,
            memorial.user_id
        );
    }

    const { data: myContributions } = await supabase
        .from('memorial_contributions')
        .select('id, type, status, content, created_at, admin_notes, revision_count')
        .eq('memorial_id', memorialId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const resolvedRole = userRole as WitnessRole;
    const plan = getArchivePlan(memorial.mode);
    const permissionContext = {
        memorialId,
        userId: user.id,
        ownerUserId: memorial.user_id,
        plan,
        role: resolvedRole,
        isOwner: resolvedRole === 'owner',
    } as const;

    const roleData = {
        currentUserId: user.id,
        userRole: resolvedRole,
        plan,
        roleLabel: getRoleLabel(resolvedRole),
        permissionSignature: getPermissionSignature(permissionContext),
        capabilities: getArchiveCapabilities(resolvedRole, plan),
        memorial: {
            id: memorial.id,
            fullName: memorial.full_name,
            birthDate: null,
            deathDate: null,
            profilePhotoUrl: memorial.profile_photo_url,
            userId: memorial.user_id,
        },
        pendingCount:
            pendingContributionCount +
            pendingAccessRequestCount +
            pendingCreationRequestCount,
        pendingContributionCount,
        pendingAccessRequestCount,
        pendingCreationRequestCount,
        myContributions: (myContributions || []).map(c => ({
            id: c.id,
            type: c.type,
            status: c.status,
            title: c.content?.title || 'Untitled',
            createdAt: c.created_at,
            adminNotes: c.admin_notes || null,
            revisionCount: c.revision_count || 0,
        })),
        resolvedAt: new Date().toISOString(),
    };

    return (
        <ArchiveHubClient
            roleData={roleData}
            memorialId={memorialId}
            userId={user.id}
        />
    );
}

import { NextRequest, NextResponse } from 'next/server';
import { requireMemorialAccess } from '@/lib/apiAuth';
import {
  getArchiveCapabilities,
  getRoleLabel,
} from '@/lib/archivePermissions';
import { WitnessRole } from '@/types/roles';
import { getMemorialCreationRequestCount } from '@/lib/familyWorkspace';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ memorialId: string }> }
) {
  try {
    const { memorialId } = await params;

    // Use centralized permission layer
    const access = await requireMemorialAccess({
      memorialId,
      action: 'view_archive', // Check user can view
    });
    if (!access.ok) return access.response;

    const { user, admin, context } = access;

    const { data: memorial, error: memorialError } = await admin
      .from('memorials')
      .select(
        'id, full_name, birth_date, death_date, profile_photo_url, mode, user_id'
      )
      .eq('id', memorialId)
      .single();

    if (memorialError || !memorial) {
      return NextResponse.json(
        { error: 'Archive not found' },
        { status: 404 }
      );
    }

    const userRole = context.role as WitnessRole;
    const plan = context.plan;
    const capabilities = getArchiveCapabilities(userRole, plan);

    let pendingContributionCount = 0;
    let pendingAccessRequestCount = 0;
    let pendingCreationRequestCount = 0;
    if (capabilities.canReview) {
      const { count } = await admin
        .from('memorial_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_id', memorialId)
        .eq('status', 'pending_approval');
      pendingContributionCount = count || 0;
    }

    if (capabilities.canApproveAccessRequests) {
      const { count } = await admin
        .from('memorial_access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_id', memorialId)
        .eq('status', 'pending');
      pendingAccessRequestCount = count || 0;
    }

    if (userRole === 'owner' && plan === 'family') {
      pendingCreationRequestCount = await getMemorialCreationRequestCount(
        admin,
        context.ownerUserId
      );
    }

    // Fetch my contributions only for non-readers
    let myContributions: any[] = [];
    if (capabilities.canContribute) {
      const { data: contributions } = await admin
        .from('memorial_contributions')
        .select('id, type, status, content, created_at, admin_notes, revision_count')
        .eq('memorial_id', memorialId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      myContributions = (contributions || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        title: c.content?.title || 'Untitled',
        createdAt: c.created_at,
        adminNotes: c.admin_notes || null,
        revisionCount: c.revision_count || 0,
      }));
    }

    // Update last_visited_at
    await admin
      .from('user_memorial_roles')
      .update({
        last_visited_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('memorial_id', memorialId)
      .maybeSingle();

    return NextResponse.json({
      currentUserId: user.id,
      userRole,
      roleLabel: getRoleLabel(userRole),
      plan,
      capabilities,
      memorial: {
        id: memorial.id,
        fullName: memorial.full_name,
        birthDate: memorial.birth_date,
        deathDate: memorial.death_date,
        profilePhotoUrl: memorial.profile_photo_url,
        userId: memorial.user_id,
      },
      myContributions,
      pendingCount:
        pendingContributionCount +
        pendingAccessRequestCount +
        pendingCreationRequestCount,
      pendingContributionCount,
      pendingAccessRequestCount,
      pendingCreationRequestCount,
    });
  } catch (err: any) {
    console.error('[role-data]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

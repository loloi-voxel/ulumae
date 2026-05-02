import { NextRequest, NextResponse } from 'next/server';

import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { getMemorialRenderData } from '@/lib/memorialRenderData';
import { createAuthenticatedClient } from '@/utils/supabase/api';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memorialId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { memorialId } = await params;
    const { user } = await createAuthenticatedClient();

    const permission = user
      ? await resolveArchivePermissionContext(supabaseAdmin, memorialId, user.id)
      : { memorialExists: false, context: null };

    const renderData = await getMemorialRenderData(supabaseAdmin, memorialId);
    const { memorial, memorialData, relations } = renderData;

    const canViewViaRole =
      !!permission.context && hasPermission(permission.context, 'view_archive');
    const isOwner = !!user && user.id === memorial.user_id;
    const isPaidMode = memorial.mode === 'personal' || memorial.mode === 'family';
    const isPubliclyReadable = !!memorial.paid || isPaidMode;

    if (!canViewViaRole && !isOwner && !isPubliclyReadable) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      memorialData,
      relations,
    });
  } catch (error: any) {
    console.error('[render-data]', error);
    const message = error.message || 'Internal server error';
    const status = message === 'Archive not found' ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

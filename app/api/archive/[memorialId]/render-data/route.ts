import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/utils/supabase/api';
import { hasPermission, resolveArchivePermissionContext } from '@/lib/archivePermissions';
import { getSupabaseAdmin } from '@/lib/apiAuth';
import { normalizeMemorialMediaData } from '@/lib/mediaManager';
import type { MemorialData } from '@/types/memorial';

function buildMemorialData(record: any): MemorialData {
  return {
    step1: record.step1 || {},
    step2: record.step2 || {},
    step3: record.step3 || {},
    step4: record.step4 || {},
    step5: record.step5 || {},
    step6: record.step6 || {},
    step7: record.step7 || {},
    step8: record.step8 || {},
    step9: record.step9 || { videos: [] },
    currentStep: 1,
    paid: record.paid ?? false,
    lastSaved: record.updated_at || null,
    completedSteps: record.completed_steps || [],
  } as MemorialData;
}

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
    const { data: memorial, error: memorialError } = await supabaseAdmin
      .from('memorials')
      .select('*')
      .eq('id', memorialId)
      .single();

    if (memorialError || !memorial) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
    }

    const canViewViaRole = !!permission.context && hasPermission(permission.context, 'view_archive');
    const isOwner = !!user && user.id === memorial.user_id;
    const isPaidMode = memorial.mode === 'personal' || memorial.mode === 'family';
    const isPubliclyReadable = !!memorial.paid || isPaidMode;

    if (!canViewViaRole && !isOwner && !isPubliclyReadable) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [normalizedData, { data: approvedContributions }, { data: relations }] = await Promise.all([
      normalizeMemorialMediaData({
        admin: supabaseAdmin,
        memorialId,
        userId: memorial.user_id,
        data: buildMemorialData(memorial),
        preferAssetMetadata: true,
      }),
      supabaseAdmin
        .from('memorial_contributions')
        .select('id, type, content, witness_name, created_at')
        .eq('memorial_id', memorialId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
      memorial.mode === 'family'
        ? supabaseAdmin
            .from('memorial_relations')
            .select('id, from_memorial_id, to_memorial_id, relationship_type, memorials!memorial_relations_to_memorial_id_fkey(id, full_name)')
            .eq('from_memorial_id', memorialId)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const memoryContributions = (approvedContributions || [])
      .filter((contribution) => contribution.type === 'memory')
      .map((contribution: any) => ({
        id: contribution.id,
        title: contribution.content?.title || 'Shared memory',
        date: contribution.created_at,
        content: contribution.content?.content || '',
        author: contribution.witness_name || 'Contributor',
        relationship: contribution.content?.relationship || '',
      }));

    const photoContributions = (approvedContributions || [])
      .filter(
        (contribution) =>
          contribution.type === 'photo' &&
          contribution.content?.url &&
          contribution.content?.mediaVariant !== 'interactive_story'
      )
      .map((contribution: any) => ({
        id: contribution.id,
        preview: contribution.content.url,
        caption: contribution.content?.caption || '',
        year: contribution.content?.year || '',
        type: 'photo',
        sha256_hash: contribution.content?.sha256_hash || null,
      }));

    const interactivePhotoContributions = (approvedContributions || [])
      .filter(
        (contribution) =>
          contribution.type === 'photo' &&
          contribution.content?.url &&
          contribution.content?.mediaVariant === 'interactive_story'
      )
      .map((contribution: any) => ({
        id: contribution.id,
        preview: contribution.content.url,
        title: contribution.content?.title || '',
        description: contribution.content?.description || '',
        year: contribution.content?.year || '',
        sha256_hash: contribution.content?.sha256_hash || null,
      }));

    const videoContributions = (approvedContributions || [])
      .filter((contribution) => contribution.type === 'video' && contribution.content?.url)
      .map((contribution: any) => ({
        id: contribution.id,
        url: contribution.content.url,
        thumbnail: contribution.content?.thumbnail || '',
        title: contribution.content?.title || '',
        description: contribution.content?.description || '',
        mimeType: contribution.content?.mimeType || null,
        sha256_hash: contribution.content?.sha256_hash || null,
      }));

    const memorialData = {
      ...normalizedData,
      step7: {
        ...(normalizedData.step7 || {}),
        sharedMemories: [...(normalizedData.step7?.sharedMemories || []), ...memoryContributions],
      },
      step8: {
        ...(normalizedData.step8 || {}),
        gallery: [...(normalizedData.step8?.gallery || []), ...photoContributions],
        interactiveGallery: [
          ...(normalizedData.step8?.interactiveGallery || []),
          ...interactivePhotoContributions,
        ],
      },
      step9: {
        ...(normalizedData.step9 || { videos: [] }),
        videos: [...(normalizedData.step9?.videos || []), ...videoContributions],
      },
    };

    const normalizedRelations = (relations || []).map((relation: any) => ({
      id: relation.id,
      from_memorial_id: relation.from_memorial_id,
      to_memorial_id: relation.to_memorial_id,
      relationship_type: relation.relationship_type,
      target_name: relation.memorials?.full_name || '',
    }));

    return NextResponse.json({
      memorialData,
      relations: normalizedRelations,
    });
  } catch (err: any) {
    console.error('[render-data]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getMemorialMediaAssetsByIds,
  normalizeMemorialMediaData,
} from '@/lib/mediaManager';
import type {
  MemorialData,
  MemorialRelation,
} from '@/types/memorial';
import type { StoredMediaAsset } from '@/types/media';

type MemorialRow = {
  id: string;
  user_id: string;
  updated_at: string;
  paid: boolean;
  mode: string | null;
  full_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  profile_photo_url: string | null;
  completed_steps: number[] | null;
  step1: Record<string, unknown> | null;
  step2: Record<string, unknown> | null;
  step3: Record<string, unknown> | null;
  step4: Record<string, unknown> | null;
  step5: Record<string, unknown> | null;
  step6: Record<string, unknown> | null;
  step7: Record<string, unknown> | null;
  step8: Record<string, unknown> | null;
  step9: Record<string, unknown> | null;
};

export interface MemorialRenderDataResult {
  memorial: MemorialRow;
  memorialData: MemorialData;
  relations: MemorialRelation[];
}

function buildMemorialData(record: MemorialRow): MemorialData {
  return {
    step1: ((record.step1 || {}) as unknown) as MemorialData['step1'],
    step2: ((record.step2 || {}) as unknown) as MemorialData['step2'],
    step3: ((record.step3 || {}) as unknown) as MemorialData['step3'],
    step4: ((record.step4 || {}) as unknown) as MemorialData['step4'],
    step5: ((record.step5 || {}) as unknown) as MemorialData['step5'],
    step6: ((record.step6 || {}) as unknown) as MemorialData['step6'],
    step7: ((record.step7 || {}) as unknown) as MemorialData['step7'],
    step8: ((record.step8 || {}) as unknown) as MemorialData['step8'],
    step9: (((record.step9 as unknown) as MemorialData['step9']) || { videos: [] }) as MemorialData['step9'],
    currentStep: 1,
    paid: record.paid ?? false,
    lastSaved: record.updated_at || null,
    completedSteps: record.completed_steps || [],
  };
}

function collectContributionAssetIds(
  contributions: Array<{ content: Record<string, unknown> | null }>
) {
  const ids = new Set<string>();

  for (const contribution of contributions) {
    const content = contribution.content || {};
    const assetId = typeof content.assetId === 'string' ? content.assetId : null;
    const thumbnailAssetId =
      typeof content.thumbnailAssetId === 'string' ? content.thumbnailAssetId : null;

    if (assetId) ids.add(assetId);
    if (thumbnailAssetId) ids.add(thumbnailAssetId);
  }

  return [...ids];
}

function getContributionAssetMap(assets: StoredMediaAsset[]) {
  return new Map<string, StoredMediaAsset>(assets.map((asset) => [asset.id, asset]));
}

function toReferenceFields(asset: StoredMediaAsset | null) {
  if (!asset) {
    return {
      assetId: null,
      bucket: null,
      storagePath: null,
      originalFileName: null,
      mimeType: null,
      fileSize: null,
      uploadedAt: null,
      uploadStatus: 'idle' as const,
      uploadError: null,
    };
  }

  return {
    assetId: asset.id,
    bucket: asset.bucket,
    storagePath: asset.storagePath,
    originalFileName: asset.originalFileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    uploadedAt: asset.createdAt,
    uploadStatus: 'ready' as const,
    uploadError: null,
  };
}

export async function getMemorialRenderData(
  admin: SupabaseClient,
  memorialId: string
): Promise<MemorialRenderDataResult> {
  const { data: memorial, error: memorialError } = await admin
    .from('memorials')
    .select(
      'id, user_id, updated_at, paid, mode, full_name, birth_date, death_date, profile_photo_url, completed_steps, step1, step2, step3, step4, step5, step6, step7, step8, step9'
    )
    .eq('id', memorialId)
    .single();

  if (memorialError || !memorial) {
    throw new Error('Archive not found');
  }

  const memorialRecord = memorial as MemorialRow;

  const [normalizedData, approvedContributionsResult, relationsResult] = await Promise.all([
    normalizeMemorialMediaData({
      admin,
      memorialId,
      userId: memorialRecord.user_id,
      data: buildMemorialData(memorialRecord),
      preferAssetMetadata: true,
    }),
    admin
      .from('memorial_contributions')
      .select('id, type, content, witness_name, created_at')
      .eq('memorial_id', memorialId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
    memorialRecord.mode === 'family'
      ? admin
          .from('memorial_relations')
          .select(
            'id, from_memorial_id, to_memorial_id, relationship_type, memorials!memorial_relations_to_memorial_id_fkey(id, full_name)'
          )
          .eq('from_memorial_id', memorialId)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (approvedContributionsResult.error) {
    throw new Error(
      approvedContributionsResult.error.message || 'Could not load approved contributions.'
    );
  }

  if (relationsResult.error) {
    throw new Error(relationsResult.error.message || 'Could not load memorial relations.');
  }

  const approvedContributions = approvedContributionsResult.data || [];
  const contributionAssetIds = collectContributionAssetIds(approvedContributions);
  const contributionAssets =
    contributionAssetIds.length > 0
      ? await getMemorialMediaAssetsByIds(admin, memorialId, contributionAssetIds)
      : [];
  const contributionAssetMap = getContributionAssetMap(contributionAssets);

  const memoryContributions = approvedContributions
    .filter((contribution) => contribution.type === 'memory')
    .map((contribution: any) => ({
      id: contribution.id,
      title: contribution.content?.title || 'Shared memory',
      date: contribution.created_at,
      content: contribution.content?.content || '',
      author: contribution.witness_name || 'Contributor',
      relationship: contribution.content?.relationship || '',
    }));

  const photoContributions = approvedContributions
    .filter(
      (contribution) =>
        contribution.type === 'photo' &&
        contribution.content?.url &&
        contribution.content?.mediaVariant !== 'interactive_story'
    )
    .map((contribution: any) => {
      const assetId =
        typeof contribution.content?.assetId === 'string'
          ? contribution.content.assetId
          : null;
      const asset = assetId ? contributionAssetMap.get(assetId) || null : null;

      return {
        id: contribution.id,
        preview: asset?.publicUrl || contribution.content.url,
        caption: contribution.content?.caption || '',
        year: contribution.content?.year || '',
        type: 'photo' as const,
        sha256_hash: asset?.sha256Hash || contribution.content?.sha256_hash || null,
        ...toReferenceFields(asset),
      };
    });

  const interactivePhotoContributions = approvedContributions
    .filter(
      (contribution) =>
        contribution.type === 'photo' &&
        contribution.content?.url &&
        contribution.content?.mediaVariant === 'interactive_story'
    )
    .map((contribution: any) => {
      const assetId =
        typeof contribution.content?.assetId === 'string'
          ? contribution.content.assetId
          : null;
      const asset = assetId ? contributionAssetMap.get(assetId) || null : null;

      return {
        id: contribution.id,
        preview: asset?.publicUrl || contribution.content.url,
        description: contribution.content?.description || '',
        sha256_hash: asset?.sha256Hash || contribution.content?.sha256_hash || null,
        ...toReferenceFields(asset),
      };
    });

  const videoContributions = approvedContributions
    .filter((contribution) => contribution.type === 'video' && contribution.content?.url)
    .map((contribution: any) => {
      const assetId =
        typeof contribution.content?.assetId === 'string'
          ? contribution.content.assetId
          : null;
      const thumbnailAssetId =
        typeof contribution.content?.thumbnailAssetId === 'string'
          ? contribution.content.thumbnailAssetId
          : null;
      const asset = assetId ? contributionAssetMap.get(assetId) || null : null;
      const thumbnailAsset = thumbnailAssetId
        ? contributionAssetMap.get(thumbnailAssetId) || null
        : null;

      return {
        id: contribution.id,
        url: asset?.publicUrl || contribution.content.url,
        thumbnail:
          thumbnailAsset?.publicUrl || contribution.content?.thumbnail || asset?.publicUrl || '',
        title: contribution.content?.title || '',
        description: contribution.content?.description || '',
        sha256_hash: asset?.sha256Hash || contribution.content?.sha256_hash || null,
        duration: contribution.content?.duration || '',
        ...toReferenceFields(asset),
        thumbnailAssetId: thumbnailAsset?.id || null,
        thumbnailBucket: thumbnailAsset?.bucket || null,
        thumbnailStoragePath: thumbnailAsset?.storagePath || null,
        thumbnailMimeType: thumbnailAsset?.mimeType || null,
        thumbnailFileSize: thumbnailAsset?.fileSize || null,
        thumbnailUploadedAt: thumbnailAsset?.createdAt || null,
      };
    });

  const memorialData: MemorialData = {
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

  const relations = (relationsResult.data || []).map((relation: any) => ({
    id: relation.id,
    from_memorial_id: relation.from_memorial_id,
    to_memorial_id: relation.to_memorial_id,
    relationship_type: relation.relationship_type,
    target_name: relation.memorials?.full_name || '',
  })) as MemorialRelation[];

  return {
    memorial: memorialRecord,
    memorialData,
    relations,
  };
}

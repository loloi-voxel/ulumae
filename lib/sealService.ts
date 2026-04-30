import type { SupabaseClient, User } from '@supabase/supabase-js';

import { safeLogMemorialActivity } from '@/lib/activityLog';
import {
  getActiveMemorialMediaAssets,
  getMemorialMediaAssetsByIds,
  normalizeMemorialMediaData,
} from '@/lib/mediaManager';
import {
  checkTransactionStatus,
  getGatewayUrls,
  uploadBufferToArweave,
} from '@/lib/arweave/arweaveService';
import {
  createCertificatePdf,
  type CertificateData,
} from '@/lib/certificate/certificateGenerator';
import { sendEmail } from '@/lib/email/sender';
import { getSealCompletedEmail } from '@/lib/email/templates';
import { downloadR2Object } from '@/lib/r2Storage';
import { encryptSealPayload } from '@/lib/sealCrypto';
import type {
  MemorialData,
  MemorialSealState,
  MemorialSealStatus,
  SealableMemorialAsset,
} from '@/types/memorial';
import {
  isMemorialSealLocked,
  isMemorialSealed,
} from '@/types/memorial';
import type { MediaKind, StoredMediaAsset } from '@/types/media';

export const SEAL_MAX_BYTES = 50 * 1024 * 1024 * 1024;

export const SEAL_PROGRESS_MESSAGES = [
  'This soul will never be forgotten',
  'This archive is becoming permanent',
  'Their story is being written into eternity',
  'A life preserved forever on the blockchain',
];

const SEALABLE_MEDIA_KINDS: MediaKind[] = [
  'profile_photo',
  'cover_photo',
  'gallery_photo',
  'interactive_photo',
  'video',
];

const MEMORIAL_SELECT =
  'id, user_id, full_name, mode, paid, deleted, deleted_at, status, updated_at, payment_confirmed_at, preservation_state, preservation_date, arweave_tx_id, sealed_at, seal_status, seal_job_id, seal_selected_asset_ids, step1, step2, step3, step4, step5, step6, step7, step8, step9, completed_steps';

function buildSealEncryptionTags(
  encryption: Awaited<ReturnType<typeof encryptSealPayload>>,
  originalContentType: string
) {
  return [
    { name: 'X-ULUMAE-Encryption', value: encryption.algorithm },
    { name: 'X-ULUMAE-KDF', value: 'PBKDF2-SHA256' },
    { name: 'X-ULUMAE-KDF-Iterations', value: String(encryption.iterations) },
    { name: 'X-ULUMAE-Key-Length', value: String(encryption.keyLength) },
    { name: 'X-ULUMAE-IV', value: encryption.ivBase64 },
    { name: 'X-ULUMAE-Salt', value: encryption.saltBase64 },
    { name: 'X-ULUMAE-Original-Bytes', value: String(encryption.originalByteLength) },
    { name: 'X-ULUMAE-Original-Content-Type', value: originalContentType },
  ];
}

function buildSealEncryptionMetadata(
  encryption: Awaited<ReturnType<typeof encryptSealPayload>>,
  originalContentType: string
) {
  return {
    algorithm: encryption.algorithm,
    ivBase64: encryption.ivBase64,
    saltBase64: encryption.saltBase64,
    iterations: encryption.iterations,
    keyLength: encryption.keyLength,
    originalByteLength: encryption.originalByteLength,
    encryptedByteLength: encryption.bytes.byteLength,
    originalContentType,
    kdf: 'PBKDF2-SHA256',
  };
}

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

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeSealSelectedAssetIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function getSealStateFromMemorial(memorial: any): MemorialSealState {
  const status = (memorial?.seal_status || null) as MemorialSealStatus;

  return {
    status,
    sealedAt: memorial?.sealed_at || null,
    arweaveTxId: memorial?.arweave_tx_id || null,
    sealJobId: memorial?.seal_job_id || null,
    selectedAssetIds: normalizeSealSelectedAssetIds(memorial?.seal_selected_asset_ids),
    isLocked: isMemorialSealLocked(status),
  };
}

export async function getMemorialSealSnapshot(
  admin: SupabaseClient,
  memorialId: string
) {
  const { data, error } = await admin
    .from('memorials')
    .select(MEMORIAL_SELECT)
    .eq('id', memorialId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Memorial not found.');
  }

  return data;
}

export async function assertMemorialWritable(
  admin: SupabaseClient,
  memorialId: string
) {
  const memorial = await getMemorialSealSnapshot(admin, memorialId);
  const sealState = getSealStateFromMemorial(memorial);

  if (sealState.isLocked) {
    throw new Error(
      sealState.status === 'completed'
        ? 'This memorial has already been sealed and can no longer be modified.'
        : 'This memorial is currently being sealed and cannot be modified.'
    );
  }

  return memorial;
}

function buildAssetReferenceMap(data: MemorialData) {
  const references = new Map<
    string,
    {
      kind: 'photo' | 'video';
      label: string;
      detail: string;
      previewUrl: string;
    }
  >();

  const pushPhoto = (assetId: string | null | undefined, label: string, detail: string, previewUrl?: string | null) => {
    if (!assetId || !previewUrl) return;
    references.set(assetId, {
      kind: 'photo',
      label,
      detail,
      previewUrl,
    });
  };

  const pushVideo = (
    assetId: string | null | undefined,
    label: string,
    detail: string,
    previewUrl?: string | null
  ) => {
    if (!assetId || !previewUrl) return;
    references.set(assetId, {
      kind: 'video',
      label,
      detail,
      previewUrl,
    });
  };

  pushPhoto(
    data.step1.profilePhotoAssetId,
    'Profile photo',
    safeString(data.step1.fullName) || 'Primary portrait',
    data.step1.profilePhotoPreview
  );
  pushPhoto(
    data.step8.coverPhotoAssetId,
    'Cover photo',
    'Memorial cover image',
    data.step8.coverPhotoPreview
  );

  for (const item of data.step2.childhoodPhotos || []) {
    pushPhoto(
      item.assetId,
      item.caption || 'Childhood photo',
      item.year || item.originalFileName || '',
      item.preview
    );
  }

  for (const item of data.step8.gallery || []) {
    pushPhoto(
      item.assetId,
      item.caption || 'Gallery photo',
      item.year || item.originalFileName || '',
      item.preview
    );
  }

  for (const item of data.step8.interactiveGallery || []) {
    pushPhoto(
      item.assetId,
      'Interactive story photo',
      item.description || item.originalFileName || '',
      item.preview
    );
  }

  for (const item of data.step9.videos || []) {
    pushVideo(
      item.assetId,
      item.title || 'Video memory',
      item.duration || item.originalFileName || '',
      item.thumbnail || item.url
    );
  }

  return references;
}

export async function getSealableMemorialAssets(
  admin: SupabaseClient,
  memorialId: string
) {
  const memorial = await getMemorialSealSnapshot(admin, memorialId);
  const normalizedData = await normalizeMemorialMediaData({
    admin,
    memorialId,
    userId: memorial.user_id,
    data: buildMemorialData(memorial),
    preferAssetMetadata: true,
  });

  const references = buildAssetReferenceMap(normalizedData);
  const assets = (await getActiveMemorialMediaAssets(admin, memorialId))
    .filter((asset) => SEALABLE_MEDIA_KINDS.includes(asset.kind))
    .map((asset) => {
      const reference = references.get(asset.id);
      const mediaKind = asset.kind === 'video' ? 'video' : 'photo';

      const sealableAsset: SealableMemorialAsset = {
        id: asset.id,
        kind: mediaKind,
        label:
          reference?.label ||
          (mediaKind === 'video' ? 'Video memory' : 'Photo'),
        detail:
          reference?.detail ||
          asset.originalFileName ||
          asset.mimeType,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        publicUrl: asset.publicUrl,
        previewUrl: reference?.previewUrl || asset.publicUrl,
        bucket: asset.bucket,
        storagePath: asset.storagePath,
        originalFileName: asset.originalFileName,
        uploadedAt: asset.createdAt,
        arweaveUrl: asset.arweaveUrl,
        sealedAt: asset.sealedAt,
      };

      return sealableAsset;
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    memorial,
    memorialData: normalizedData,
    assets,
  };
}

export async function startMemorialSealRequest({
  admin,
  memorialId,
  user,
  selectedAssetIds,
  certificatePassword,
  sendEvent,
}: {
  admin: SupabaseClient;
  memorialId: string;
  user: User;
  selectedAssetIds: string[];
  certificatePassword: string;
  sendEvent: (payload: {
    memorialId: string;
    selectedAssetIds: string[];
    ownerEmail: string | null;
    certificatePassword: string;
  }) => Promise<{ id?: string | null }>;
}) {
  const { memorial, assets } = await getSealableMemorialAssets(admin, memorialId);
  const sealState = getSealStateFromMemorial(memorial);

  if (memorial.user_id !== user.id) {
    throw new Error('Only the memorial owner can seal this memorial.');
  }

  if (memorial.mode !== 'personal') {
    throw new Error('Seal Forever is available only on Personal plans.');
  }

  if (!safeString(memorial.full_name)) {
    throw new Error('Create the memorial before sealing it.');
  }

  if (isMemorialSealed(sealState.status)) {
    throw new Error('This memorial has already been sealed.');
  }

  if (sealState.status === 'pending' || sealState.status === 'in_progress') {
    return {
      memorial,
      sealState,
      assets,
    };
  }

  const validAssetIds = new Set(assets.map((asset) => asset.id));
  const filteredAssetIds = selectedAssetIds.filter((assetId) => validAssetIds.has(assetId));
  const totalBytes = assets
    .filter((asset) => filteredAssetIds.includes(asset.id))
    .reduce((sum, asset) => sum + asset.fileSize, 0);

  if (totalBytes > SEAL_MAX_BYTES) {
    throw new Error('The selected seal bundle exceeds the 50 GB limit.');
  }

  const eventResult = await sendEvent({
    memorialId,
    selectedAssetIds: filteredAssetIds,
    ownerEmail: user.email || null,
    certificatePassword,
  });

  const now = new Date().toISOString();
  const nextSelectedAssetIds = filteredAssetIds;

  const { error: updateError } = await admin
    .from('memorials')
    .update({
      deleted: false,
      deleted_at: null,
      sealed_at: now,
      seal_status: 'pending',
      seal_job_id: eventResult.id || null,
      seal_selected_asset_ids: nextSelectedAssetIds,
      preservation_state: 'preserving',
      updated_at: now,
    })
    .eq('id', memorialId);

  if (updateError) {
    throw new Error(updateError.message || 'Could not start the seal process.');
  }

  await safeLogMemorialActivity(admin, {
    memorialId,
    action: 'memorial_seal_started',
    summary: 'The memorial was locked and its permanent seal was requested.',
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    details: {
      selectedAssetIds: nextSelectedAssetIds,
      selectedAssetCount: nextSelectedAssetIds.length,
      selectedBytes: totalBytes,
    },
  });

  return {
    memorial: {
      ...memorial,
      deleted: false,
      deleted_at: null,
      sealed_at: now,
      seal_status: 'pending',
      seal_job_id: eventResult.id || null,
      seal_selected_asset_ids: nextSelectedAssetIds,
      preservation_state: 'preserving',
    },
    sealState: {
      status: 'pending',
      sealedAt: now,
      arweaveTxId: memorial.arweave_tx_id || null,
      sealJobId: eventResult.id || null,
      selectedAssetIds: nextSelectedAssetIds,
      isLocked: true,
    } satisfies MemorialSealState,
    assets,
  };
}

async function downloadSupabaseAssetBytes(
  admin: SupabaseClient,
  asset: StoredMediaAsset
) {
  const { data, error } = await admin.storage
    .from(asset.bucket)
    .download(asset.storagePath);

  if (error || !data) {
    throw new Error(error?.message || `Could not download ${asset.originalFileName || asset.id}.`);
  }

  return Buffer.from(await data.arrayBuffer());
}

async function downloadAssetBytes(
  admin: SupabaseClient,
  asset: StoredMediaAsset
) {
  if (asset.bucket === 'r2') {
    const response = await downloadR2Object({
      key: asset.storagePath,
    });

    return Buffer.from(response.bytes);
  }

  return downloadSupabaseAssetBytes(admin, asset);
}

export async function processMemorialSealRun({
  admin,
  memorialId,
  selectedAssetIds,
  ownerEmail,
  certificatePassword,
  jobId,
}: {
  admin: SupabaseClient;
  memorialId: string;
  selectedAssetIds: string[];
  ownerEmail: string | null;
  certificatePassword: string;
  jobId: string;
}) {
  const now = new Date().toISOString();

  await admin
    .from('memorials')
    .update({
      seal_status: 'in_progress',
      seal_job_id: jobId,
      preservation_state: 'preserving',
      updated_at: now,
    })
    .eq('id', memorialId);

  try {
    const memorial = await getMemorialSealSnapshot(admin, memorialId);
    const selectedIds = selectedAssetIds.length > 0
      ? selectedAssetIds
      : normalizeSealSelectedAssetIds(memorial.seal_selected_asset_ids);
    const loadedAssets = await getMemorialMediaAssetsByIds(admin, memorialId, selectedIds);
    const assetMap = new Map(loadedAssets.map((asset) => [asset.id, asset]));
    const assets = selectedIds
      .map((assetId) => assetMap.get(assetId) || null)
      .filter((asset): asset is StoredMediaAsset => !!asset);

    for (const asset of assets) {
      if (asset.arweaveUrl) {
        continue;
      }

      const bytes = await downloadAssetBytes(admin, asset);
      const encryptedAsset = await encryptSealPayload(bytes, certificatePassword);
      const upload = await uploadBufferToArweave(Buffer.from(encryptedAsset.bytes), {
        contentType: 'application/octet-stream',
        fileName: asset.originalFileName,
        tags: [
          { name: 'App-Name', value: 'ULUMAE' },
          { name: 'Memorial-Id', value: memorialId },
          { name: 'Media-Asset-Id', value: asset.id },
          { name: 'Media-Kind', value: asset.kind },
          ...buildSealEncryptionTags(encryptedAsset, asset.mimeType),
        ],
      });

      const sealedAt = new Date().toISOString();
      const { error: assetUpdateError } = await admin
        .from('memorial_media_assets')
        .update({
          arweave_url: upload.gatewayUrls[0],
          sealed_at: sealedAt,
          metadata: {
            ...(asset.metadata || {}),
            sealEncryption: buildSealEncryptionMetadata(encryptedAsset, asset.mimeType),
          },
          updated_at: sealedAt,
        })
        .eq('id', asset.id);

      if (assetUpdateError) {
        throw new Error(assetUpdateError.message || 'Could not save an uploaded asset seal record.');
      }
    }

    const refreshedMemorial = await getMemorialSealSnapshot(admin, memorialId);
    const normalizedData = await normalizeMemorialMediaData({
      admin,
      memorialId,
      userId: refreshedMemorial.user_id,
      data: buildMemorialData(refreshedMemorial),
      preferAssetMetadata: true,
    });

    const sealedAssets = await getMemorialMediaAssetsByIds(admin, memorialId, selectedIds);

    const memorialPayload = {
      memorialId,
      sealedAt: refreshedMemorial.sealed_at || now,
      generatedAt: new Date().toISOString(),
      selectedAssetIds: selectedIds,
      encryption: {
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2-SHA256',
      },
      sealedAssets: sealedAssets.map((asset) => ({
        assetId: asset.id,
        kind: asset.kind,
        originalFileName: asset.originalFileName,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        arweaveUrl: asset.arweaveUrl,
        sealedAt: asset.sealedAt,
        encryption: asset.metadata?.sealEncryption || null,
      })),
      memorial: normalizedData,
    };

    const memorialJson = Buffer.from(JSON.stringify(memorialPayload, null, 2), 'utf8');
    const encryptedMemorialJson = await encryptSealPayload(memorialJson, certificatePassword);
    const finalUpload = await uploadBufferToArweave(Buffer.from(encryptedMemorialJson.bytes), {
      contentType: 'application/octet-stream',
      fileName: `${memorialId}.json.enc`,
      tags: [
        { name: 'App-Name', value: 'ULUMAE' },
        { name: 'Memorial-Id', value: memorialId },
        { name: 'Seal-Job-Id', value: jobId },
        { name: 'Seal-Type', value: 'memorial-json' },
        ...buildSealEncryptionTags(encryptedMemorialJson, 'application/json'),
      ],
    });

    const completedAt = new Date().toISOString();
    const totalBytes = assets.reduce((sum, asset) => sum + asset.fileSize, 0) + memorialJson.byteLength;

    const { error: txError } = await admin
      .from('arweave_transactions')
      .insert({
        memorial_id: memorialId,
        tx_id: finalUpload.txId,
        status: 'confirmed',
        gateway_urls: finalUpload.gatewayUrls,
        file_count: assets.length + 1,
        total_bytes: totalBytes,
        confirmed_at: completedAt,
      });

    if (txError) {
      throw new Error(txError.message || 'Could not record the final Arweave transaction.');
    }

    const { error: memorialUpdateError } = await admin
      .from('memorials')
      .update({
        deleted: false,
        deleted_at: null,
        status: 'published',
        arweave_tx_id: finalUpload.txId,
        seal_status: 'completed',
        seal_job_id: jobId,
        preservation_state: 'preserved',
        preservation_date: completedAt,
        updated_at: completedAt,
      })
      .eq('id', memorialId);

    if (memorialUpdateError) {
      throw new Error(memorialUpdateError.message || 'Could not finalize the memorial seal.');
    }

    const gatewayUrls = getGatewayUrls(finalUpload.txId);
    const certificateData: CertificateData = {
      fullName: refreshedMemorial.full_name || 'Unknown memorial',
      birthDate: normalizedData.step1.birthDate || '',
      deathDate: normalizedData.step1.deathDate || null,
      preservationDate: completedAt,
      transactionId: finalUpload.txId,
      gatewayUrls,
      gatewayUrl: gatewayUrls[0],
      memorialId,
      planType: refreshedMemorial.mode || 'personal',
      password: certificatePassword,
      warning:
        'This password cannot be recovered. If it is lost, the sealed memorial cannot be decrypted.',
    };

    const certificatePdf = await createCertificatePdf(certificateData);

    await admin
      .from('preservation_certificates')
      .upsert({
        memorial_id: memorialId,
        certificate_data: {
          transactionId: finalUpload.txId,
          gatewayUrls,
          generatedAt: completedAt,
          sealedAt: refreshedMemorial.sealed_at || completedAt,
        },
        pdf_url: null,
        generated_at: completedAt,
      }, {
        onConflict: 'memorial_id',
      });

    if (ownerEmail) {
      await sendEmail({
        to: ownerEmail,
        subject: `ULUMAE | ${refreshedMemorial.full_name || 'A memorial'} has been permanently sealed`,
        html: getSealCompletedEmail({
          memorialName: refreshedMemorial.full_name || 'The memorial',
          transactionId: finalUpload.txId,
          gatewayUrl: gatewayUrls[0],
          successUrl: `${process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') || ''}/success?memorialId=${memorialId}`,
        }),
        attachments: [
          {
            name: `ulumae-seal-certificate-${memorialId}.pdf`,
            content: Buffer.from(certificatePdf).toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      });
    }

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'memorial_seal_completed',
      summary: 'The memorial was permanently sealed on the blockchain.',
      actorUserId: refreshedMemorial.user_id,
      actorEmail: ownerEmail,
      details: {
        txId: finalUpload.txId,
        assetCount: assets.length,
        totalBytes,
      },
    });

    return {
      sealStatus: 'completed' as const,
      txId: finalUpload.txId,
      gatewayUrls,
    };
  } catch (error: any) {
    const failedAt = new Date().toISOString();

    await admin
      .from('memorials')
      .update({
        seal_status: 'failed',
        seal_job_id: jobId,
        preservation_state: 'review',
        updated_at: failedAt,
      })
      .eq('id', memorialId);

    await safeLogMemorialActivity(admin, {
      memorialId,
      action: 'memorial_seal_failed',
      summary: 'The memorial seal did not complete.',
      actorEmail: ownerEmail,
      details: {
        jobId,
        message: error?.message || 'Unknown error',
      },
    });

    throw error;
  }
}

export async function getPreservationTransactionSummary(
  admin: SupabaseClient,
  memorialId: string,
  txId?: string | null
) {
  let query = admin
    .from('arweave_transactions')
    .select('*')
    .eq('memorial_id', memorialId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (txId) {
    query = admin
      .from('arweave_transactions')
      .select('*')
      .eq('tx_id', txId)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || 'Could not load the preservation transaction.');
  }

  if (!data) {
    return txId ? await checkTransactionStatus(txId) : null;
  }

  return {
    txId: data.tx_id,
    status: data.status,
    gatewayUrls: data.gateway_urls || getGatewayUrls(data.tx_id),
    fileCount: data.file_count || 0,
    totalBytes: data.total_bytes || 0,
    confirmedAt: data.confirmed_at,
    createdAt: data.created_at,
  };
}

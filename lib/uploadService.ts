import { createClient } from '@/utils/supabase/client';

import type {
  MediaDeleteResponse,
  MediaKind,
  MediaUploadResponse,
  StoredMediaAsset,
} from '@/types/media';

export interface SecureUploadOptions {
  memorialId: string;
  kind: MediaKind;
  metadata?: Record<string, unknown>;
  contributionId?: string | null;
}

export interface SecureUploadResult {
  success: boolean;
  asset?: StoredMediaAsset;
  url?: string;
  hash?: string;
  path?: string;
  error?: string;
  retryable?: boolean;
}

async function secureMemorialUpload(
  file: File,
  options: SecureUploadOptions
) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('memorialId', options.memorialId);
    formData.append('kind', options.kind);
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }
    if (options.contributionId) {
      formData.append('contributionId', options.contributionId);
    }

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json()) as MediaUploadResponse;
    if (!response.ok || !payload.success || !payload.data?.asset) {
      return {
        success: false,
        error: payload.error?.message || 'Upload failed.',
        retryable: payload.error?.retryable,
      };
    }

    return {
      success: true,
      asset: payload.data.asset,
      url: payload.data.asset.publicUrl,
      hash: payload.data.asset.sha256Hash,
      path: payload.data.asset.storagePath,
    };
  } catch (error: any) {
    console.error('[uploadService][secureUpload]', error);
    return {
      success: false,
      error: error?.message || 'Upload failed.',
      retryable: true,
    };
  }
}

async function legacyDirectUpload(
  file: File,
  bucket: string,
  path: string
): Promise<SecureUploadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');

    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      hash: hashHex,
      path,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Upload failed.',
      retryable: true,
    };
  }
}

export async function secureUpload(
  file: File,
  options: SecureUploadOptions
): Promise<SecureUploadResult>;
export async function secureUpload(
  file: File,
  bucket: string,
  path: string
): Promise<SecureUploadResult>;
export async function secureUpload(
  file: File,
  optionsOrBucket: SecureUploadOptions | string,
  maybePath?: string
): Promise<SecureUploadResult> {
  if (typeof optionsOrBucket === 'string') {
    return legacyDirectUpload(file, optionsOrBucket, maybePath || '');
  }

  return secureMemorialUpload(file, optionsOrBucket);
}

export async function deleteMediaAssets(
  memorialId: string,
  assetIds: string[],
  mode: 'soft' | 'restore' | 'hard' = 'soft'
) {
  const response = await fetch('/api/media/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      memorialId,
      assetIds,
      mode,
    }),
  });

  const payload = (await response.json()) as MediaDeleteResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Media update failed.');
  }

  return payload.data;
}

export type MediaBucket = 'memorial-media' | 'videos' | 'r2';

export type MediaKind =
  | 'profile_photo'
  | 'cover_photo'
  | 'gallery_photo'
  | 'interactive_photo'
  | 'voice_recording'
  | 'video'
  | 'video_thumbnail'
  | 'contribution_photo';

export type MediaItemStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'error'
  | 'deleting'
  | 'deleted';

export interface StoredMediaAsset {
  id: string;
  memorialId: string;
  contributionId: string | null;
  kind: MediaKind;
  bucket: MediaBucket;
  storagePath: string;
  publicUrl: string;
  originalFileName: string | null;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  arweaveUrl: string | null;
  sealedAt: string | null;
}

export interface MediaUploadError {
  code: string;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface MediaUploadResponse {
  success: boolean;
  data?: {
    asset: StoredMediaAsset;
  };
  error?: MediaUploadError;
}

export interface MediaDeleteResponse {
  success: boolean;
  data?: {
    assetIds: string[];
    mode: 'soft' | 'restore' | 'hard';
  };
  error?: MediaUploadError;
}

export interface MediaMetadataUpdateResponse {
  success: boolean;
  data?: {
    assetId: string;
    metadata: Record<string, unknown>;
  };
  error?: MediaUploadError;
}

export interface MediaReferenceFields {
  assetId?: string | null;
  bucket?: MediaBucket | null;
  storagePath?: string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedAt?: string | null;
  deletedAt?: string | null;
  uploadStatus?: MediaItemStatus;
  uploadError?: string | null;
  arweaveUrl?: string | null;
  sealedAt?: string | null;
}

'use client';

import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clapperboard,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { secureUpload } from '@/lib/uploadService';
import { MAX_VIDEO_FILE_SIZE_BYTES } from '@/lib/constants';
import { useArchiveRole } from '../_hooks/useArchiveRole';
import { useRoleSync } from '../_hooks/useRoleSync';

type ContributionTab = 'memory' | 'photo';
type StoredContributionType = 'memory' | 'photo' | 'video';
type PhotoVariant = 'gallery_photo' | 'interactive_story';

interface PhotoDraft {
  id: string;
  file: File | null;
  preview: string;
  caption: string;
  year: string;
  existingUrl?: string | null;
}

interface InteractiveStoryDraft {
  id: string;
  file: File | null;
  preview: string;
  title: string;
  description: string;
  year: string;
  existingUrl?: string | null;
}

interface VideoDraft {
  id: string;
  file: File | null;
  url: string;
  thumbnail: string;
  title: string;
  description: string;
  duration: string;
  mimeType: string;
  existingUrl?: string | null;
  existingThumbnail?: string | null;
}

interface RevisionContext {
  id: string;
  adminNotes: string | null;
  type: StoredContributionType;
  mediaVariant: PhotoVariant | null;
  existingUrl: string | null;
  existingThumbnail: string | null;
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getVideoDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const mins = Math.floor(video.duration / 60);
      const secs = Math.floor(video.duration % 60);
      URL.revokeObjectURL(video.src);
      resolve(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve('0:00');
    };
    video.src = URL.createObjectURL(file);
  });
}

async function createVideoThumbnail(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, Math.max(video.duration / 3, 0.2));
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not create a thumbnail.'));
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        if (!blob) {
          reject(new Error('Could not create a thumbnail.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not load the selected video.'));
    };

    video.src = URL.createObjectURL(file);
  });
}

function MediaUploadButton({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border-2 border-dashed border-warm-border/40 px-5 py-5 text-left transition-all hover:border-olive/40 hover:bg-olive/5"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-warm-dark/30">{icon}</div>
        <div>
          <p className="text-sm font-medium text-warm-dark font-sans">{title}</p>
          <p className="mt-1 text-xs text-warm-dark/40 font-sans">{hint}</p>
        </div>
      </div>
    </button>
  );
}

function ContributeContent({ memorialId }: { memorialId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeFromUrl = searchParams.get('type') as ContributionTab | null;
  const reviseId = searchParams.get('revise');
  const { data: roleData, loading: roleLoading, status: roleStatus } = useArchiveRole(memorialId);
  useRoleSync(memorialId, roleData, roleStatus);

  const [type, setType] = useState<ContributionTab>(typeFromUrl || 'memory');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [photoItems, setPhotoItems] = useState<PhotoDraft[]>([]);
  const [interactiveItems, setInteractiveItems] = useState<InteractiveStoryDraft[]>([]);
  const [videoItems, setVideoItems] = useState<VideoDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedHeading, setSubmittedHeading] = useState('Contribution shared');
  const [submittedSummary, setSubmittedSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [existingContributionLoaded, setExistingContributionLoaded] = useState(false);
  const [revisionContext, setRevisionContext] = useState<RevisionContext | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const interactiveRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(() => createClient());
  const revisionContribution = useMemo(
    () => roleData?.myContributions.find((item) => item.id === reviseId) ?? null,
    [reviseId, roleData?.myContributions]
  );

  const resetContributionForm = () => {
    setTitle('');
    setContent('');
    setAuthorName('');
    setRelationship('');
    setPhotoItems([]);
    setInteractiveItems([]);
    setVideoItems([]);
    setError(null);
  };

  useEffect(() => {
    if (!reviseId) {
      setExistingContributionLoaded(true);
      return;
    }

    if (!roleData) {
      return;
    }

    if (!revisionContribution || revisionContribution.status !== 'needs_changes') {
      setError('This contribution is no longer available for revision.');
      setExistingContributionLoaded(true);
      return;
    }

    setExistingContributionLoaded(false);

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('memorial_contributions')
          .select('id, type, content, admin_notes')
          .eq('id', reviseId)
          .single();

        if (fetchError || !data) {
          throw fetchError || new Error('Contribution not found');
        }

        const nextType = data.type === 'memory' ? 'memory' : 'photo';
        const mediaVariant: PhotoVariant | null =
          data.type === 'photo' && data.content?.mediaVariant === 'interactive_story'
            ? 'interactive_story'
            : data.type === 'photo'
              ? 'gallery_photo'
              : null;

        setType(nextType);
        setTitle(data.content?.title || '');
        setContent(data.content?.content || '');
        setRelationship(data.content?.relationship || '');
        setRevisionContext({
          id: data.id,
          adminNotes: data.admin_notes || null,
          type: data.type as StoredContributionType,
          mediaVariant,
          existingUrl: data.content?.url || null,
          existingThumbnail: data.content?.thumbnail || null,
        });

        setPhotoItems([]);
        setInteractiveItems([]);
        setVideoItems([]);

        if (data.type === 'photo' && mediaVariant === 'gallery_photo') {
          setPhotoItems([
            {
              id: createDraftId('photo'),
              file: null,
              preview: data.content?.url || '',
              caption: data.content?.caption || '',
              year: data.content?.year || '',
              existingUrl: data.content?.url || null,
            },
          ]);
        }

        if (data.type === 'photo' && mediaVariant === 'interactive_story') {
          setInteractiveItems([
            {
              id: createDraftId('interactive'),
              file: null,
              preview: data.content?.url || '',
              title: data.content?.title || '',
              description: data.content?.description || '',
              year: data.content?.year || '',
              existingUrl: data.content?.url || null,
            },
          ]);
        }

        if (data.type === 'video') {
          setVideoItems([
            {
              id: createDraftId('video'),
              file: null,
              url: data.content?.url || '',
              thumbnail: data.content?.thumbnail || data.content?.url || '',
              title: data.content?.title || '',
              description: data.content?.description || '',
              duration: data.content?.duration || '',
              mimeType: data.content?.mimeType || 'video/mp4',
              existingUrl: data.content?.url || null,
              existingThumbnail: data.content?.thumbnail || null,
            },
          ]);
        }
      } catch (fetchError: any) {
        setError(fetchError.message || 'Could not load the contribution to revise.');
      } finally {
        setExistingContributionLoaded(true);
      }
    })();
  }, [reviseId, revisionContribution?.id, revisionContribution?.status, roleData?.currentUserId, supabase]);

  if (roleLoading || !roleData || !existingContributionLoaded) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <Loader2 size={32} className="text-olive animate-spin" />
      </div>
    );
  }

  if (!roleData.capabilities.canContribute) {
    return null;
  }

  const requiresReview = roleData.capabilities.contributionsRequireReview;
  const isRevision = Boolean(revisionContext);
  const totalMediaItems = photoItems.length + interactiveItems.length + videoItems.length;
  const showImagesSection =
    !isRevision ||
    !revisionContext ||
    (revisionContext.type === 'photo' && revisionContext.mediaVariant === 'gallery_photo');
  const showInteractiveSection =
    !isRevision ||
    (revisionContext?.type === 'photo' && revisionContext.mediaVariant === 'interactive_story');
  const showVideosSection =
    !isRevision ||
    revisionContext?.type === 'video';

  const addPhotoFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" must be under 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setPhotoItems((current) => [
      ...current,
      ...validFiles.map((file) => ({
        id: createDraftId('photo'),
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        year: '',
      })),
    ]);
    setError(null);
  };

  const addInteractiveFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" must be under 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setInteractiveItems((current) => [
      ...current,
      ...validFiles.map((file) => ({
        id: createDraftId('interactive'),
        file,
        preview: URL.createObjectURL(file),
        title: '',
        description: '',
        year: '',
      })),
    ]);
    setError(null);
  };

  const addVideoFiles = async (files: File[]) => {
    const nextItems: VideoDraft[] = [];

    for (const file of files) {
      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        setError(`"${file.name}" exceeds the ${Math.round(MAX_VIDEO_FILE_SIZE_BYTES / 1024 / 1024)}MB limit.`);
        continue;
      }

      const url = URL.createObjectURL(file);
      const duration = await getVideoDuration(file);
      nextItems.push({
        id: createDraftId('video'),
        file,
        url,
        thumbnail: url,
        title: '',
        description: '',
        duration,
        mimeType: file.type || 'video/mp4',
      });
    }

    if (nextItems.length > 0) {
      setVideoItems((current) => [...current, ...nextItems]);
      setError(null);
    }
  };

  const updatePhotoItem = (id: string, field: 'caption' | 'year', value: string) => {
    setPhotoItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const updateInteractiveItem = (id: string, field: 'title' | 'description' | 'year', value: string) => {
    setInteractiveItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const updateVideoItem = (id: string, field: 'title' | 'description', value: string) => {
    setVideoItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removePhotoItem = (id: string) => {
    setPhotoItems((current) => current.filter((item) => item.id !== id));
  };

  const removeInteractiveItem = (id: string) => {
    setInteractiveItems((current) => current.filter((item) => item.id !== id));
  };

  const removeVideoItem = (id: string) => {
    setVideoItems((current) => current.filter((item) => item.id !== id));
  };

  const submitContributionRecord = async (
    contributionType: StoredContributionType,
    contributionContent: Record<string, any>,
    witnessName: string,
    revisionId: string | null = null
  ) => {
    const response = await fetch(`/api/archive/${memorialId}/contributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: contributionType,
        content: contributionContent,
        witnessName,
        revisionId,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to submit. Please try again.');
    }
  };

  const uploadPhotoContribution = async (item: PhotoDraft, variant: PhotoVariant) => {
    if (!item.file && !item.existingUrl) {
      throw new Error('Please select an image before submitting.');
    }

    let asset: Awaited<ReturnType<typeof secureUpload>>['asset'] | undefined;
    let url = item.existingUrl || '';

    if (item.file) {
      const uploadResult = await secureUpload(item.file, {
        memorialId,
        kind: variant === 'interactive_story' ? 'interactive_photo' : 'contribution_photo',
        metadata: {
          caption: item.caption.trim(),
          year: item.year.trim(),
          relationship: relationship.trim(),
          mediaVariant: variant,
        },
      });

      if (!uploadResult.success || !uploadResult.asset) {
        throw new Error(uploadResult.error || 'Photo upload failed.');
      }

      asset = uploadResult.asset;
      url = uploadResult.asset.publicUrl;
    }

    return {
      title: item.caption.trim() || (variant === 'interactive_story' ? 'Interactive photo story' : 'Photo'),
      url,
      caption: item.caption.trim(),
      year: item.year.trim(),
      relationship: relationship.trim(),
      mediaVariant: variant,
      assetId: asset?.id || null,
      bucket: asset?.bucket || null,
      storagePath: asset?.storagePath || null,
      sha256_hash: asset?.sha256Hash || null,
    };
  };

  const uploadInteractiveContribution = async (item: InteractiveStoryDraft) => {
    if (!item.file && !item.existingUrl) {
      throw new Error('Please select an image before submitting the interactive story.');
    }

    let asset: Awaited<ReturnType<typeof secureUpload>>['asset'] | undefined;
    let url = item.existingUrl || '';

    if (item.file) {
      const uploadResult = await secureUpload(item.file, {
        memorialId,
        kind: 'interactive_photo',
        metadata: {
          title: item.title.trim(),
          description: item.description.trim(),
          year: item.year.trim(),
          relationship: relationship.trim(),
          mediaVariant: 'interactive_story',
        },
      });

      if (!uploadResult.success || !uploadResult.asset) {
        throw new Error(uploadResult.error || 'Interactive story upload failed.');
      }

      asset = uploadResult.asset;
      url = uploadResult.asset.publicUrl;
    }

    return {
      title: item.title.trim() || 'Interactive photo story',
      url,
      description: item.description.trim(),
      year: item.year.trim(),
      relationship: relationship.trim(),
      mediaVariant: 'interactive_story',
      assetId: asset?.id || null,
      bucket: asset?.bucket || null,
      storagePath: asset?.storagePath || null,
      sha256_hash: asset?.sha256Hash || null,
    };
  };

  const uploadVideoContribution = async (item: VideoDraft) => {
    if (!item.file && !item.existingUrl) {
      throw new Error('Please select a video before submitting.');
    }

    let asset: Awaited<ReturnType<typeof secureUpload>>['asset'] | undefined;
    let thumbnailAsset: Awaited<ReturnType<typeof secureUpload>>['asset'] | undefined;
    let url = item.existingUrl || item.url;
    let thumbnail = item.existingThumbnail || item.thumbnail || item.url;
    let mimeType = item.mimeType || 'video/mp4';

    if (item.file) {
      const uploadResult = await secureUpload(item.file, {
        memorialId,
        kind: 'video',
        metadata: {
          title: item.title.trim(),
          description: item.description.trim(),
          duration: item.duration || '',
          relationship: relationship.trim(),
        },
      });

      if (!uploadResult.success || !uploadResult.asset) {
        throw new Error(uploadResult.error || 'Video upload failed.');
      }

      asset = uploadResult.asset;
      url = uploadResult.asset.publicUrl;
      mimeType = uploadResult.asset.mimeType || mimeType;

      try {
        const thumbnailBlob = await createVideoThumbnail(item.file);
        const thumbnailFile = new File([thumbnailBlob], `${item.id}.png`, { type: 'image/png' });
        const thumbResult = await secureUpload(thumbnailFile, {
          memorialId,
          kind: 'video_thumbnail',
          metadata: {
            videoAssetId: uploadResult.asset.id,
          },
        });

        if (thumbResult.success && thumbResult.asset) {
          thumbnailAsset = thumbResult.asset;
          thumbnail = thumbResult.asset.publicUrl;
        } else {
          thumbnail = uploadResult.asset.publicUrl;
        }
      } catch {
        thumbnail = uploadResult.asset.publicUrl;
      }
    }

    return {
      title: item.title.trim() || 'Video',
      description: item.description.trim(),
      duration: item.duration || '',
      relationship: relationship.trim(),
      url,
      thumbnail,
      mimeType,
      assetId: asset?.id || null,
      bucket: asset?.bucket || null,
      storagePath: asset?.storagePath || null,
      sha256_hash: asset?.sha256Hash || null,
      thumbnailAssetId: thumbnailAsset?.id || null,
      thumbnailBucket: thumbnailAsset?.bucket || null,
      thumbnailStoragePath: thumbnailAsset?.storagePath || null,
    };
  };

  const buildMediaSummary = (counts: { photos: number; stories: number; videos: number; memories: number }) => {
    const parts: string[] = [];
    if (counts.memories > 0) parts.push(`${counts.memories} memor${counts.memories > 1 ? 'ies' : 'y'}`);
    if (counts.photos > 0) parts.push(`${counts.photos} image${counts.photos > 1 ? 's' : ''}`);
    if (counts.stories > 0) parts.push(`${counts.stories} interactive stor${counts.stories > 1 ? 'ies' : 'y'}`);
    if (counts.videos > 0) parts.push(`${counts.videos} video${counts.videos > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  const handleSubmit = async () => {
    if (type === 'memory') {
      if (!title.trim()) {
        setError('Please add a title for your memory.');
        return;
      }
      if (!content.trim() || content.length < 20) {
        setError('Please write at least a sentence or two.');
        return;
      }
    } else {
      if (totalMediaItems === 0) {
        setError('Please add at least one image, interactive story, or video.');
        return;
      }

      if (interactiveItems.some((item) => !item.description.trim())) {
        setError('Each interactive photo story needs a short story to reveal.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const contributorName = authorName.trim() || user?.email || 'Contributor';
      const counts = { photos: 0, stories: 0, videos: 0, memories: 0 };

      if (type === 'memory') {
        await submitContributionRecord(
          'memory',
          {
            title: title.trim(),
            content: content.trim(),
            relationship: relationship.trim(),
          },
          contributorName,
          revisionContext?.id || null
        );

        counts.memories += 1;
        setSubmittedHeading(isRevision ? 'Memory updated' : 'Memory shared');
        setSubmittedSummary(buildMediaSummary(counts));
      } else if (isRevision && revisionContext) {
        if (revisionContext.type === 'video') {
          const nextVideo = videoItems[0];
          const contributionContent = await uploadVideoContribution(nextVideo);
          await submitContributionRecord('video', contributionContent, contributorName, revisionContext.id);
          counts.videos += 1;
          setSubmittedHeading('Video updated');
        } else if (revisionContext.type === 'photo' && revisionContext.mediaVariant === 'interactive_story') {
          const nextStory = interactiveItems[0];
          const contributionContent = await uploadInteractiveContribution(nextStory);
          await submitContributionRecord('photo', contributionContent, contributorName, revisionContext.id);
          counts.stories += 1;
          setSubmittedHeading('Interactive story updated');
        } else {
          const nextPhoto = photoItems[0];
          const contributionContent = await uploadPhotoContribution(nextPhoto, 'gallery_photo');
          await submitContributionRecord('photo', contributionContent, contributorName, revisionContext.id);
          counts.photos += 1;
          setSubmittedHeading('Photo updated');
        }

        setSubmittedSummary(buildMediaSummary(counts));
      } else {
        for (const item of photoItems) {
          const contributionContent = await uploadPhotoContribution(item, 'gallery_photo');
          await submitContributionRecord('photo', contributionContent, contributorName);
          counts.photos += 1;
        }

        for (const item of interactiveItems) {
          const contributionContent = await uploadInteractiveContribution(item);
          await submitContributionRecord('photo', contributionContent, contributorName);
          counts.stories += 1;
        }

        for (const item of videoItems) {
          const contributionContent = await uploadVideoContribution(item);
          await submitContributionRecord('video', contributionContent, contributorName);
          counts.videos += 1;
        }

        setSubmittedHeading(totalMediaItems > 1 ? 'Contributions shared' : 'Contribution shared');
        setSubmittedSummary(buildMediaSummary(counts));
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('[contribute]', err);
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-olive" />
          </div>
          <h2 className="font-serif text-3xl text-warm-dark mb-3">
            {submittedHeading}
          </h2>
          <p className="text-sm text-warm-dark/50 mb-3 leading-relaxed">
            {submittedSummary ? `${submittedSummary.charAt(0).toUpperCase()}${submittedSummary.slice(1)}.` : 'Your contribution is ready.'}
          </p>
          <p className="text-sm text-warm-dark/50 mb-8 leading-relaxed">
            {requiresReview
              ? (isRevision
                ? 'Your revised contribution is back in the review queue. You can track its status from your archive dashboard.'
                : 'A guardian will review your contribution before it appears in the archive. You can track its status from your archive dashboard.')
              : 'Your contribution is now visible in the archive.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setRevisionContext(null);
                resetContributionForm();
                if (isRevision) {
                  router.replace(`/archive/${memorialId}/contribute${type === 'photo' ? '?type=photo' : ''}`);
                }
              }}
              className="flex-1 py-3 border border-warm-border/40 rounded-xl text-sm text-warm-dark/60 hover:bg-warm-border/10 transition-all font-sans"
            >
              Share another
            </button>
            <button
              onClick={() => router.push(`/archive/${memorialId}`)}
              className="flex-1 py-3 glass-btn-dark rounded-xl text-sm font-medium transition-all font-sans"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-low">
      <div className="border-b border-warm-border/20 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push(`/archive/${memorialId}`)}
            className="p-2 hover:bg-warm-border/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-warm-dark/60" />
          </button>
          <h1 className="font-serif text-xl text-warm-dark">Share a contribution</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {revisionContext?.adminNotes && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wider font-sans mb-2">Requested changes</p>
            <p className="text-sm text-amber-900 font-sans leading-relaxed">{revisionContext.adminNotes}</p>
          </div>
        )}

        <div className="flex gap-2 p-1 bg-warm-border/20 rounded-xl mb-8">
          {(['memory', 'photo'] as const).map((nextType) => (
            <button
              key={nextType}
              onClick={() => {
                setType(nextType);
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 font-sans ${
                type === nextType ? 'bg-white shadow-sm text-warm-dark' : 'text-warm-dark/50 hover:text-warm-dark'
              }`}
            >
              {nextType === 'memory' ? <MessageCircle size={16} /> : <ImageIcon size={16} />}
              {nextType === 'memory' ? 'A memory' : 'Media'}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {type === 'memory' && (
            <>
              <div>
                <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                  What is this memory about?
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. The summer she taught me to bake"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                  Tell the story
                </label>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your memory here. There is no right or wrong way - just tell it as you remember it."
                  rows={7}
                  className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all resize-none text-sm font-serif leading-relaxed"
                />
                <p className="text-xs text-warm-dark/30 mt-1.5 font-sans text-right">{content.length} characters</p>
              </div>
            </>
          )}

          {type === 'photo' && (
            <div className="space-y-6">
              {showImagesSection && (
              <div className="rounded-xl border border-warm-border/20 bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-serif text-2xl text-warm-dark">Images</h2>
                    <p className="text-sm text-warm-dark/45 font-sans">Add one or several images in a single pass.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
                  >
                    <Plus size={16} />
                    Add images
                  </button>
                </div>

                {photoItems.length === 0 ? (
                  <MediaUploadButton
                    icon={<ImageIcon size={26} />}
                    title="Select images"
                    hint="JPG or PNG, up to 10MB each. You can choose several files at once."
                    onClick={() => photoRef.current?.click()}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {photoItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-warm-border/25 p-4 space-y-3">
                        <div className="relative">
                          <img src={item.preview} alt={item.caption || 'Image preview'} className="w-full h-44 object-cover rounded-xl border border-warm-border/20" />
                          <button
                            type="button"
                            onClick={() => removePhotoItem(item.id)}
                            className="absolute top-3 right-3 p-2 bg-warm-dark/80 rounded-full hover:bg-warm-dark transition-all"
                          >
                            <X size={14} className="text-surface-low" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.caption}
                          onChange={(event) => updatePhotoItem(item.id, 'caption', event.target.value)}
                          placeholder="Caption (optional)"
                          className="glass-input"
                        />
                        <input
                          type="text"
                          value={item.year}
                          onChange={(event) => updatePhotoItem(item.id, 'year', event.target.value)}
                          placeholder="Approximate year (optional)"
                          className="glass-input"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {showInteractiveSection && (
              <div className="rounded-xl border border-warm-border/20 bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-serif text-2xl text-warm-dark">Interactive photo stories</h2>
                    <p className="text-sm text-warm-dark/45 font-sans">Pair each image with the story it should reveal.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => interactiveRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
                  >
                    <Plus size={16} />
                    Add stories
                  </button>
                </div>

                {interactiveItems.length === 0 ? (
                  <MediaUploadButton
                    icon={<ImageIcon size={26} />}
                    title="Select images for interactive stories"
                    hint="Choose one or several images. Each story needs its own short reveal text."
                    onClick={() => interactiveRef.current?.click()}
                  />
                ) : (
                  <div className="grid gap-4">
                    {interactiveItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-warm-border/25 p-4 space-y-3">
                        <div className="relative">
                          <img src={item.preview} alt={item.title || 'Interactive story preview'} className="w-full h-48 object-cover rounded-xl border border-warm-border/20" />
                          <button
                            type="button"
                            onClick={() => removeInteractiveItem(item.id)}
                            className="absolute top-3 right-3 p-2 bg-warm-dark/80 rounded-full hover:bg-warm-dark transition-all"
                          >
                            <X size={14} className="text-surface-low" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(event) => updateInteractiveItem(item.id, 'title', event.target.value)}
                            placeholder="Title (optional)"
                            className="glass-input"
                          />
                          <input
                            type="text"
                            value={item.year}
                            onChange={(event) => updateInteractiveItem(item.id, 'year', event.target.value)}
                            placeholder="Approximate year"
                            className="glass-input"
                          />
                        </div>
                        <textarea
                          value={item.description}
                          onChange={(event) => updateInteractiveItem(item.id, 'description', event.target.value)}
                          placeholder="What story should this image reveal?"
                          rows={4}
                          className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all resize-none text-sm font-sans leading-relaxed"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {showVideosSection && (
              <div className="rounded-xl border border-warm-border/20 bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-serif text-2xl text-warm-dark">Videos</h2>
                    <p className="text-sm text-warm-dark/45 font-sans">Share one or several clips. Each video can have its own title and note.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => videoRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-warm-border/30 px-3 py-2 text-sm text-warm-dark/70 hover:bg-warm-border/10"
                  >
                    <Plus size={16} />
                    Add videos
                  </button>
                </div>

                {videoItems.length === 0 ? (
                  <MediaUploadButton
                    icon={<Clapperboard size={26} />}
                    title="Select videos"
                    hint={`MP4, MOV, and similar files up to ${Math.round(MAX_VIDEO_FILE_SIZE_BYTES / 1024 / 1024)}MB each. Multiple selection is supported.`}
                    onClick={() => videoRef.current?.click()}
                  />
                ) : (
                  <div className="grid gap-4">
                    {videoItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-warm-border/25 p-4 space-y-3">
                        <div className="relative">
                          <video controls preload="metadata" className="w-full max-h-80 rounded-xl border border-warm-border/20 bg-black" poster={item.thumbnail || undefined}>
                            <source src={item.url} type={item.mimeType || 'video/mp4'} />
                          </video>
                          <button
                            type="button"
                            onClick={() => removeVideoItem(item.id)}
                            className="absolute top-3 right-3 p-2 bg-warm-dark/80 rounded-full hover:bg-warm-dark transition-all"
                          >
                            <X size={14} className="text-surface-low" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(event) => updateVideoItem(item.id, 'title', event.target.value)}
                            placeholder="Title (optional)"
                            className="glass-input"
                          />
                          <input
                            type="text"
                            value={item.duration}
                            readOnly
                            className="glass-input bg-warm-border/10 text-warm-dark/45"
                          />
                        </div>
                        <textarea
                          value={item.description}
                          onChange={(event) => updateVideoItem(item.id, 'description', event.target.value)}
                          placeholder="Description (optional)"
                          rows={3}
                          className="w-full px-4 py-3 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all resize-none text-sm font-sans leading-relaxed"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 0) addPhotoFiles(files);
                  event.currentTarget.value = '';
                }}
              />
              <input
                ref={interactiveRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 0) addInteractiveFiles(files);
                  event.currentTarget.value = '';
                }}
              />
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length > 0) {
                    void addVideoFiles(files);
                  }
                  event.currentTarget.value = '';
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-warm-border/20">
            <div>
              <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                Your name (optional)
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="How you want to be credited"
                className="glass-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                Your relationship (optional)
              </label>
              <input
                type="text"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                placeholder="e.g. Daughter, Colleague"
                className="glass-input"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-sans">{error}</p>
            </div>
          )}

          <div className="p-4 bg-warm-border/10 rounded-xl border border-warm-border/20 flex items-start gap-3">
            <AlertCircle size={16} className="text-warm-dark/30 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-warm-dark/40 leading-relaxed font-sans">
              {requiresReview
                ? (isRevision
                  ? 'Your revised contribution will go back to the guardians for review.'
                  : 'Your contribution will be reviewed by a guardian before it appears in the archive.')
                : 'As a guardian, anything you share here appears in the archive immediately.'}
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 font-sans ${
              loading ? 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed' : 'glass-btn-dark shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                {isRevision
                  ? (requiresReview ? 'Resubmit for review' : 'Update contribution')
                  : (requiresReview ? 'Offer for review' : 'Publish contribution')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContributePage({ params }: { params: Promise<{ memorialId: string }> }) {
  const { memorialId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-low flex items-center justify-center">
          <Loader2 size={32} className="text-olive animate-spin" />
        </div>
      }
    >
      <ContributeContent memorialId={memorialId} />
    </Suspense>
  );
}

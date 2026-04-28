'use client';

import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { secureUpload } from '@/lib/uploadService';
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

const BIOGRAPHY_TEXTAREA_STYLE = {
  fontFamily: 'Georgia, serif',
  fontVariant: 'normal' as const,
  fontVariantCaps: 'normal' as const,
  textTransform: 'none' as const,
};

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
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedHeading, setSubmittedHeading] = useState('Contribution shared');
  const [submittedSummary, setSubmittedSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [existingContributionLoaded, setExistingContributionLoaded] = useState(false);
  const [revisionContext, setRevisionContext] = useState<RevisionContext | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
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

        if (data.type === 'video' || mediaVariant === 'interactive_story') {
          setError('Only photo contributions can be revised here now.');
          setExistingContributionLoaded(true);
          return;
        }

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
  const totalMediaItems = photoItems.length;

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

  const updatePhotoItem = (id: string, field: 'caption' | 'year', value: string) => {
    setPhotoItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removePhotoItem = (id: string) => {
    setPhotoItems((current) => current.filter((item) => item.id !== id));
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
          contributionUpload: variant === 'interactive_story',
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

  const buildMediaSummary = (counts: { photos: number; memories: number }) => {
    const parts: string[] = [];
    if (counts.memories > 0) parts.push(`${counts.memories} memor${counts.memories > 1 ? 'ies' : 'y'}`);
    if (counts.photos > 0) parts.push(`${counts.photos} image${counts.photos > 1 ? 's' : ''}`);
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
        setError('Please add at least one photo.');
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
      const counts = { photos: 0, memories: 0 };

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
        if (revisionContext.type === 'photo' && revisionContext.mediaVariant === 'gallery_photo') {
          const nextPhoto = photoItems[0];
          const contributionContent = await uploadPhotoContribution(nextPhoto, 'gallery_photo');
          await submitContributionRecord('photo', contributionContent, contributorName, revisionContext.id);
          counts.photos += 1;
          setSubmittedHeading('Photo updated');
        } else {
          throw new Error('Only photo contributions can be revised here now.');
        }

        setSubmittedSummary(buildMediaSummary(counts));
      } else {
        for (const item of photoItems) {
          const contributionContent = await uploadPhotoContribution(item, 'gallery_photo');
          await submitContributionRecord('photo', contributionContent, contributorName);
          counts.photos += 1;
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
                  className="w-full px-6 py-4 border border-warm-border/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-olive/30 focus:border-olive transition-all resize-none normal-case text-base leading-relaxed"
                  style={BIOGRAPHY_TEXTAREA_STYLE}
                />
                <p className="text-xs text-warm-dark/30 mt-1.5 font-sans text-right">{content.length} characters</p>
              </div>
            </>
          )}

          {type === 'photo' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-warm-border/20 bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-serif text-2xl text-warm-dark">Photos</h2>
                    <p className="text-sm text-warm-dark/45 font-sans">Add one or several photos in a single pass.</p>
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
                    title="Select photos"
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

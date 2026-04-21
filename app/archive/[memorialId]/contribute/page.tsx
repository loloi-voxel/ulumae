'use client';

import { Suspense, use, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { secureUpload } from '@/lib/uploadService';
import { useArchiveRole } from '../_hooks/useArchiveRole';
import { useRoleSync } from '../_hooks/useRoleSync';

type ContributionType = 'memory' | 'photo';

function ContributeContent({ memorialId }: { memorialId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeFromUrl = searchParams.get('type') as ContributionType | null;
  const reviseId = searchParams.get('revise');
  const { data: roleData, loading: roleLoading, status: roleStatus } = useArchiveRole(memorialId);
  useRoleSync(memorialId, roleData, roleStatus);

  const [type, setType] = useState<ContributionType>(typeFromUrl || 'memory');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoYear, setPhotoYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingContributionLoaded, setExistingContributionLoaded] = useState(false);
  const [revisionContext, setRevisionContext] = useState<{
    id: string;
    adminNotes: string | null;
    existingPhotoUrl: string | null;
  } | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(() => createClient());

  const resetContributionForm = () => {
    setTitle('');
    setContent('');
    setAuthorName('');
    setRelationship('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoCaption('');
    setPhotoYear('');
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

    const contribution = roleData.myContributions.find((item) => item.id === reviseId);
    if (!contribution || contribution.status !== 'needs_changes') {
      setError('This contribution is no longer available for revision.');
      setExistingContributionLoaded(true);
      return;
    }

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

        setType(data.type as ContributionType);
        setTitle(data.content?.title || '');
        setContent(data.content?.content || '');
        setRelationship(data.content?.relationship || '');
        setPhotoCaption(data.content?.caption || '');
        setPhotoYear(data.content?.year || '');
        setPhotoPreview(data.content?.url || null);
        setRevisionContext({
          id: data.id,
          adminNotes: data.admin_notes || null,
          existingPhotoUrl: data.content?.url || null,
        });
      } catch (fetchError: any) {
        setError(fetchError.message || 'Could not load the contribution to revise.');
      } finally {
        setExistingContributionLoaded(true);
      }
    })();
  }, [reviseId, roleData, supabase]);

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

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPhotoFile(file);
    setError(null);
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
    }

    if (type === 'photo' && !photoFile) {
      setError('Please select a photo to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const contributorName = authorName.trim() || user?.email || 'Contributor';
      let contributionContent: Record<string, any> = {};

      if (type === 'memory') {
        contributionContent = {
          title: title.trim(),
          content: content.trim(),
          relationship: relationship.trim(),
        };
      }

      if (type === 'photo' && photoFile) {
        const uploadResult = await secureUpload(photoFile, {
          memorialId,
          kind: 'contribution_photo',
          metadata: {
            caption: photoCaption.trim(),
            year: photoYear.trim(),
            relationship: relationship.trim(),
          },
        });

        if (!uploadResult.success || !uploadResult.asset) {
          throw new Error(uploadResult.error || 'Photo upload failed.');
        }

        contributionContent = {
          title: photoCaption.trim() || 'Photo',
          assetId: uploadResult.asset.id,
          url: uploadResult.asset.publicUrl,
          caption: photoCaption.trim(),
          year: photoYear.trim(),
          relationship: relationship.trim(),
          bucket: uploadResult.asset.bucket,
          storagePath: uploadResult.asset.storagePath,
          sha256_hash: uploadResult.asset.sha256Hash,
        };
      }

      if (type === 'photo' && !photoFile && revisionContext?.existingPhotoUrl) {
        contributionContent = {
          title: photoCaption.trim() || 'Photo',
          url: revisionContext.existingPhotoUrl,
          caption: photoCaption.trim(),
          year: photoYear.trim(),
          relationship: relationship.trim(),
        };
      }

      const response = await fetch(`/api/archive/${memorialId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: contributionContent,
          witnessName: contributorName,
          revisionId: revisionContext?.id || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit. Please try again.');
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
            {type === 'photo' ? (isRevision ? 'Photo updated' : 'Photo shared') : (isRevision ? 'Memory updated' : 'Memory shared')}
          </h2>
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
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push(`/archive/${memorialId}`)}
            className="p-2 hover:bg-warm-border/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-warm-dark/60" />
          </button>
          <h1 className="font-serif text-xl text-warm-dark">Share a contribution</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
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
              {nextType === 'memory' ? 'A memory' : 'A photo'}
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
            <>
              {!photoPreview ? (
                <div
                  onClick={() => photoRef.current?.click()}
                  className="border-2 border-dashed border-warm-border/40 rounded-xl p-12 text-center cursor-pointer hover:border-olive/40 hover:bg-olive/5 transition-all"
                >
                  <ImageIcon size={40} className="text-warm-dark/20 mx-auto mb-3" />
                  <p className="text-sm text-warm-dark/50 font-sans">Click to select a photo</p>
                  <p className="text-xs text-warm-dark/30 mt-1 font-sans">JPG, PNG up to 10MB</p>
                </div>
              ) : (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="w-full rounded-xl border-2 border-warm-border/30 max-h-80 object-cover" />
                  <button
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-3 right-3 p-2 bg-warm-dark/80 rounded-full hover:bg-warm-dark transition-all"
                  >
                    <X size={14} className="text-surface-low" />
                  </button>
                </div>
              )}

              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />

              <div>
                <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                  Caption (optional)
                </label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(event) => setPhotoCaption(event.target.value)}
                  placeholder="What is happening in this photo?"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-warm-dark/50 uppercase tracking-wider mb-2 font-sans">
                  Approximate year (optional)
                </label>
                <input
                  type="text"
                  value={photoYear}
                  onChange={(event) => setPhotoYear(event.target.value)}
                  placeholder="e.g. 1987"
                  className="glass-input"
                />
              </div>
            </>
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

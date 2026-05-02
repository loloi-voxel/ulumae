// components/wizard/Step10Review.tsx
'use client';

import { useState } from 'react';
import {
  Edit,
  Eye,
  ArrowLeft,
  User,
  Home,
  Briefcase,
  Heart,
  Sparkles,
  BookOpen,
  MessageCircle,
  Image as ImageIcon,
  Film,
  Users,
  Shield,
  Gift,
  X,
} from 'lucide-react';

import {
  MemorialData,
  type MemorialSealStatus,
  isMemorialSealLocked,
  isMemorialSealed,
} from '@/types/memorial';
import { calculateCompletion } from '@/lib/completionLogic';
import { createFullSnapshot } from '@/lib/versionService';
import PreviewModal from './PreviewModal';
import SuccessorSettings from '@/components/SuccessorSettings';

interface Step10Props {
  data: MemorialData;
  memorialId: string | null;
  onBack: () => void;
  onJumpToStep: (step: number) => void;
  plan?: string;
  isSelfArchive?: boolean;
  hasSuccessor?: boolean;
  userId?: string;
  isPaid?: boolean;
  showStatusInsights?: boolean;
  sealStatus?: MemorialSealStatus;
}

const STEP_ICONS: Record<number, any> = {
  1: User,
  2: Home,
  3: Briefcase,
  4: Heart,
  5: Sparkles,
  6: BookOpen,
  7: MessageCircle,
  8: ImageIcon,
  9: Film,
};

export default function Step10Review({
  data,
  memorialId,
  onBack,
  onJumpToStep,
  plan = 'draft',
  isSelfArchive = false,
  hasSuccessor = false,
  userId = '',
  isPaid = false,
  showStatusInsights = true,
  sealStatus = null,
}: Step10Props) {
  const [isSealing, setIsSealing] = useState(false);
  const [sealPhase, setSealPhase] = useState<'idle' | 'review' | 'pause' | 'transition'>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessorModal, setShowSuccessorModal] = useState(false);

  const completion = calculateCompletion(data, plan);
  const { canSeal, sealBlockReasons, emotionalState, emotionalResult } = completion;
  const showEmotionalInsights = showStatusInsights && emotionalResult.enabled && emotionalState !== null;

  const isBlockedBySuccessor = isSelfArchive && !hasSuccessor;
  const isSealReady = canSeal && !isBlockedBySuccessor;
  const sealCompleted = isMemorialSealed(sealStatus);
  const sealLocked = isMemorialSealLocked(sealStatus);
  const canUseBlockchainSeal = plan === 'personal' && isPaid;
  const isFamilyArchive = plan === 'family' || plan === 'concierge';
  const preservationHref = memorialId && userId
    ? `/dashboard/preservation/${userId}?memorialId=${memorialId}`
    : userId
      ? `/dashboard/preservation/${userId}`
      : '/dashboard';
  const familyDashboardHref = userId
    ? `/dashboard/family/${userId}`
    : '/dashboard';
  const primaryButtonLabel = sealCompleted
    ? 'Already sealed'
    : sealLocked
      ? 'Sealing in progress'
      : canUseBlockchainSeal
        ? 'Prepare Seal Forever'
        : isFamilyArchive && isSealReady
          ? 'Return to dashboard'
          : isSealReady
            ? 'Seal the Archive'
            : 'Strengthen their legacy';
  const introCopy = canUseBlockchainSeal
    ? 'Look over what you have built. When you are ready, continue to the final Seal Forever selection.'
    : isFamilyArchive
      ? 'Look over what you have built. Family archives stay editable and collaborative; blockchain sealing remains exclusive to Personal plans.'
      : 'Look over what you have built. When you are ready, continue toward preservation.';

  const handleSeal = async () => {
    if (sealLocked || sealCompleted) {
      window.location.href = canUseBlockchainSeal ? preservationHref : familyDashboardHref;
      return;
    }

    if (!isSealReady) return;

    setSealPhase('review');

    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSealPhase('pause');
    await new Promise((resolve) => setTimeout(resolve, 2500));

    setSealPhase('transition');
    setIsSealing(true);

    if (memorialId) {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await createFullSnapshot({
        memorialId,
        data,
        userId: user?.id || undefined,
        userName: 'Owner',
        changeSummary: canUseBlockchainSeal
          ? 'Archive prepared for permanent sealing'
          : 'Archive reviewed before preservation step',
        changeReason: 'archive_seal',
        changeType: 'manual',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    if (canUseBlockchainSeal) {
      window.location.href = preservationHref;
      return;
    }

    if (isFamilyArchive) {
      window.location.href = familyDashboardHref;
      return;
    }

    const sealUrl = memorialId
      ? `/seal-confirmation?memorialId=${memorialId}`
      : '/seal-confirmation';
    window.location.href = sealUrl;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {sealPhase !== 'idle' && (
        <div className="fixed inset-0 z-[200] bg-warm-dark/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center max-w-md px-8">
            {sealPhase === 'review' && (
              <div className="animate-fadeIn">
                <p className="font-serif text-2xl text-surface-low/90 leading-relaxed">
                  What you have built will endure.
                </p>
              </div>
            )}
            {sealPhase === 'pause' && (
              <div className="animate-fadeIn">
                <p className="font-serif text-2xl text-surface-low/90 leading-relaxed mb-4">
                  Take a moment.
                </p>
                <p className="text-surface-low/50 text-sm">
                  What you preserve next will shape how this life is remembered.
                </p>
              </div>
            )}
            {sealPhase === 'transition' && (
              <div className="animate-fadeIn">
                <div className="w-12 h-12 mx-auto mb-6 border-2 border-surface-low/20 border-t-surface-low/70 rounded-full animate-spin" />
                <p className="font-serif text-xl text-surface-low/80">
                  {canUseBlockchainSeal
                    ? 'Opening the sealing console...'
                    : isFamilyArchive
                      ? 'Returning to your archive...'
                      : 'Preparing preservation...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-12">
        <h2 className="font-serif text-4xl text-warm-dark mb-3">
          Review & Seal
        </h2>
        <p className="text-warm-dark/50 text-lg">
          {introCopy}
        </p>
      </div>

      {sealLocked && (
        <div className="mb-10 rounded-xl border border-olive/20 bg-olive/5 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-full text-olive shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-warm-dark mb-2">
                {sealCompleted ? 'This memorial has already been sealed' : 'Sealing is already in progress'}
              </h3>
              <p className="text-warm-dark/60 text-sm leading-relaxed">
                {sealCompleted
                  ? 'The archive is now permanent and can only be viewed in read-only mode.'
                  : 'The archive is locked while the background seal completes. You can follow its progress from the preservation page.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isFamilyArchive && (
        <div className="mb-10 p-6 rounded-xl border border-warm-border/20 bg-warm-border/5">
          <h3 className="font-serif text-lg text-warm-dark mb-3">Family archive guidance</h3>
          <p className="text-sm text-warm-dark/60 leading-relaxed">
            Family plans use shared stewardship and Cloudflare R2 for video and audio, but Seal Forever on Arweave is reserved for Personal memorials.
          </p>
        </div>
      )}

      {showEmotionalInsights && (
        <div
          className={`mb-10 p-6 rounded-xl border transition-all duration-700 ${
            emotionalState === 'eternal'
              ? 'bg-olive/[0.04] border-olive/20'
              : emotionalState === 'substantial'
                ? 'bg-surface-low border-warm-border/30'
                : 'bg-warm-border/5 border-warm-border/20'
          }`}
        >
          <p className="text-sm text-warm-dark/60 leading-relaxed">
            {completion.message}
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            {(['Facts', 'Body', 'Soul', 'Presence', 'Witnesses'] as const).map((pathName) => {
              const pathSteps: Record<string, number[]> = {
                Facts: [1],
                Body: [2, 3, 4],
                Soul: [5, 6],
                Presence: [8, 9],
                Witnesses: [7],
              };
              const stepsForPath = pathSteps[pathName];
              const pathCompleted = stepsForPath.every((step) =>
                completion.steps.find((entry) => entry.step === step)?.completed
              );
              const pathStarted = stepsForPath.some((step) =>
                completion.steps.find((entry) => entry.step === step)?.completed
              );

              return (
                <div key={pathName} className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      pathCompleted
                        ? 'bg-warm-dark/40'
                        : pathStarted
                          ? 'bg-warm-dark/15'
                          : 'bg-warm-border/40'
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      pathCompleted ? 'text-warm-dark/50' : 'text-warm-dark/25'
                    }`}
                  >
                    {pathName}
                    {pathCompleted ? ' - honored' : pathStarted ? ' - begun' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!canSeal && sealBlockReasons.length > 0 && (
        <div className="mb-10 p-6 rounded-xl border border-warm-border/20 bg-warm-border/5">
          <h3 className="font-serif text-lg text-warm-dark mb-3">Strengthen their legacy</h3>
          <p className="text-xs text-warm-dark/40 mb-4">
            The archive needs more depth before it can be sealed and protected forever.
          </p>
          <ul className="space-y-2">
            {sealBlockReasons.map((reason, index) => (
              <li key={index} className="text-sm text-warm-dark/50 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warm-dark/15 mt-1.5 flex-shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isBlockedBySuccessor && (
        <div className="mb-10 p-6 bg-warm-border/5 border border-warm-brown/20 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warm-brown/10 rounded-full text-warm-brown shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-warm-dark mb-2">Steward Designation Required</h3>
              <p className="text-warm-dark/60 text-sm mb-4 leading-relaxed">
                Since this is your own archive, you must designate an Archive Steward before sealing.
                This ensures your archive is not lost. Your steward will only gain access after verification.
              </p>
              <button
                onClick={() => setShowSuccessorModal(true)}
                className="px-6 py-3 bg-warm-brown text-surface-low rounded-lg font-medium hover:bg-warm-brown/90 transition-all flex items-center gap-2"
              >
                <Users size={18} />
                Designate a Steward
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xs font-medium text-warm-dark/30 uppercase tracking-wider">
          Core Paths
        </h3>
      </div>
      <div className="space-y-3 mb-10">
        {completion.steps
          .filter((section) => section.category === 'core')
          .map((section) => {
            const Icon = STEP_ICONS[section.step] || User;
            return (
              <div
                key={section.step}
                className={`p-5 rounded-xl border transition-all duration-500 ${
                  section.completed
                    ? 'bg-white border-warm-border/20'
                    : 'bg-warm-border/5 border-warm-border/15'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-warm-border/10 flex items-center justify-center">
                    <Icon size={20} className="text-warm-dark/30" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h4 className="font-medium text-warm-dark text-sm">{section.title}</h4>
                        <p className="text-xs text-warm-dark/40 mt-0.5">{section.summary}</p>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-all duration-500 ${
                          section.completed ? 'bg-warm-dark/30' : 'bg-warm-border/30'
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => onJumpToStep(section.step)}
                      className="text-xs text-warm-dark/30 hover:text-warm-dark/50 transition-colors flex items-center gap-1.5 mt-1"
                    >
                      <Edit size={12} />
                      {section.completed ? 'Revisit this path' : 'Answer this silence'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mb-4">
        <h3 className="text-xs font-medium text-warm-dark/30 uppercase tracking-wider flex items-center gap-2">
          <Gift size={12} />
          Optional Enrichments
        </h3>
        <p className="text-[11px] text-warm-dark/20 mt-1">
          These paths are not required. Add them at any time to deepen the archive.
        </p>
      </div>
      <div className="space-y-3 mb-10">
        {completion.steps
          .filter((section) => section.category === 'enrichment')
          .map((section) => {
            const Icon = STEP_ICONS[section.step] || User;
            return (
              <div
                key={section.step}
                className={`p-5 rounded-xl border transition-all duration-500 ${
                  section.completed
                    ? 'bg-white border-warm-border/20'
                    : 'bg-surface-low border-dashed border-warm-border/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-warm-border/10 flex items-center justify-center">
                    <Icon size={20} className="text-warm-dark/25" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h4 className="font-medium text-warm-dark text-sm">{section.title}</h4>
                        <p className="text-xs text-warm-dark/40 mt-0.5">{section.summary}</p>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          section.completed
                            ? 'bg-warm-dark/20'
                            : 'bg-transparent border border-warm-border/30'
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => onJumpToStep(section.step)}
                      className="text-xs text-warm-dark/25 hover:text-warm-dark/40 transition-colors flex items-center gap-1.5 mt-1"
                    >
                      <Edit size={12} />
                      {section.completed ? 'Revisit' : 'Fulfill this absence'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {showEmotionalInsights &&
        emotionalResult.missingDimensions.length > 0 &&
        emotionalState !== 'eternal' && (
          <div className="mb-10 p-5 rounded-xl bg-warm-border/[0.04] border border-warm-border/10">
            <p className="text-xs text-warm-dark/30 mb-3 italic">
              You&apos;ve captured {emotionalResult.fragmentCount} fragments of their life.
              {emotionalResult.missingDimensions.length > 0 && (
                <> {emotionalResult.missingDimensions[0].whisper}</>
              )}
            </p>
          </div>
        )}

      <div className="space-y-4">
        <button
          onClick={() => setShowPreview(true)}
          className="w-full py-4 px-6 bg-white border border-warm-border/30 rounded-xl text-warm-dark/60 font-medium hover:bg-warm-border/5 transition-all flex items-center justify-center gap-2"
        >
          <Eye size={20} />
          Witness what you&apos;ve built
        </button>

        <button
          onClick={handleSeal}
          disabled={isSealing || (!sealLocked && !isSealReady)}
          className={`w-full py-5 px-6 rounded-xl font-medium transition-all duration-500 flex items-center justify-center gap-2 text-lg ${
            sealLocked || isSealReady
              ? 'bg-warm-dark hover:bg-warm-dark/90 text-surface-low seal-ready'
              : 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
          }`}
        >
          <Shield size={20} />
          {primaryButtonLabel}
        </button>

        {isBlockedBySuccessor && (
          <p className="text-xs text-center text-warm-brown/60 font-medium">
            You must designate a steward before sealing
          </p>
        )}

        <button
          onClick={onBack}
          className="w-full py-3 px-6 border border-warm-border/20 rounded-xl hover:bg-warm-border/5 transition-all flex items-center justify-center gap-2 text-warm-dark/40 text-sm"
        >
          <ArrowLeft size={16} />
          Return
        </button>
      </div>

      <div className="mt-8 p-4 bg-warm-border/5 rounded-lg text-center">
        <p className="text-xs text-warm-dark/25">
          Your work is automatically preserved. You can close this page and return anytime.
        </p>
      </div>

      {showPreview && (
        <PreviewModal
          data={data}
          plan={plan}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showSuccessorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-warm-dark/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setShowSuccessorModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-warm-border/20 rounded-full transition-colors z-10"
            >
              <X size={20} className="text-warm-dark/60" />
            </button>
            <div className="max-h-[90vh] overflow-y-auto">
              <SuccessorSettings userId={userId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

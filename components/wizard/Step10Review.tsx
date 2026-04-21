// components/wizard/Step10Review.tsx
// Ritual finalization with emotional state gating
'use client';

import { useState, useEffect } from 'react';
import {
  Edit, Eye, Send, ArrowLeft, User, Home, Briefcase, Heart,
  Sparkles, BookOpen, MessageCircle, Image as ImageIcon, Film,
  Users, Shield, Gift, X
} from 'lucide-react';
import { MemorialData } from '@/types/memorial';
import { calculateCompletion } from '@/lib/completionLogic';
import { createFullSnapshot } from '@/lib/versionService';
import PreviewModal from './PreviewModal';
import SuccessorSettings from '@/components/SuccessorSettings';

interface Step10Props {
  data: MemorialData;
  memorialId: string | null;
  onBack: () => void;
  onJumpToStep: (step: number) => void;
  isSelfArchive?: boolean;
  hasSuccessor?: boolean;
  userId?: string;
  isPaid?: boolean;
  showStatusInsights?: boolean;
}

const STEP_ICONS: Record<number, any> = {
  1: User, 2: Home, 3: Briefcase, 4: Heart,
  5: Sparkles, 6: BookOpen, 7: MessageCircle, 8: ImageIcon, 9: Film,
};

export default function Step10Review({
  data,
  memorialId,
  onBack,
  onJumpToStep,
  isSelfArchive = false,
  hasSuccessor = false,
  userId = '',
  isPaid = false,
  showStatusInsights = true
}: Step10Props) {
  const [isSealing, setIsSealing] = useState(false);
  const [sealPhase, setSealPhase] = useState<'idle' | 'review' | 'pause' | 'sealing' | 'sealed'>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessorModal, setShowSuccessorModal] = useState(false);

  const completion = calculateCompletion(data);
  const { canSeal, sealBlockReasons, emotionalState, emotionalResult } = completion;

  const isBlockedBySuccessor = isSelfArchive && !hasSuccessor;
  const isSealReady = canSeal && !isBlockedBySuccessor;

  // Ritual: 3-phase seal sequence
  const handleSeal = async () => {
    if (!isSealReady) return;

    // Phase 1: Review moment
    setSealPhase('review');

    // Phase 2: Intentional pause (2.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSealPhase('pause');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Phase 3: Seal
    setSealPhase('sealing');
    setIsSealing(true);

    if (memorialId) {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await createFullSnapshot({
        memorialId,
        data,
        userId: user?.id || undefined,
        userName: 'Owner',
        changeSummary: 'Archive sealed — protected forever',
        changeReason: 'archive_seal',
        changeType: 'manual',
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    setSealPhase('sealed');
    await new Promise(resolve => setTimeout(resolve, 800));

    if (isPaid) {
      // Already paid — go directly to success
      window.location.href = '/success';
    } else {
      // Draft — proceed to payment to protect the archive
      const sealUrl = memorialId
        ? `/seal-confirmation?memorialId=${memorialId}`
        : '/seal-confirmation';
      window.location.href = sealUrl;
    }
  };

  // Depth labels for paths
  const depthLabel = (depth: string) => {
    switch (depth) {
      case 'embodied': return 'Honored';
      case 'meaningful': return 'Growing deeper';
      case 'shallow': return 'Their story stirs';
      default: return 'Awaiting your voice';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Ritual overlay */}
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
                  What you seal will be protected forever.
                </p>
              </div>
            )}
            {sealPhase === 'sealing' && (
              <div className="animate-fadeIn">
                <div className="w-12 h-12 mx-auto mb-6 border-2 border-surface-low/20 border-t-surface-low/70 rounded-full animate-spin" />
                <p className="font-serif text-xl text-surface-low/80">
                  Sealing the archive...
                </p>
              </div>
            )}
            {sealPhase === 'sealed' && (
              <div className="animate-fadeIn">
                <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-olive/20 flex items-center justify-center">
                  <Shield size={24} className="text-surface-low/80" />
                </div>
                <p className="font-serif text-xl text-surface-low/90">
                  Protected.
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
          Look over what you have built. When you are ready, seal the archive.
        </p>
      </div>

      {/* Emotional state message */}
      {showStatusInsights && (
      <div className={`mb-10 p-6 rounded-xl border transition-all duration-700 ${
        emotionalState === 'eternal'
          ? 'bg-olive/[0.04] border-olive/20'
          : emotionalState === 'substantial'
            ? 'bg-surface-low border-warm-border/30'
            : 'bg-warm-border/5 border-warm-border/20'
      }`}>
        <p className="text-sm text-warm-dark/60 leading-relaxed">
          {completion.message}
        </p>

        {/* Path depth indicators */}
        <div className="flex flex-wrap gap-3 mt-4">
          {(['Facts', 'Body', 'Soul', 'Presence', 'Witnesses'] as const).map((pathName) => {
            const pathSteps: Record<string, number[]> = {
              Facts: [1], Body: [2, 3, 4], Soul: [5, 6], Presence: [8, 9], Witnesses: [7]
            };
            const stepsForPath = pathSteps[pathName];
            const pathCompleted = stepsForPath.every(s =>
              completion.steps.find(st => st.step === s)?.completed
            );
            const pathStarted = stepsForPath.some(s =>
              completion.steps.find(st => st.step === s)?.completed
            );

            return (
              <div key={pathName} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  pathCompleted ? 'bg-warm-dark/40' : pathStarted ? 'bg-warm-dark/15' : 'bg-warm-border/40'
                }`} />
                <span className={`text-xs ${
                  pathCompleted ? 'text-warm-dark/50' : 'text-warm-dark/25'
                }`}>
                  {pathName}{pathCompleted ? ' — honored' : pathStarted ? ' — begun' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Seal block reasons — gentle, not punishing */}
      {!canSeal && sealBlockReasons.length > 0 && (
        <div className="mb-10 p-6 rounded-xl border border-warm-border/20 bg-warm-border/5">
          <h3 className="font-serif text-lg text-warm-dark mb-3">Strengthen their legacy</h3>
          <p className="text-xs text-warm-dark/40 mb-4">
            The archive needs more depth before it can be sealed and protected forever.
          </p>
          <ul className="space-y-2">
            {sealBlockReasons.map((reason, i) => (
              <li key={i} className="text-sm text-warm-dark/50 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warm-dark/15 mt-1.5 flex-shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SELF-ARCHIVE SUCCESSOR WARNING */}
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

      {/* CORE PATHS */}
      <div className="mb-4">
        <h3 className="text-xs font-medium text-warm-dark/30 uppercase tracking-wider">
          Core Paths
        </h3>
      </div>
      <div className="space-y-3 mb-10">
        {completion.steps
          .filter(s => s.category === 'core')
          .map((section) => {
            const Icon = STEP_ICONS[section.step] || User;
            return (
              <div
                key={section.step}
                className={`p-5 rounded-xl border transition-all duration-500 ${section.completed
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
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-all duration-500 ${
                        section.completed ? 'bg-warm-dark/30' : 'bg-warm-border/30'
                      }`} />
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

      {/* ENRICHMENT SECTIONS */}
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
          .filter(s => s.category === 'enrichment')
          .map((section) => {
            const Icon = STEP_ICONS[section.step] || User;
            return (
              <div
                key={section.step}
                className={`p-5 rounded-xl border transition-all duration-500 ${section.completed
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
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        section.completed ? 'bg-warm-dark/20' : 'bg-transparent border border-warm-border/30'
                      }`} />
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

      {/* Missing dimensions whisper */}
      {showStatusInsights && emotionalResult.missingDimensions.length > 0 && emotionalState !== 'eternal' && (
        <div className="mb-10 p-5 rounded-xl bg-warm-border/[0.04] border border-warm-border/10">
          <p className="text-xs text-warm-dark/30 mb-3 italic">
            You&apos;ve captured {emotionalResult.fragmentCount} fragments of their life.
            {emotionalResult.missingDimensions.length > 0 && (
              <> {emotionalResult.missingDimensions[0].whisper}</>
            )}
          </p>
        </div>
      )}

      {/* ACTION BUTTONS */}
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
          disabled={isSealing || !isSealReady}
          className={`w-full py-5 px-6 rounded-xl font-medium transition-all duration-500 flex items-center justify-center gap-2 text-lg ${
            !isSealReady
              ? 'bg-warm-border/20 text-warm-dark/30 cursor-not-allowed'
              : 'bg-warm-dark hover:bg-warm-dark/90 text-surface-low seal-ready'
          }`}
        >
          <Shield size={20} />
          {isSealReady ? 'Seal the Archive' : 'Strengthen their legacy'}
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

      {/* Auto-preserve note */}
      <div className="mt-8 p-4 bg-warm-border/5 rounded-lg text-center">
        <p className="text-xs text-warm-dark/25">
          Your work is automatically preserved. You can close this page and return anytime.
        </p>
      </div>

      {showPreview && (
        <PreviewModal
          data={data}
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

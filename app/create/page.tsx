// app/create/page.tsx - COMPLETE FILE WITH MOBILE FIX
'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Shield, Users, User, History, Lock } from 'lucide-react';
import PreviewModal from '@/components/wizard/PreviewModal';
import { Panel, Group, Separator } from 'react-resizable-panels';
import PathCard from '@/components/wizard/PathCard';
import MemorialRenderer from '@/components/MemorialRenderer';
import { getPathStatus } from '@/lib/paths-logic';
import Step1BasicInfo from '@/components/wizard/Step1BasicInfo';
import Step2Childhood from '@/components/wizard/Step2Childhood';
import Step3Career from '@/components/wizard/Step3Career';
import Step4Relationships from '@/components/wizard/Step4Relationships';
import Step5Personality from '@/components/wizard/Step5Personality';
import Step6LifeStory from '@/components/wizard/Step6LifeStory';
import Step7Memories from '@/components/wizard/Step7Memories';
import Step8Media from '@/components/wizard/Step8Media';
import Step9Videos from '@/components/wizard/Step9Videos';
import Step10Review from '@/components/wizard/Step10Review';
import TutorialPopup from '@/components/TutorialPopup';
import VersionHistory from '@/components/VersionHistory';
import toast from 'react-hot-toast';
import { getPlanDashboardPath } from '@/components/providers/AuthProvider';
import {
  MemorialData,
  BasicInfo,
  ChildhoodInfo,
  CareerEducation,
  RelationshipsFamily,
  PersonalityValues,
  LifeStory,
  MemoriesStories,
  MediaLegacy,
  VideoContent,
  TOTAL_STEPS,
  WitnessRole
} from '@/types/memorial';
import { PathId } from '@/types/paths';
import { createClient } from '@/utils/supabase/client';
import { calculateEmotionalState, getPathDepth, isEmotionalStateEnabled } from '@/lib/emotionalState';
import { hasPendingMemorialMedia, serializeMemorialDataForSave } from '@/lib/memorialSave';
import { getMemorialSaveSignature } from '@/lib/versioning';
import { getApiErrorMessage, parseApiPayload } from '@/lib/apiResponse';

const PATH_CONFIG: Record<PathId, { steps: number[]; labels: string[] }> = {
  facts: {
    steps: [1],
    labels: ['Basic Info']
  },
  body: {
    steps: [2, 3, 4],
    labels: ['Childhood', 'Career', 'Relationships']
  },
  soul: {
    steps: [5, 6],
    labels: ['Personality', 'Life Story']
  },
  presence: {
    steps: [8, 9],
    labels: ['Photos', 'Videos']
  },
  witnesses: {
    steps: [7],
    labels: ['Memories']
  }
};

const getInitialData = (): MemorialData => ({
  step1: {
    fullName: '',
    birthDate: '',
    deathDate: null,
    isStillLiving: false,
    isSelfArchive: false, // NEW: Default to false
    privateUntilDeath: false, // NEW: Default to false
    birthPlace: '',
    deathPlace: '',
    profilePhoto: null,
    profilePhotoPreview: null,
    epitaph: '',
  },
  step2: {
    childhoodHome: '',
    familyBackground: '',
    schools: {
      elementary: '',
      highSchool: '',
      college: '',
      additionalEducation: '',
    },
    childhoodPersonality: [],
    earlyInterests: [],
    childhoodPhotos: [],
  },
  step3: {
    occupations: [],
    careerHighlights: [],
    education: {
      major: '',
      graduationYear: '',
      honors: '',
    },
  },
  step4: {
    partners: [],
    children: [],
    majorLifeEvents: [],
  },
  step5: {
    personalityTraits: [],
    coreValues: [],
    passions: [],
    lifePhilosophy: '',
    favoriteQuotes: [],
    memorableSayings: [],
  },
  step6: {
    biography: '',
    lifeChapters: [],
  },
  step7: {
    sharedMemories: [],
    impactStories: [],
    invitedEmails: [],
    witnessPersonalMessage: '',
    sentInvitations: [],
  },
  step8: {
    coverPhoto: null,
    coverPhotoPreview: null,
    gallery: [],
    interactiveGallery: [],
    voiceRecordings: [],
    legacyStatement: '',
  },
  step9: {
    videos: [],
  },
  currentStep: 1,
  paid: false,
  lastSaved: new Date().toISOString(),
  completedSteps: [],
});

function CreateMemorialPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memorialId = searchParams.get('id');

  const [memorialData, setMemorialData] = useState<MemorialData>(getInitialData());
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saved' | 'saving' | 'error'>('saved');
  const [currentMemorialId, setCurrentMemorialId] = useState<string | null>(memorialId);
  // Track the memorial's actual mode from the database, so auto-save never overwrites it
  const [dbMode, setDbMode] = useState<string | null>(null);
  const [memorialOwnerId, setMemorialOwnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!memorialId);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userRole, setUserRole] = useState<WitnessRole>('owner'); // Default to owner
  const [hasSuccessor, setHasSuccessor] = useState(false); // NEW: Track if user has a successor

  // Keep a stable snapshot so restores and saves stay aligned
  const stepEntryDataRef = useRef<MemorialData>(getInitialData());
  const lastSavedSignatureRef = useRef(getMemorialSaveSignature(getInitialData()));
  const memorialDataRef = useRef<MemorialData>(getInitialData());
  const currentMemorialIdRef = useRef<string | null>(memorialId);
  const authUserIdRef = useRef<string | null>(null);
  const dbModeRef = useRef<string | null>(null);
  const memorialOwnerIdRef = useRef<string | null>(null);
  const userRoleRef = useRef<WitnessRole>('owner');
  const isSaveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const activeSavePromiseRef = useRef<Promise<void> | null>(null);
  const previousPendingMediaRef = useRef(false);

  // Track the authenticated user ID
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    memorialDataRef.current = memorialData;
    currentMemorialIdRef.current = currentMemorialId;
    authUserIdRef.current = authUserId;
    dbModeRef.current = dbMode;
    memorialOwnerIdRef.current = memorialOwnerId;
    userRoleRef.current = userRole;
  }, [memorialData, currentMemorialId, authUserId, dbMode, memorialOwnerId, userRole]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthUserId(user.id);
        // Send heartbeat
        fetch('/api/user/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(console.error);
      }
    });
  }, []);

  // FIX: Create an empty memorial immediately on page load when no ID exists.
  // This ensures memorialId is always available for autosave and media uploads.
  useEffect(() => {
    if (currentMemorialId || !authUserId) return;

    const createEmptyMemorial = async () => {
      try {
        const supabase = createClient();
        const rawMode = searchParams.get('mode') || 'personal';
        // DB constraint allows 'personal', 'family', or 'draft'
        const currentMode = rawMode === 'family' ? 'family' : rawMode === 'draft' ? 'draft' : 'personal';

        // SECURITY: If user's plan is already family, don't allow creating personal memorials.
        // This prevents exploitation via browser back button after upgrade.
        if (currentMode === 'personal') {
          const { data: existingFamily } = await supabase
            .from('memorials')
            .select('id')
            .eq('user_id', authUserId)
            .eq('mode', 'family')
            .eq('paid', true)
            .limit(1);
          if (existingFamily && existingFamily.length > 0) {
            router.replace(`/dashboard/family/${authUserId}`);
            return;
          }
        }

        const { data, error } = await supabase
          .from('memorials')
          .insert({
            user_id: authUserId,
            status: 'draft',
            mode: currentMode,
            slug: `draft-${Date.now()}`,
            paid: false,
            step1: memorialData.step1,
            step2: memorialData.step2,
            step3: memorialData.step3,
            step4: memorialData.step4,
            step5: memorialData.step5,
            step6: memorialData.step6,
            step7: memorialData.step7,
            step8: memorialData.step8,
            step9: memorialData.step9,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setCurrentMemorialId(data.id);
          setDbMode(currentMode);
          setMemorialOwnerId(authUserId);
          window.history.replaceState({}, '', `/create?id=${data.id}&mode=${currentMode}`);
        }
      } catch (err) {
        console.error('Failed to create empty memorial:', err);
      }
    };

    createEmptyMemorial();
  }, [authUserId, currentMemorialId]);

  // 1. CAPTURE THE MODE — use DB mode when available (prevents URL param spoofing)
  const mode = searchParams.get('mode') || 'personal';
  const effectiveMode = dbMode || mode;
  // Personal & Family modes = user already paid for the plan → full access
  const isPaidMode = effectiveMode === 'personal' || effectiveMode === 'family' || effectiveMode === 'concierge';
  const hasFullAccess = isPaidMode || memorialData.paid;
  const showDraftStatusInsights = effectiveMode === 'draft';

  const isMemorialOwner = !!authUserId && memorialOwnerId === authUserId;
  // Determine the correct dashboard path based on the memorial's actual mode.
  // Non-owners editing someone else's archive exit back to that archive's context.
  const dashboardPath = authUserId
    ? (authUserId && memorialOwnerId && !isMemorialOwner && currentMemorialId
        ? `/archive/${currentMemorialId}`
        : getPlanDashboardPath(effectiveMode, authUserId))
    : '/dashboard';

  // 2. HELPER FOR BADGE UI — Step 1.1.1: Warm, human draft banner
  const ModeBadge = () => (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${effectiveMode === 'family' || effectiveMode === 'concierge'
      ? 'bg-warm-brown/10 text-warm-brown border-warm-brown/20'
      : effectiveMode === 'draft'
        ? 'bg-warm-border/10 text-warm-muted border-warm-border/30'
        : 'bg-olive/10 text-olive border-olive/20'
      }`}>
      {effectiveMode === 'family' || effectiveMode === 'concierge' ? <Users size={12} /> : <User size={12} />}
      <span className="uppercase tracking-wider">
        {effectiveMode === 'concierge'
          ? 'Concierge Archive'
          : effectiveMode === 'family'
            ? 'Family Archive'
            : effectiveMode === 'draft'
              ? 'Private Preview'
              : 'Personal Archive'}
      </span>
    </div>
  );

  // Step 1.1.1: Draft banner — warm, reassuring, no urgency
  const DraftBanner = () => {
    if (hasFullAccess) return null;
    return (
      <div className="bg-warm-border/15 border border-warm-border/25 rounded-xl px-5 py-3 flex items-start gap-3 max-w-2xl mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-outline mt-0.5 flex-shrink-0"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
        <p className="text-xs text-warm-outline leading-relaxed">
          This is your private preview. The archive will remain private until you choose permanent preservation. Take all the time you need.
        </p>
      </div>
    );
  };

  // Step 1.1.2: Contextual supportive messages by path
  const PATH_MESSAGES: Record<PathId, string> = {
    facts: 'Facts are the skeleton of memory. Fill in what you know, leave blank what you don\u2019t. You can always return.',
    body: 'Images are proof of existence. Even a blurry photo is a treasure.',
    soul: 'This is where the person comes back to life. Write as you would speak to someone who never knew them.',
    presence: 'This is what the world will see. Take a moment to look.',
    witnesses: 'Every witness carries a fragment. Together, they restore the whole.',
  };

  // Step 1.1.4: Pause and come back later state
  const [showPauseModal, setShowPauseModal] = useState(false);

  const handlePauseAndLeave = async (sendReminder: boolean) => {
    // Save current state
    await saveToSupabase();

    if (sendReminder && currentMemorialId) {
      try {
        await fetch('/api/reminder/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memorialId: currentMemorialId,
            fullName: memorialData.step1.fullName || 'your archive',
            delayDays: 7,
          }),
        });
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
    }

    setShowPauseModal(false);
    router.replace(dashboardPath);
  };

  // Browser back button: redirect to correct dashboard based on mode
  useEffect(() => {
    const handlePopState = () => {
      // Replace current history entry with correct dashboard so user lands in the right place
      window.location.replace(dashboardPath);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dashboardPath]);

  // Mobile Detection State
  const [isMobile, setIsMobile] = useState(true); // Default to true (mobile-first) prevents flicker

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 1024);
    checkScreen(); // Check immediately
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Hub View States
  const [viewMode, setViewMode] = useState<'hub' | 'path'>('hub');
  const [activePath, setActivePath] = useState<PathId | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!memorialId) return;

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in? Middleware might catch this, but safe to redirect
        return;
      }

      // 1. Fetch the memorial to see who owns it
      const { data: memorial } = await supabase
        .from('memorials')
        .select('user_id')
        .eq('id', memorialId)
        .single();

      if (memorial) {
        if (memorial.user_id === user.id) {
          setUserRole('owner');
        } else {
          const { data: roleRow } = await supabase
            .from('user_memorial_roles')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (roleRow?.role) {
            setUserRole(roleRow.role as WitnessRole);
          } else {
            toast.error('You do not have permission to view this archive.');
            router.replace('/dashboard');
            return;
          }
        }

        // Handle loading the memorial and step param
        loadMemorial(memorialId).then(() => {
          // Handle step param from Three Doors or direct links
          const stepParam = searchParams.get('step');
          if (stepParam) {
            const stepNum = parseInt(stepParam, 10);
            if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= 10) {
              // Map step number to path
              const stepToPathMap: Record<number, PathId> = {
                1: 'facts',
                2: 'body', 3: 'body', 4: 'body',
                5: 'soul', 6: 'soul',
                7: 'witnesses',
                8: 'presence', 9: 'presence',
              };
              const targetPath = stepToPathMap[stepNum];
              if (targetPath) {
                setActivePath(targetPath);
                setMemorialData(prev => ({ ...prev, currentStep: stepNum }));
                setViewMode('path');
              }
            }
          }
        });
      }
    };

    checkPermissions();
  }, [memorialId, searchParams, router]);

  // Auth is now handled by middleware — no temp user creation needed

  // Check for successor on mount
  useEffect(() => {
    if (!authUserId) return;
    const checkSuccessor = async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from('user_successors')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId);

      setHasSuccessor(!!count && count > 0);
    };
    checkSuccessor();
  }, [authUserId]);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('ulumae-tutorial-completed');
    if (!memorialId && !hasSeenTutorial) {
      setTimeout(() => {
        setShowTutorial(true);
      }, 500);
    }
  }, [memorialId]);

  const handlePathClick = (pathId: PathId) => {
    setActivePath(pathId);

    const pathToStepMap: Record<PathId, number> = {
      facts: 1,
      body: 2,
      soul: 5,
      presence: 8,
      witnesses: 7
    };

    setMemorialData(prev => ({ ...prev, currentStep: pathToStepMap[pathId] }));
    setViewMode('path');
  };

  const tutorialSteps = [
    {
      target: '[data-tutorial="Fulle-Name"]',
      title: 'Start Your Legacy',
      description: 'The full name is where the memorial begins, creating a space dedicated to the person being honored.',
      position: 'bottom' as const,
    },
    {
      target: '[data-tutorial="preview-button"]',
      title: 'Preview Your Memorial',
      description: 'As you add information, you can click "Preview Live Page" at any time to see how your memorial will look to visitors. This helps ensure everything appears exactly as you envision.',
      position: 'bottom' as const,
    },
    {
      target: '[data-tutorial="save-continue"]',
      title: 'Preserve Your Work',
      description: 'Click "Preserve & continue" at the bottom to move to the next step. Your work is automatically preserved.',
      position: 'top' as const,
    },
  ];

  const handleTutorialComplete = () => {
    localStorage.setItem('ulumae-tutorial-completed', 'true');
    setShowTutorial(false);
  };

  const handleTutorialSkip = () => {
    localStorage.setItem('ulumae-tutorial-completed', 'true');
    setShowTutorial(false);
  };

  const loadMemorial = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/memorials/${id}/state`, {
        cache: 'no-store',
      });
      const { data: payload } = await parseApiPayload<{
        error?: string;
        memorial?: {
          id: string;
          userId: string;
          mode: string | null;
          paid: boolean;
          updatedAt: string | null;
          completedSteps: number[];
        };
        memorialData?: MemorialData;
      }>(response);

      if (!response.ok || !payload?.memorialData || !payload?.memorial) {
        const message = getApiErrorMessage(response, payload, 'Failed to load archive');

        if (response.status === 404) {
          setCurrentMemorialId(null);
          setMemorialData(getInitialData());
        }

        throw new Error(message);
      }

      const { memorial, memorialData: normalizedData } = payload;

      if (normalizedData) {
        setMemorialOwnerId(memorial.userId || null);
        const initial = getInitialData();
        const loadedData: MemorialData = {
          ...initial,
          ...normalizedData,
          step1: { ...initial.step1, ...(normalizedData.step1 || {}) },
          step2: { ...initial.step2, ...(normalizedData.step2 || {}) },
          step3: { ...initial.step3, ...(normalizedData.step3 || {}) },
          step4: { ...initial.step4, ...(normalizedData.step4 || {}) },
          step5: { ...initial.step5, ...(normalizedData.step5 || {}) },
          step6: { ...initial.step6, ...(normalizedData.step6 || {}) },
          step7: { ...initial.step7, ...(normalizedData.step7 || {}) },
          step8: { ...initial.step8, ...(normalizedData.step8 || {}) },
          step9: { ...initial.step9, ...(normalizedData.step9 || {}) },
          paid: memorial.paid || normalizedData.paid || false,
          currentStep: 1,
          lastSaved: memorial.updatedAt || normalizedData.lastSaved,
          completedSteps: memorial.completedSteps || normalizedData.completedSteps || [],
        };
        setMemorialData(loadedData);
        setCurrentMemorialId(id);
        if (memorial.mode) {
          setDbMode(memorial.mode);
        }
        stepEntryDataRef.current = structuredClone(loadedData);
        lastSavedSignatureRef.current = getMemorialSaveSignature(loadedData);
      }
    } catch (error) {
      console.warn('Memorial load skipped:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const canEditStep = (stepNumber: number) => {
    if (userRole === 'owner' || userRole === 'co_guardian') return true;
    const contributionSteps = [7, 8, 9];
    return contributionSteps.includes(stepNumber);
  };

  useEffect(() => {
    const saveTimer = setTimeout(() => {
      saveToSupabase();
    }, 1000);
    return () => clearTimeout(saveTimer);
  }, [memorialData]);

  useEffect(() => {
    if (isLoading) return;

    const currentSignature = getMemorialSaveSignature(memorialData);
    const hasPendingMedia = hasPendingMemorialMedia(memorialData);

    if (hasPendingMedia || currentSignature !== lastSavedSignatureRef.current) {
      setSaveStatus(isSaveInFlightRef.current ? 'saving' : 'unsaved');
      return;
    }

    setSaveStatus(isSaveInFlightRef.current ? 'saving' : 'saved');
  }, [isLoading, memorialData]);

  useEffect(() => {
    if (isLoading) return;

    const hasPendingMedia = hasPendingMemorialMedia(memorialData);
    const hadPendingMedia = previousPendingMediaRef.current;
    previousPendingMediaRef.current = hasPendingMedia;

    if (!hadPendingMedia || hasPendingMedia) {
      return;
    }

    const currentSignature = getMemorialSaveSignature(memorialData);
    if (currentSignature === lastSavedSignatureRef.current) {
      return;
    }

    void saveToSupabase();
  }, [isLoading, memorialData]);

  // Prevent data loss: warn if the user tries to close the tab while a save
  // is still pending or errored. The 'saved' state is silent so we don't nag.
  useEffect(() => {
    if (saveStatus !== 'unsaved' && saveStatus !== 'saving' && saveStatus !== 'error') {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  const saveToSupabase = async () => {
    if (isSaveInFlightRef.current) {
      saveQueuedRef.current = true;
      return activeSavePromiseRef.current ?? Promise.resolve();
    }

    const executeSave = async () => {
      isSaveInFlightRef.current = true;

      try {
        const currentData = memorialDataRef.current;
        if (!currentData.step1.fullName) return;

        // --- NEW PERMISSION CHECK ---
        if (userRoleRef.current !== 'owner' && userRoleRef.current !== 'co_guardian') {
          // Witnesses do not auto-save the main record.
          // Their changes are handled via the Approval System (Step 2.1.5)
          return;
        }
        // ----------------------------

        const currentAuthUserId = authUserIdRef.current;
        if (!currentAuthUserId) {
          console.log("Waiting for authenticated user...");
          return;
        }

        const serializableData = serializeMemorialDataForSave(currentData);
        const saveSignature = getMemorialSaveSignature(currentData);
        if (saveSignature === lastSavedSignatureRef.current) {
          return;
        }

        setSaveStatus('saving');

        const slug = generateSlug(currentData.step1.fullName);
        // Use the DB mode if we loaded from an existing memorial (prevents overwriting family→personal)
        // Only fall back to URL param for brand new memorials
        const rawMode = dbModeRef.current || searchParams.get('mode') || 'personal';
        // DB constraint allows 'personal', 'family', or 'draft'
        const currentMode = rawMode === 'family' ? 'family' : rawMode === 'draft' ? 'draft' : 'personal';
        const currentMemorialIdValue = currentMemorialIdRef.current;

        const memorialRecord: Record<string, any> = {
          step1: serializableData.step1,
          step2: serializableData.step2,
          step3: serializableData.step3,
          step4: serializableData.step4,
          step5: serializableData.step5,
          step6: serializableData.step6,
          step7: serializableData.step7,
          step8: serializableData.step8,
          step9: serializableData.step9,
          status: 'draft',
          slug: slug || currentMemorialIdValue || 'untitled',
          full_name: currentData.step1.fullName,
          birth_date: currentData.step1.birthDate ? currentData.step1.birthDate : null,
          death_date: currentData.step1.deathDate ? currentData.step1.deathDate : null,
          profile_photo_url: serializableData.step1.profilePhotoPreview || null,
          cover_photo_url: serializableData.step8?.coverPhotoPreview || null,
          completed_steps: serializableData.completedSteps || [],
          mode: currentMode,
          user_id: currentMemorialIdValue ? (memorialOwnerIdRef.current || currentAuthUserId) : currentAuthUserId,
          paid: serializableData.paid ?? false,
          updated_at: new Date().toISOString(),
        };

        // Only include id if we already have one (for updates)
        if (currentMemorialIdValue) {
          memorialRecord.id = currentMemorialIdValue;
        }

        let data, error;
        if (currentMemorialIdValue) {
          const response = await fetch(`/api/memorials/${currentMemorialIdValue}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memorialData: serializableData }),
          });
          const payload = await response.json().catch(() => null);
          data = payload?.memorial || null;
          error = response.ok ? null : { message: payload?.error || 'Save failed' };
        } else {
          const supabase = createClient();
          // Insert new memorial
          const result = await supabase
            .from('memorials')
            .insert(memorialRecord)
            .select()
            .single();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;

        if (data && !currentMemorialIdValue) {
          setCurrentMemorialId(data.id);
          setMemorialOwnerId(currentAuthUserId);
          window.history.replaceState({}, '', `/create?id=${data.id}&mode=${currentMode}`);
        }

        lastSavedSignatureRef.current = saveSignature;

        const latestData = memorialDataRef.current;
        const latestSignature = getMemorialSaveSignature(latestData);
        const latestHasPendingMedia = hasPendingMemorialMedia(latestData);
        setSaveStatus(latestHasPendingMedia || latestSignature !== lastSavedSignatureRef.current ? 'unsaved' : 'saved');
      } catch (error: any) {
        console.error('Save error:', error?.message || error?.code || JSON.stringify(error));
        setSaveStatus('error');
      } finally {
        isSaveInFlightRef.current = false;
        activeSavePromiseRef.current = null;

        if (saveQueuedRef.current) {
          saveQueuedRef.current = false;
          await saveToSupabase();
        }
      }
    };

    const savePromise = executeSave();
    activeSavePromiseRef.current = savePromise;
    return savePromise;
  };

  const goToPreviousStep = () => {
    if (memorialData.currentStep > 1) {
      setMemorialData(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      // Map step number to its parent path
      const stepToPath: Record<number, PathId> = {
        1: 'facts', 2: 'body', 3: 'body', 4: 'body',
        5: 'soul', 6: 'soul', 7: 'witnesses', 8: 'presence', 9: 'presence',
      };
      const targetPath = stepToPath[step] || null;

      setMemorialData(prev => ({
        ...prev,
        currentStep: step,
        completedSteps: prev.completedSteps.filter(
          completedStep => completedStep < step
        ),
      }));

      // If jumping from Step 10, navigate into the correct path
      if (targetPath) {
        setActivePath(targetPath);
        setViewMode('path');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateStep1 = (data: BasicInfo) => {
    setMemorialData(prev => ({
      ...prev,
      step1: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep2 = (data: ChildhoodInfo) => {
    setMemorialData(prev => ({
      ...prev,
      step2: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep3 = (data: CareerEducation) => {
    setMemorialData(prev => ({
      ...prev,
      step3: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep4 = (data: RelationshipsFamily) => {
    setMemorialData(prev => ({
      ...prev,
      step4: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep5 = (data: PersonalityValues) => {
    setMemorialData(prev => ({
      ...prev,
      step5: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep6 = (data: LifeStory) => {
    setMemorialData(prev => ({
      ...prev,
      step6: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep7 = (data: MemoriesStories) => {
    setMemorialData(prev => ({
      ...prev,
      step7: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep8 = (data: MediaLegacy) => {
    setMemorialData(prev => ({
      ...prev,
      step8: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const updateStep9 = (data: VideoContent) => {
    setMemorialData(prev => ({
      ...prev,
      step9: data,
      lastSaved: new Date().toISOString(),
    }));
  };

  const handlePayment = async () => {
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memorialId: currentMemorialId,
          plan: 'Personal',
          amount: 1470,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error("Payment trigger failed:", err);
      toast.error('Could not connect to payment gateway. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-olive/30 border-t-olive rounded-full animate-spin mx-auto mb-4" />
          <p className="text-warm-muted">Loading archive...</p>
        </div>
      </div>
    );
  }

  const completedPathsCount = ['facts', 'body', 'soul'].filter(
    id => getPathStatus(memorialData, id as PathId) === 'completed'
  ).length;

  // Emotional state engine — drives ambient messaging, visual tone, and seal gating
  const emotionalResult = calculateEmotionalState(memorialData, effectiveMode);
  const emotionalStateEnabled = isEmotionalStateEnabled(effectiveMode);

  const submitContribution = async (type: 'memory' | 'photo' | 'video', content: any) => {
    // Security check
    if (userRole !== 'witness' || !currentMemorialId) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('memorial_contributions')
        .insert([{
          memorial_id: currentMemorialId,
          user_id: authUserId,
          witness_name: "A Witness", // We will improve the name retrieval later
          type: type,
          content: content,
          status: 'pending_approval'
        }]);

      if (error) throw error;
      toast.success('Contribution offered. The archive guardian will review it shortly.');

    } catch (err: any) {
      console.error("Error submitting contribution:", err);
      toast.error(`Could not offer contribution: ${err.message}`);
    }
  };

  const isSelf = memorialData.step1.isSelfArchive;
  const isPrivate = memorialData.step1.privateUntilDeath; // Helper

  const texts = {
    header: isSelf ? "Your Legacy Archive" : "The Crossroads",
    subHeader: isSelf
      ? (isPrivate
        ? "This archive is private. It will remain accessible only to you until the succession process is triggered."
        : "You are creating your own permanent record. You can choose to share this at any time.")
      : mode === 'family'
        ? "This is a shared space to preserve your family's heritage."
        : "A private sanctuary to honor a unique life.",
    cards: {
      facts: isSelf
        ? "Your birth, origins, and vital details."
        : "Birth, death, and the proof of existence. The foundation of the memory.",
      body: isSelf
        ? "Your childhood, career, and the family you built."
        : "Eras of life, from childhood to career and the families built along the way.",
      soul: isSelf
        ? "Your personality, values, and your full life story."
        : "Personality, traits, and the full life story. Who they were in essence.",
      witnesses: isSelf
        ? "Invite friends and family to share their memories of you."
        : (mode === 'family'
          ? "Centralize the family's stories. Invite members to build this archive together."
          : "Invite close friends to share memories. Entirely optional and moderated by you."),
      presence: isSelf
        ? "Your photos, videos, and your voice for the future."
        : "Photos, videos, and the return of the voice."
    }
  };

  // Step 1.3.3: Determine if all paths traveled — center space fills with name
  const allPathsTraveled = (['facts', 'body', 'soul', 'witnesses', 'presence'] as PathId[]).every(
    id => getPathStatus(memorialData, id, mode) === 'completed'
  );
  const somePathsTraveled = (['facts', 'body', 'soul'] as PathId[]).some(
    id => getPathStatus(memorialData, id) !== 'empty'
  );

  return (
    <div className="min-h-screen bg-surface-low relative">
      {viewMode === 'hub' ? (
        /* --- THE HUB VIEW (The Crossroads) — Step 1.3.3: Contemplation Space --- */
        <div className="max-w-6xl mx-auto px-6 py-20">
          {/* Back to Dashboard — proper navigation instead of browser back */}
          <div className="mb-6">
            <button
              onClick={() => router.replace(dashboardPath)}
              className="inline-flex items-center gap-2 text-warm-outline hover:text-warm-dark transition-colors text-sm"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Step 1.1.1: Draft Banner */}
          <DraftBanner />

          <div className="text-center mb-16">
            {/* Badge */}
            <div className="flex justify-center gap-3 mb-4">
              <ModeBadge />
              {emotionalStateEnabled && emotionalResult.state && emotionalResult.state !== 'void' && (
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-all duration-1000 ${
                  emotionalResult.state === 'eternal'
                    ? 'bg-olive/10 text-olive border-olive/20'
                    : emotionalResult.state === 'substantial'
                      ? 'bg-warm-dark/5 text-warm-dark/50 border-warm-dark/10'
                      : emotionalResult.state === 'emerging'
                        ? 'bg-olive/5 text-olive/60 border-olive/10'
                        : 'bg-warm-border/10 text-warm-muted border-warm-border/20'
                }`}>
                  <span className="uppercase tracking-wider">{emotionalResult.state}</span>
                </div>
              )}
            </div>

            {/* PRIVATE STATUS BADGE */}
            {memorialData.step1.privateUntilDeath && (
              <div className="flex justify-center mb-6 animate-fadeIn">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-warm-dark text-warm-bg rounded-full text-xs font-bold tracking-wide shadow-md border border-surface-low/20">
                  <Lock size={12} />
                  LOCKED: PRIVATE UNTIL DEATH
                </div>
              </div>
            )}

            {/* Dynamic Header */}
            <h1 className="font-serif text-5xl text-warm-dark mb-4">
              {texts.header}
            </h1>


            {/* Version History Button */}
            {currentMemorialId && isMemorialOwner && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-warm-border/30 rounded-lg hover:bg-warm-border/10 transition-all text-xs text-warm-muted"
                >
                  <History size={14} />
                  <span className="hidden sm:inline">History</span>
                </button>
            )}

            {false && (
              <>
            {/* NEW: ZIP EXPORT BUTTON */}
            <button
              onClick={async () => {
                if (!currentMemorialId) return;
                try {
                  // Show some loading state if you wish, or just simple alert for now
                  const btn = document.getElementById('btn-export-zip');
                  if (btn) btn.innerText = '⏳ Generating...';

                  const res = await fetch('/api/arche/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memorialId: currentMemorialId })
                  });

                  console.log(JSON.stringify({ memorialId: currentMemorialId }))

                  const result = await res.json();
                  if (btn) btn.innerText = '📦 Export ZIP';

                  if (result.success && result.downloadUrl) {
                    window.location.href = result.downloadUrl;
                  } else {
                    toast.error(`Export failed: ${result.error || 'Unknown error'}`);
                  }
                } catch (e) {
                  toast.error('Error generating export.');
                  console.error('Error generating export:', e);
                }
              }}
              id="btn-export-zip"
              className="flex items-center gap-2 px-3 py-1.5 bg-olive text-warm-bg border border-olive rounded-lg hover:opacity-90 transition-all text-xs ml-2"
              title="Download the full offline archive (ZIP)"
            >
              <span className="hidden sm:inline">📦 Export ZIP</span>
            </button>
              </>
            )}

            {/*   // ... rest of the top bar ... */}

            {/* Step 1.3.1: Qualitative indicator instead of numerical */}
            {(() => {
              const isPaidModeLocal = effectiveMode === 'personal' || effectiveMode === 'family' || effectiveMode === 'concierge';
              const isPresenceUnlocked = isPaidModeLocal || memorialData.paid || completedPathsCount >= 2;

              return (
                <>
                  {!isPresenceUnlocked && (
                    <p className="text-xs text-warm-outline tracking-wide mb-6">
                      The Presence awaits. Explore two other paths to reveal it.
                    </p>
                  )}
                  {isPresenceUnlocked && !allPathsTraveled && (
                    <p className="text-xs text-olive/70 tracking-wide mb-6">
                      The Presence is open. Continue when you are ready.
                    </p>
                  )}

                  <p className="text-lg text-warm-muted max-w-xl mx-auto">
                    {texts.subHeader}
                    {mode === 'family' && !isSelf && (
                      <>
                        <br />
                        <span className="text-sm mt-2 block text-warm-brown">
                          Designed for collaboration. You will invite members in the Witnesses section.
                        </span>
                      </>
                    )}
                    {!isSelf && mode !== 'family' && (
                      <>
                        <br />
                        <span className="text-sm mt-2 block text-olive">
                          You are the sole guardian. Sharing is optional and controlled by you.
                        </span>
                      </>
                    )}
                  </p>
                </>
              );
            })()}
          </div>

          {/* Ambient whisper: emotional state message */}
          {showDraftStatusInsights && emotionalResult.enabled && emotionalResult.state !== 'void' && emotionalResult.missingDimensions.length > 0 && (
            <div className="max-w-2xl mx-auto mb-10 text-center animate-fadeIn">
              <p className="text-xs text-warm-dark/30 italic leading-relaxed">
                {emotionalResult.ambientMessage}
                {emotionalResult.missingDimensions.length > 0 && emotionalResult.state !== 'eternal' && (
                  <> {emotionalResult.missingDimensions[0].whisper}</>
                )}
              </p>
            </div>
          )}

          {/* Organic path layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Row 1: Facts + Body */}
            <PathCard
              id="facts"
              title={isSelf ? "The Facts" : "The Facts"}
              subtitle="The dates that anchor"
              description={texts.cards.facts}
              status={getPathStatus(memorialData, 'facts')}
              onClick={handlePathClick}
              emotionalState={emotionalResult.state ?? undefined}
              depth={getPathDepth(memorialData, 'facts')}
            />
            <PathCard
              id="body"
              title={isSelf ? "The Journey" : "The Body"}
              subtitle="The life that was lived"
              description={texts.cards.body}
              status={getPathStatus(memorialData, 'body')}
              onClick={handlePathClick}
              emotionalState={emotionalResult.state ?? undefined}
              depth={getPathDepth(memorialData, 'body')}
            />
            <PathCard
              id="soul"
              title={isSelf ? "The Essence" : "The Soul"}
              subtitle="The person behind the name"
              description={texts.cards.soul}
              status={getPathStatus(memorialData, 'soul')}
              onClick={handlePathClick}
              emotionalState={emotionalResult.state ?? undefined}
              depth={getPathDepth(memorialData, 'soul')}
            />

            {/* Step 1.3.3: The center space — what has not yet been said */}
            <div className="hidden lg:flex items-center justify-center">
              {allPathsTraveled && memorialData.step1.fullName ? (
                <div className="text-center animate-fadeIn">
                  <p className="font-serif text-3xl text-warm-muted italic">
                    {memorialData.step1.fullName}
                  </p>
                  <p className="text-xs text-warm-outline mt-2 tracking-wide">is taking shape.</p>
                </div>
              ) : somePathsTraveled ? (
                <div className="text-center">
                  <div className="w-px h-12 bg-warm-border/40 mx-auto mb-3" />
                  <p className="text-xs text-warm-outline italic max-w-[140px]">
                    What has not yet been said
                  </p>
                  <div className="w-px h-12 bg-warm-border/40 mx-auto mt-3" />
                </div>
              ) : (
                <div className="w-px h-16 bg-warm-border/20 mx-auto" />
              )}
            </div>

            <PathCard
              id="witnesses"
              title={mode === 'family' && !isSelf ? "The Contributors" : "The Witnesses"}
              subtitle="Those who carry a fragment"
              description={texts.cards.witnesses}
              status={getPathStatus(memorialData, 'witnesses')}
              onClick={handlePathClick}
              emotionalState={emotionalResult.state ?? undefined}
              depth={getPathDepth(memorialData, 'witnesses')}
            />
            <PathCard
              id="presence"
              title={isSelf ? "The Presence" : "The Presence"}
              subtitle="What remains to be seen"
              description={texts.cards.presence}
              status={getPathStatus(memorialData, 'presence', mode)}
              onClick={handlePathClick}
              emotionalState={emotionalResult.state ?? undefined}
              depth={getPathDepth(memorialData, 'presence')}
            />
          </div>

          {hasFullAccess ? (
            <div className="mt-12 p-10 bg-plum/5 border-2 border-plum/20 rounded-3xl text-center animate-fadeIn">
              <div className="w-16 h-16 bg-plum text-warm-bg rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Shield size={32} />
              </div>
              <h3 className="font-serif text-3xl text-warm-dark mb-4">This Memory is Protected</h3>
              <p className="text-warm-muted max-w-lg mx-auto mb-8 text-sm">
                The archive is preserved at its permanent address. Manage witnesses and contributions from your dashboard.
              </p>

              <div className="flex justify-center gap-4">
                <Link
                  href={`/person/${currentMemorialId}`}
                  target="_blank"
                  className="px-8 py-3 bg-warm-dark text-warm-bg rounded-lg font-medium hover:bg-warm-dark/90 transition-all"
                >
                  Visit the Archive
                </Link>
              </div>

              {/* Review & Seal — always accessible for paid users to re-review */}
            </div>
          ) : (
            getPathStatus(memorialData, 'facts') === 'completed' && (
              <div className="mt-12 max-w-2xl mx-auto animate-fadeIn">
                <p className="text-xs text-warm-outline text-center mb-4 tracking-wide">
                  {emotionalResult.state === 'eternal'
                    ? 'The final path awaits.'
                    : 'A new path has opened.'}
                </p>
                <div className={`p-10 bg-surface-low border rounded-2xl text-center transition-all duration-700 ${
                  emotionalResult.canSeal
                    ? 'border-olive/30 seal-ready'
                    : 'border-warm-border/30'
                }`}>
                  <h3 className="font-serif text-3xl text-warm-dark mb-3">
                    Review & Seal
                  </h3>
                  <p className="text-warm-outline max-w-md mx-auto mb-4 text-sm leading-relaxed">
                    {emotionalResult.canSeal
                      ? 'You have built something worth preserving. Review what you\u2019ve gathered, then seal the archive to protect it forever.'
                      : 'Look over what you\u2019ve built so far. See what still needs to be strengthened before the archive can be sealed.'}
                  </p>

                  {/* Emotional state indicator */}
                  {showDraftStatusInsights && emotionalResult.enabled && emotionalResult.state !== 'void' && (
                    <p className="text-[10px] text-warm-dark/25 uppercase tracking-[0.2em] mb-6">
                      {emotionalResult.state}
                    </p>
                  )}

                  {/* Navigate to Step 10 — the review & ritual */}
                  <button
                    onClick={() => {
                      setMemorialData(prev => ({ ...prev, currentStep: 10 }));
                      setActivePath(null);
                      setViewMode('path');
                    }}
                    className={`px-10 py-4 rounded-xl font-medium transition-all ${
                      emotionalResult.canSeal
                        ? 'bg-warm-dark text-warm-bg hover:bg-warm-dark/90'
                        : 'bg-warm-border/20 text-warm-dark/60 hover:bg-warm-border/30'
                    }`}
                  >
                    {emotionalResult.canSeal
                      ? 'Review & Seal the Archive'
                      : 'Review what you\u2019ve built'}
                  </button>

                  {/* Missing dimensions hint */}
                  {!emotionalResult.canSeal && emotionalResult.sealBlockReasons.length > 0 && (
                    <p className="text-xs text-warm-dark/30 mt-4 italic">
                      {emotionalResult.sealBlockReasons[0]}
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Step 1.1.4: Pause and come back later */}
          <div className="mt-16 text-center space-y-4">
            <button
              onClick={() => setShowPauseModal(true)}
              className="text-sm text-warm-outline hover:text-warm-dark transition-colors border border-warm-border/30 rounded-xl px-6 py-3 hover:bg-warm-border/5"
            >
              Pause and come back later
            </button>
            <div>
              <button onClick={() => router.replace(dashboardPath)} className="text-xs text-warm-outline hover:text-warm-outline transition-colors">
                or return to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* --- THE PATH EDITOR VIEW --- */
        <div className="animate-fadeIn h-screen flex flex-col bg-surface-low overflow-hidden">

          {/* Top Bar - Fixed at top */}
          <div className="flex-none bg-surface-low border-b border-warm-border/20 z-50 px-4 sm:px-8 py-3 flex justify-between items-center">
            <button
              onClick={() => setViewMode('hub')}
              className="flex items-center gap-2 text-sm text-warm-muted hover:text-warm-dark transition-all"
            >
              ← Return to Crossroads
            </button>
            <div className="flex items-center gap-3">

              {/* Save Status — Step 1.1.3: Minimal, no anxiety */}
              <div className="flex items-center gap-2">
                {saveStatus === 'unsaved' && (
                  <div className="flex items-center gap-1.5 text-xs text-warm-outline">
                    <span>Unsaved changes</span>
                  </div>
                )}
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-1.5 text-xs text-warm-outline">
                    <div className="w-3 h-3 border-1.5 border-warm-outline/15 border-t-warm-outline/40 rounded-full animate-spin" />
                    <span>Saving</span>
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-1.5 text-xs text-warm-outline animate-fadeIn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Saved</span>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-1.5 text-xs text-warm-brown">
                    <span>Could not save</span>
                    <button
                      type="button"
                      onClick={() => saveToSupabase()}
                      className="underline hover:text-warm-brown/80 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {/* Step 1.2.4: View as a visitor button */}
              {currentMemorialId && (
                <button
                  onClick={() => {
                    // Opens a full preview in a new tab, no editing UI
                    const previewUrl = `/api/arche/preview-html?id=${currentMemorialId}`;
                    window.open(previewUrl, '_blank');
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-warm-border/30 rounded-lg hover:bg-warm-border/5 transition-all text-xs text-warm-outline"
                  title="View as a visitor will see this archive"
                >
                  <Eye size={13} />
                  <span>View as visitor</span>
                </button>
              )}

              {/* Step 1.1.4: Pause button in editor bar */}
              <button
                onClick={() => setShowPauseModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-warm-border/30 rounded-lg hover:bg-warm-border/5 transition-all text-xs text-warm-outline"
              >
                Pause
              </button>

              {/* Version History Button */}
              {currentMemorialId && isMemorialOwner && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-warm-border/30 rounded-lg hover:bg-warm-border/5 transition-all text-xs text-warm-outline"
                >
                  <History size={13} />
                  <span className="hidden sm:inline">History</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 1.1.2: Contextual emotional message for active path */}
          {activePath && PATH_MESSAGES[activePath] && (
            <div className="flex-none bg-warm-border/8 border-b border-warm-border/15 px-8 py-2.5">
              <p className="text-xs text-warm-outline italic text-center max-w-2xl mx-auto">
                {PATH_MESSAGES[activePath]}
              </p>
            </div>
          )}

          {/* THE RESIZABLE SPLIT VIEW - Takes remaining height */}
          <div className="flex-1 min-h-0 relative">
            <Group orientation="horizontal" className="max-w-[1920px] mx-auto h-full">

              {/* LEFT PANEL: Forms - Automatically takes 100% on mobile if Right Panel is missing */}
              <Panel defaultSize={50} minSize={30} className="h-full">
                <div className="h-full overflow-y-auto p-0 lg:p-8 scrollbar-hide">
                  <div className="bg-white rounded-none lg:rounded-2xl border-x-0 lg:border border-warm-border/30 shadow-sm overflow-hidden min-h-full">

                    {/* PATH SUB-NAVIGATION */}
                    {activePath && PATH_CONFIG[activePath].steps.length > 1 && (
                      <div className="flex border-b border-warm-border/10 bg-warm-border/5 sticky top-0 z-10 backdrop-blur-md">
                        {PATH_CONFIG[activePath].steps.map((stepNumber, index) => (
                          <button
                            key={stepNumber}
                            onClick={() => setMemorialData(prev => ({ ...prev, currentStep: stepNumber }))}
                            className={`flex-1 py-4 px-2 text-xs font-medium transition-all border-b-2 ${memorialData.currentStep === stepNumber
                              ? 'border-olive text-olive bg-surface-low'
                              : 'border-transparent text-warm-outline hover:text-warm-muted'
                              }`}
                          >
                            {PATH_CONFIG[activePath].labels[index]}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* FORM COMPONENTS */}
                    <div className="p-4 sm:p-8">
                      {memorialData.currentStep === 1 && (
                        <Step1BasicInfo
                          data={memorialData.step1}
                          onUpdate={updateStep1}
                          onNext={() => setViewMode('hub')}
                          readOnly={!canEditStep(1)}
                          memorialId={currentMemorialId}
                        />
                      )}
                      {memorialData.currentStep === 2 && (
                        <Step2Childhood
                          data={memorialData.step2}
                          onUpdate={updateStep2}
                          onNext={() => setMemorialData(p => ({ ...p, currentStep: 3 }))}
                          onBack={() => setViewMode('hub')}
                          readOnly={!canEditStep(2)}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                          memorialId={currentMemorialId}
                        />
                      )}
                      {memorialData.currentStep === 3 && (
                        <Step3Career
                          data={memorialData.step3}
                          onUpdate={updateStep3}
                          onNext={() => setMemorialData(p => ({ ...p, currentStep: 4 }))}
                          onBack={() => setMemorialData(p => ({ ...p, currentStep: 2 }))}
                          readOnly={!canEditStep(3)}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                        />
                      )}
                      {memorialData.currentStep === 4 && (
                        <Step4Relationships
                          data={memorialData.step4}
                          onUpdate={updateStep4}
                          onNext={() => setViewMode('hub')}
                          onBack={() => setMemorialData(p => ({ ...p, currentStep: 3 }))}
                          readOnly={!canEditStep(4)}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                        />
                      )}
                      {memorialData.currentStep === 5 && (
                        <Step5Personality
                          data={memorialData.step5}
                          onUpdate={updateStep5}
                          onNext={() => setMemorialData(p => ({ ...p, currentStep: 6 }))}
                          onBack={() => setViewMode('hub')}
                          readOnly={!canEditStep(5)}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                        />
                      )}
                      {memorialData.currentStep === 6 && (
                        <Step6LifeStory
                          data={memorialData.step6}
                          onUpdate={updateStep6}
                          onNext={() => setViewMode('hub')}
                          onBack={() => setMemorialData(p => ({ ...p, currentStep: 5 }))}
                          readOnly={!canEditStep(6)}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                        />
                      )}
                      {memorialData.currentStep === 7 && (
                        <Step7Memories
                          data={memorialData.step7}
                          onUpdate={updateStep7}
                          onNext={() => setViewMode('hub')}
                          onBack={() => setViewMode('hub')}
                          isPaid={hasFullAccess}
                          readOnly={!canEditStep(7)}
                          userRole={userRole}
                          onSubmitContribution={submitContribution}
                          memorialId={currentMemorialId}
                        />
                      )}
                      {memorialData.currentStep === 8 && (
                        <Step8Media
                          data={memorialData.step8}
                          onUpdate={updateStep8}
                          onNext={() => setMemorialData(p => ({ ...p, currentStep: 9 }))}
                          onBack={() => setViewMode('hub')}
                          isPaid={hasFullAccess}
                          completedPathsCount={completedPathsCount}
                          onBackToHub={() => setViewMode('hub')}
                          memorialId={currentMemorialId}
                          readOnly={!canEditStep(8)}
                        />
                      )}
                      {memorialData.currentStep === 9 && (
                        <Step9Videos
                          data={memorialData.step9}
                          onUpdate={updateStep9}
                          onNext={() => setViewMode('hub')}
                          onBack={() => setMemorialData(p => ({ ...p, currentStep: 8 }))}
                          memorialId={currentMemorialId}
                          isPaid={hasFullAccess}
                          readOnly={!canEditStep(9)}
                        />
                      )}
                      {memorialData.currentStep === 10 && (
                        <Step10Review
                          data={memorialData}
                          memorialId={currentMemorialId}
                          onBack={() => setViewMode('hub')}
                          onJumpToStep={goToStep}
                          plan={effectiveMode}
                          isSelfArchive={memorialData.step1.isSelfArchive}
                          hasSuccessor={hasSuccessor}
                          userId={authUserId || ''}
                          isPaid={hasFullAccess}
                          showStatusInsights={showDraftStatusInsights}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              {/* ONLY RENDER MIRROR ON DESKTOP (!isMobile) */}
              {!isMobile && (
                <>
                  {/* RESIZE HANDLE */}
                  <Separator className="w-2 bg-transparent hover:bg-olive/10 transition-colors group flex items-center justify-center cursor-col-resize">
                    <div className="w-0.5 h-16 bg-warm-border/40 rounded-full group-hover:bg-olive/50 transition-colors" />
                  </Separator>

                  {/* RIGHT PANEL: The Mirror */}
                  <Panel defaultSize={50} minSize={25} className="h-full">
                    <div className="h-full w-full overflow-hidden p-4 bg-surface-low">
                      <MemorialRenderer
                        data={memorialData}
                        isPreview={!hasFullAccess}
                        compact={true}
                        className="h-full"
                      />
                    </div>
                  </Panel>
                </>
              )}

            </Group>
          </div>
        </div>
      )
      }

      {
        showTutorial && (
          <TutorialPopup
            steps={tutorialSteps}
            onComplete={handleTutorialComplete}
            onSkip={handleTutorialSkip}
          />
        )
      }

      {/* MOBILE PREVIEW BUTTON (Hidden on Desktop) */}
      {
        viewMode === 'path' && (
          <div className="lg:hidden fixed bottom-6 right-6 z-50 animate-fadeIn">
            <button
              onClick={() => setShowMobilePreview(true)}
              className="flex items-center gap-2 px-5 py-3 bg-warm-dark text-warm-bg rounded-lg shadow-2xl font-serif border border-surface-low/20 active:scale-95 transition-transform"
            >
              <Eye size={20} />
              <span className="font-medium">Preview</span>
            </button>
          </div>
        )
      }

      {/* MOBILE PREVIEW MODAL */}
      {
        showMobilePreview && (
          <PreviewModal
            data={memorialData}
            plan={effectiveMode}
            onClose={() => setShowMobilePreview(false)}
          />
        )
      }

      {/* VERSION HISTORY MODAL */}
      {showHistory && currentMemorialId && isMemorialOwner && (
        <VersionHistory
          memorialId={currentMemorialId}
          currentData={memorialData}
          userId={authUserId || undefined}
          userName="Owner"
          onRestore={(restoredData) => {
            setMemorialData(restoredData);
            stepEntryDataRef.current = structuredClone(restoredData);
            lastSavedSignatureRef.current = getMemorialSaveSignature(restoredData);
            setShowHistory(false);
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Step 1.1.4: Pause and come back later modal */}
      {showPauseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-warm-dark/60 backdrop-blur-sm">
          <div className="bg-surface-low rounded-2xl w-full max-w-md p-8 shadow-2xl border border-warm-border/30">
            <h3 className="font-serif text-2xl text-warm-dark mb-3 text-center">
              Everything is preserved
            </h3>
            <p className="text-sm text-warm-outline text-center leading-relaxed mb-8">
              Preserving a life is not easy. Your work is held safely, exactly where you left it. We can send a gentle reminder in 7 days to help you return.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handlePauseAndLeave(true)}
                className="w-full py-3 px-6 bg-white border border-warm-border/30 rounded-xl text-sm text-warm-dark hover:bg-warm-border/5 transition-all"
              >
                Send a reminder in 7 days
              </button>
              <button
                onClick={() => handlePauseAndLeave(false)}
                className="w-full py-3 px-6 bg-white border border-warm-border/30 rounded-xl text-sm text-warm-outline hover:bg-warm-border/5 transition-all"
              >
                Do not send a reminder
              </button>
              <button
                onClick={() => setShowPauseModal(false)}
                className="w-full py-2 text-xs text-warm-outline hover:text-warm-outline transition-colors"
              >
                Continue working
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default function CreateMemorialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-olive/30 border-t-olive rounded-full animate-spin" />
      </div>
    }>
      <CreateMemorialPageContent />
    </Suspense>
  );
}

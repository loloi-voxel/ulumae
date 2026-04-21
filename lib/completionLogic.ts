// lib/completionLogic.ts
// Refactored: Now delegates to the emotional state engine
// Backward-compatible exports for existing consumers (Step10Review, seal-confirmation)

import { MemorialData } from '@/types/memorial';
import {
  calculateEmotionalState,
  calculateRichness,
  getPathDepth,
  type EmotionalState,
  type EmotionalStateResult,
  type DepthLevel,
} from '@/lib/emotionalState';

export type CompletionStatus = 'complete' | 'complete_solo' | 'in_progress' | 'minimal';

export interface StepCompletionInfo {
    step: number;
    title: string;
    completed: boolean;
    required: boolean;
    optional: boolean;
    summary: string;
    category: 'core' | 'enrichment';
    depth: DepthLevel;
}

export interface CompletionResult {
    status: CompletionStatus;
    coreStepsCompleted: number;
    coreStepsTotal: number;
    enrichmentStepsCompleted: number;
    enrichmentStepsTotal: number;
    steps: StepCompletionInfo[];
    message: string;
    canSeal: boolean;
    sealBlockReasons: string[];
    emotionalState: EmotionalState | null;
    emotionalResult: EmotionalStateResult;
}

/**
 * Calculate the exploration status of a memorial archive.
 * Now powered by the emotional state engine — richness over checkboxes.
 */
export function calculateCompletion(data: MemorialData, plan: string = 'draft'): CompletionResult {
    const emotionalResult = calculateEmotionalState(data, plan);

    const steps: StepCompletionInfo[] = [
        {
            step: 1,
            title: 'Basic Information',
            completed: !!(data.step1.fullName && data.step1.birthDate),
            required: true,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'facts'),
            summary: data.step1.fullName
                ? `${data.step1.fullName} \u2022 ${data.step1.birthDate}${data.step1.deathDate ? ` - ${data.step1.deathDate}` : ' (Living)'}`
                : 'Awaiting your voice',
        },
        {
            step: 2,
            title: 'Early Life & Childhood',
            completed: !!(data.step2.familyBackground || data.step2.childhoodHome),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'body'),
            summary: data.step2.childhoodHome
                ? `${data.step2.schools.highSchool || 'Schools added'} \u2022 ${data.step2.childhoodPersonality.length} traits`
                : 'Awaiting your voice',
        },
        {
            step: 3,
            title: 'Career & Education',
            completed: !!(data.step3.occupations.length > 0),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'body'),
            summary: data.step3.occupations.length > 0
                ? `${data.step3.occupations.length} role${data.step3.occupations.length !== 1 ? 's' : ''} \u2022 ${data.step3.careerHighlights.length} highlights`
                : 'Awaiting your voice',
        },
        {
            step: 4,
            title: 'Relationships & Family',
            completed: !!(data.step4.partners.length > 0 || data.step4.children.length > 0),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'body'),
            summary: (data.step4.partners.length + data.step4.children.length) > 0
                ? `${data.step4.partners.length} partner${data.step4.partners.length !== 1 ? 's' : ''} \u2022 ${data.step4.children.length} child${data.step4.children.length !== 1 ? 'ren' : ''}`
                : 'Awaiting your voice',
        },
        {
            step: 5,
            title: 'Personality, Values & Passions',
            completed: !!(data.step5.personalityTraits.length > 0 || data.step5.coreValues.length > 0),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'soul'),
            summary: (data.step5.personalityTraits.length + data.step5.coreValues.length) > 0
                ? `${data.step5.personalityTraits.length} traits \u2022 ${data.step5.coreValues.length} values`
                : 'Awaiting your voice',
        },
        {
            step: 6,
            title: 'Full Life Story',
            completed: !!(data.step6.biography.trim().length > 100),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'soul'),
            summary: data.step6.biography.trim().length > 0
                ? `${data.step6.biography.trim().split(/\s+/).length} words \u2022 ${data.step6.lifeChapters.length} chapters`
                : 'Awaiting your voice',
        },
        {
            step: 7,
            title: 'Memories & Witnesses',
            completed: !!(
                data.step7.sharedMemories.length > 0 ||
                data.step7.impactStories.length > 0 ||
                (data.step7.invitedEmails && data.step7.invitedEmails.length > 0)
            ),
            required: false,
            optional: true,
            category: 'enrichment',
            depth: getPathDepth(data, 'witnesses'),
            summary: (() => {
                const memories = data.step7.sharedMemories.length;
                const stories = data.step7.impactStories.length;
                const invited = data.step7.invitedEmails?.length || 0;
                if (memories + stories + invited === 0) return 'No witnesses yet \u2014 entirely optional';
                return `${memories} memories \u2022 ${stories} stories \u2022 ${invited} invited`;
            })(),
        },
        {
            step: 8,
            title: 'Photos & Legacy',
            completed: !!(data.step8.coverPhotoPreview || data.step8.gallery.length > 0),
            required: false,
            optional: false,
            category: 'core',
            depth: getPathDepth(data, 'presence'),
            summary: data.step8.gallery.length > 0
                ? `${data.step8.gallery.length} photos \u2022 ${data.step8.voiceRecordings.length} recordings`
                : 'Awaiting your voice',
        },
        {
            step: 9,
            title: 'Videos',
            completed: !!(data.step9.videos.length > 0),
            required: false,
            optional: true,
            category: 'enrichment',
            depth: getPathDepth(data, 'presence'),
            summary: data.step9.videos.length > 0
                ? `${data.step9.videos.length} video${data.step9.videos.length !== 1 ? 's' : ''}`
                : 'No videos yet \u2014 entirely optional',
        },
    ];

    const coreSteps = steps.filter(s => s.category === 'core');
    const coreCompleted = coreSteps.filter(s => s.completed).length;
    const coreTotal = coreSteps.length;

    const enrichmentSteps = steps.filter(s => s.category === 'enrichment');
    const enrichmentCompleted = enrichmentSteps.filter(s => s.completed).length;
    const enrichmentTotal = enrichmentSteps.length;

    const hasBasicInfo = steps[0].completed;

    // Map emotional state to legacy CompletionStatus
    let status: CompletionStatus;
    if (!emotionalResult.enabled) {
        if (coreCompleted === coreTotal && enrichmentCompleted === enrichmentTotal) {
            status = 'complete';
        } else if (coreCompleted === coreTotal) {
            status = 'complete_solo';
        } else if (hasBasicInfo) {
            status = 'in_progress';
        } else {
            status = 'minimal';
        }
    } else if (emotionalResult.state === 'eternal') {
        status = 'complete';
    } else if (emotionalResult.state === 'substantial') {
        status = 'complete_solo';
    } else if (emotionalResult.state === 'emerging' || emotionalResult.state === 'fragile') {
        status = hasBasicInfo ? 'in_progress' : 'minimal';
    } else {
        status = 'minimal';
    }

    return {
        status,
        coreStepsCompleted: coreCompleted,
        coreStepsTotal: coreTotal,
        enrichmentStepsCompleted: enrichmentCompleted,
        enrichmentStepsTotal: enrichmentTotal,
        steps,
        message: emotionalResult.enabled ? emotionalResult.ambientMessage : '',
        canSeal: emotionalResult.canSeal,
        sealBlockReasons: emotionalResult.sealBlockReasons,
        emotionalState: emotionalResult.state,
        emotionalResult,
    };
}

/**
 * Check if a specific step is an enrichment (optional) step.
 */
export function isEnrichmentStep(stepNumber: number): boolean {
    return stepNumber === 7 || stepNumber === 9;
}

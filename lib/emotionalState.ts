// lib/emotionalState.ts
// Core engine for the emotional state system
// Replaces percentage-based completion with richness-based emotional states

import { MemorialData } from '@/types/memorial';

// ─── Emotional States ────────────────────────────────────────────────────────
// The memorial exists in one of five emotional states, each shaping
// the tone, visuals, and available actions across the interface.

export type EmotionalState = 'void' | 'fragile' | 'emerging' | 'substantial' | 'eternal';

export interface RichnessScore {
  total: number;        // 0–100 composite score
  depth: number;        // narrative detail (biography length, chapters, philosophy)
  diversity: number;    // media variety (photos, voice, video)
  presence: number;     // how "alive" the memorial feels (multi-dimensional content)
}

export interface EmotionalStateResult {
  enabled: boolean;
  state: EmotionalState | null;
  richness: RichnessScore;
  canSeal: boolean;
  sealBlockReasons: string[];   // human-readable reasons why sealing is blocked
  missingDimensions: MissingDimension[];
  ambientMessage: string;       // state-driven message for the interface
  fragmentCount: number;        // total discrete content fragments
}

export interface MissingDimension {
  key: string;
  label: string;
  whisper: string;    // gentle reminder of what's absent
  targetStep: number; // which step to direct the user to
}

// ─── Richness Calculation ────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isEmotionalStateEnabled(plan: string): boolean {
  return plan === 'draft';
}

function getDisabledEmotionalStateResult(): EmotionalStateResult {
  return {
    enabled: false,
    state: null,
    richness: {
      total: 0,
      depth: 0,
      diversity: 0,
      presence: 0,
    },
    canSeal: true,
    sealBlockReasons: [],
    missingDimensions: [],
    ambientMessage: '',
    fragmentCount: 0,
  };
}

export function calculateRichness(data: MemorialData): RichnessScore {
  // ── Depth (0–40) ──────────────────────────────────────────────────────────
  // Narrative detail: biography, chapters, philosophy, legacy statement, epitaph
  let depth = 0;

  const bioWords = countWords(data.step6?.biography || '');
  if (bioWords >= 500) depth += 15;
  else if (bioWords >= 200) depth += 10;
  else if (bioWords >= 50) depth += 5;
  else if (bioWords > 0) depth += 2;

  const chapters = data.step6?.lifeChapters?.length || 0;
  depth += Math.min(chapters * 2, 6); // up to 6

  const philosophy = countWords(data.step5?.lifePhilosophy || '');
  if (philosophy >= 50) depth += 4;
  else if (philosophy > 0) depth += 2;

  const legacyWords = countWords(data.step8?.legacyStatement || '');
  if (legacyWords >= 30) depth += 3;
  else if (legacyWords > 0) depth += 1;

  const epitaphWords = countWords(data.step1?.epitaph || '');
  if (epitaphWords > 0) depth += 2;

  // Childhood / career / relationships narrative depth
  if (data.step2?.familyBackground && countWords(data.step2.familyBackground) > 20) depth += 2;
  if ((data.step3?.occupations?.length || 0) >= 2) depth += 2;
  if ((data.step4?.majorLifeEvents?.length || 0) >= 2) depth += 2;
  if ((data.step5?.personalityTraits?.length || 0) >= 3) depth += 2;

  depth = Math.min(depth, 40);

  // ── Diversity (0–35) ──────────────────────────────────────────────────────
  // Media variety: photos, voice recordings, videos
  let diversity = 0;

  const photoCount = data.step8?.gallery?.length || 0;
  if (photoCount >= 10) diversity += 10;
  else if (photoCount >= 5) diversity += 7;
  else if (photoCount >= 1) diversity += 4;

  const hasProfilePhoto = !!data.step1?.profilePhotoPreview;
  if (hasProfilePhoto) diversity += 2;

  const hasCoverPhoto = !!data.step8?.coverPhotoPreview;
  if (hasCoverPhoto) diversity += 2;

  const voiceCount = data.step8?.voiceRecordings?.length || 0;
  if (voiceCount >= 3) diversity += 8;
  else if (voiceCount >= 1) diversity += 5;

  const videoCount = data.step9?.videos?.length || 0;
  if (videoCount >= 3) diversity += 8;
  else if (videoCount >= 1) diversity += 5;

  // Childhood photos as bonus
  const childhoodPhotos = data.step2?.childhoodPhotos?.length || 0;
  if (childhoodPhotos >= 1) diversity += 3;

  diversity = Math.min(diversity, 35);

  // ── Presence (0–25) ───────────────────────────────────────────────────────
  // How "alive" the memorial feels: multi-dimensional, connected, witnessed
  let presence = 0;

  // Basic identity established
  if (data.step1?.fullName && data.step1?.birthDate) presence += 3;

  // Multiple life dimensions covered
  const dimensionsCovered = [
    !!(data.step2?.childhoodHome),
    (data.step3?.occupations?.length || 0) > 0,
    (data.step4?.partners?.length || 0) > 0 || (data.step4?.children?.length || 0) > 0,
    (data.step5?.personalityTraits?.length || 0) > 0,
    bioWords > 50,
    photoCount > 0,
  ].filter(Boolean).length;
  presence += Math.min(dimensionsCovered * 2, 10);

  // Witnessed by others
  const witnessCount = data.step7?.invitedEmails?.length || 0;
  const memoryCount = data.step7?.sharedMemories?.length || 0;
  if (witnessCount > 0 || memoryCount > 0) presence += 4;

  // Quotes and sayings add personality
  const quotesCount = data.step5?.favoriteQuotes?.length || 0;
  const sayingsCount = data.step5?.memorableSayings?.length || 0;
  if (quotesCount > 0 || sayingsCount > 0) presence += 3;

  // Values add moral presence
  if ((data.step5?.coreValues?.length || 0) >= 2) presence += 2;

  // Passions
  if ((data.step5?.passions?.length || 0) >= 2) presence += 3;

  presence = Math.min(presence, 25);

  return {
    total: depth + diversity + presence,
    depth,
    diversity,
    presence,
  };
}

// ─── Emotional State Derivation ──────────────────────────────────────────────

export function getEmotionalState(richness: RichnessScore): EmotionalState {
  if (richness.total >= 65) return 'eternal';
  if (richness.total >= 40) return 'substantial';
  if (richness.total >= 15) return 'emerging';
  if (richness.total >= 3) return 'fragile';
  return 'void';
}

// ─── Missing Dimensions ──────────────────────────────────────────────────────

export function getMissingDimensions(data: MemorialData): MissingDimension[] {
  const missing: MissingDimension[] = [];

  if (!data.step1?.fullName) {
    missing.push({
      key: 'name',
      label: 'Their name',
      whisper: 'Every life begins with a name.',
      targetStep: 1,
    });
  }

  const bioWords = countWords(data.step6?.biography || '');
  if (bioWords < 200) {
    missing.push({
      key: 'biography',
      label: 'Their story',
      whisper: bioWords === 0
        ? 'Their story remains unwritten.'
        : 'The rest of their story remains unwritten.',
      targetStep: 6,
    });
  }

  if ((data.step8?.gallery?.length || 0) < 3) {
    missing.push({
      key: 'photos',
      label: 'Their images',
      whisper: (data.step8?.gallery?.length || 0) === 0
        ? 'No images preserve their face.'
        : 'Only fragments of their world have been captured.',
      targetStep: 8,
    });
  }

  if ((data.step8?.voiceRecordings?.length || 0) === 0 && (data.step9?.videos?.length || 0) === 0) {
    missing.push({
      key: 'voice',
      label: 'Their voice',
      whisper: 'Their voice is waiting to be heard.',
      targetStep: 8,
    });
  }

  if (!data.step2?.childhoodHome && !data.step2?.familyBackground) {
    missing.push({
      key: 'childhood',
      label: 'Their beginnings',
      whisper: 'Where they came from remains untold.',
      targetStep: 2,
    });
  }

  if ((data.step4?.partners?.length || 0) === 0 && (data.step4?.children?.length || 0) === 0) {
    missing.push({
      key: 'relationships',
      label: 'Those they loved',
      whisper: 'The people who shaped their world are unnamed.',
      targetStep: 4,
    });
  }

  if ((data.step5?.personalityTraits?.length || 0) < 3) {
    missing.push({
      key: 'personality',
      label: 'Who they were',
      whisper: 'Their character has not yet been captured.',
      targetStep: 5,
    });
  }

  if ((data.step7?.invitedEmails?.length || 0) === 0 && (data.step7?.sharedMemories?.length || 0) === 0) {
    missing.push({
      key: 'witnesses',
      label: 'Those who remember',
      whisper: 'No one else has been invited to bear witness.',
      targetStep: 7,
    });
  }

  return missing;
}

// ─── Fragment Count ──────────────────────────────────────────────────────────
// Counts discrete content items to give users a sense of what they've gathered

export function countFragments(data: MemorialData): number {
  let count = 0;

  // Basic facts
  if (data.step1?.fullName) count++;
  if (data.step1?.birthDate) count++;
  if (data.step1?.deathDate) count++;
  if (data.step1?.birthPlace) count++;
  if (data.step1?.deathPlace) count++;
  if (data.step1?.epitaph) count++;
  if (data.step1?.profilePhotoPreview) count++;

  // Childhood
  if (data.step2?.childhoodHome) count++;
  if (data.step2?.familyBackground) count++;
  count += data.step2?.childhoodPersonality?.length || 0;
  count += data.step2?.earlyInterests?.length || 0;
  count += data.step2?.childhoodPhotos?.length || 0;

  // Career
  count += data.step3?.occupations?.length || 0;
  count += data.step3?.careerHighlights?.length || 0;

  // Relationships
  count += data.step4?.partners?.length || 0;
  count += data.step4?.children?.length || 0;
  count += data.step4?.majorLifeEvents?.length || 0;

  // Personality
  count += data.step5?.personalityTraits?.length || 0;
  count += data.step5?.coreValues?.length || 0;
  count += data.step5?.passions?.length || 0;
  if (data.step5?.lifePhilosophy) count++;
  count += data.step5?.favoriteQuotes?.length || 0;
  count += data.step5?.memorableSayings?.length || 0;

  // Life story
  if (countWords(data.step6?.biography || '') > 0) count++;
  count += data.step6?.lifeChapters?.length || 0;

  // Memories & witnesses
  count += data.step7?.sharedMemories?.length || 0;
  count += data.step7?.impactStories?.length || 0;

  // Media
  count += data.step8?.gallery?.length || 0;
  count += data.step8?.voiceRecordings?.length || 0;
  if (data.step8?.legacyStatement) count++;

  // Videos
  count += data.step9?.videos?.length || 0;

  return count;
}

// ─── Seal Gating ─────────────────────────────────────────────────────────────

function getSealBlockReasons(data: MemorialData): string[] {
  const reasons: string[] = [];

  if (!data.step1?.fullName) {
    reasons.push('Their name must be preserved.');
  }

  const bioWords = countWords(data.step6?.biography || '');
  if (bioWords < 200) {
    reasons.push(`Their story needs more depth — ${bioWords > 0 ? `${200 - bioWords} more words` : 'a biography'} to honor their life.`);
  }

  const photoCount = data.step8?.gallery?.length || 0;
  if (photoCount < 3) {
    reasons.push(`${3 - photoCount} more image${3 - photoCount !== 1 ? 's' : ''} needed — images are proof of existence.`);
  }

  const hasVoice = (data.step8?.voiceRecordings?.length || 0) > 0;
  const hasVideo = (data.step9?.videos?.length || 0) > 0;
  if (!hasVoice && !hasVideo) {
    reasons.push('At least one voice recording or video — so their presence endures beyond words and images.');
  }

  return reasons;
}

// ─── Ambient Messages ────────────────────────────────────────────────────────

function getAmbientMessage(state: EmotionalState, fragmentCount: number, data: MemorialData): string {
  const name = data.step1?.fullName;

  switch (state) {
    case 'void':
      return 'A life awaits preservation.';
    case 'fragile':
      return name
        ? `Something fragile has begun for ${name}. It needs more.`
        : 'Something fragile has begun. It needs more.';
    case 'emerging':
      return name
        ? `${name}'s story is taking shape. ${fragmentCount} fragments gathered.`
        : `Their story is taking shape. ${fragmentCount} fragments gathered.`;
    case 'substantial':
      return name
        ? `${name}'s life is becoming visible. Continue to deepen what you've built.`
        : `A life is becoming visible. Continue to deepen what you've built.`;
    case 'eternal':
      return name
        ? `${name}'s memory is ready to be protected forever.`
        : 'This memory is ready to be protected forever.';
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function calculateEmotionalState(data: MemorialData, plan: string = 'draft'): EmotionalStateResult {
  if (!isEmotionalStateEnabled(plan)) {
    return getDisabledEmotionalStateResult();
  }

  const richness = calculateRichness(data);
  const state = getEmotionalState(richness);
  const missingDimensions = getMissingDimensions(data);
  const fragmentCount = countFragments(data);
  const sealBlockReasons = getSealBlockReasons(data);

  return {
    enabled: true,
    state,
    richness,
    canSeal: sealBlockReasons.length === 0,
    sealBlockReasons,
    missingDimensions,
    ambientMessage: getAmbientMessage(state, fragmentCount, data),
    fragmentCount,
  };
}

// ─── Depth Labels (for PathCard and ProgressBar) ─────────────────────────────

export type DepthLevel = 'untouched' | 'shallow' | 'meaningful' | 'embodied';

export function getPathDepth(data: MemorialData, pathId: string): DepthLevel {
  switch (pathId) {
    case 'facts': {
      const s1 = data.step1;
      if (!s1?.fullName && !s1?.birthDate) return 'untouched';
      if (s1.fullName && s1.birthDate && s1.birthPlace && s1.epitaph) return 'embodied';
      if (s1.fullName && s1.birthDate) return 'meaningful';
      return 'shallow';
    }
    case 'body': {
      const hasChildhood = !!(data.step2?.childhoodHome || data.step2?.familyBackground);
      const hasCareer = (data.step3?.occupations?.length || 0) > 0;
      const hasFamily = (data.step4?.partners?.length || 0) > 0 || (data.step4?.children?.length || 0) > 0;
      const filledCount = [hasChildhood, hasCareer, hasFamily].filter(Boolean).length;
      if (filledCount === 0) return 'untouched';
      if (filledCount === 3) return 'embodied';
      if (filledCount >= 2) return 'meaningful';
      return 'shallow';
    }
    case 'soul': {
      const hasTraits = (data.step5?.personalityTraits?.length || 0) >= 3;
      const hasBio = countWords(data.step6?.biography || '') > 200;
      if (!hasTraits && countWords(data.step6?.biography || '') === 0) return 'untouched';
      if (hasTraits && hasBio) return 'embodied';
      if (hasTraits || hasBio) return 'meaningful';
      return 'shallow';
    }
    case 'presence': {
      const hasPhotos = (data.step8?.gallery?.length || 0) > 0;
      const hasVoice = (data.step8?.voiceRecordings?.length || 0) > 0;
      const hasVideos = (data.step9?.videos?.length || 0) > 0;
      if (!hasPhotos && !hasVoice && !hasVideos) return 'untouched';
      if (hasPhotos && (hasVoice || hasVideos)) return 'embodied';
      if (hasPhotos || hasVoice || hasVideos) return 'meaningful';
      return 'shallow';
    }
    case 'witnesses': {
      const hasInvited = (data.step7?.invitedEmails?.length || 0) > 0;
      const hasMemories = (data.step7?.sharedMemories?.length || 0) > 0;
      if (!hasInvited && !hasMemories) return 'untouched';
      if (hasInvited && hasMemories) return 'embodied';
      return 'meaningful';
    }
    default:
      return 'untouched';
  }
}

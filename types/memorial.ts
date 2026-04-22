// types/memorial.ts - UPDATED with Step 9 for Videos

import type { MediaBucket, MediaReferenceFields } from '@/types/media';

export interface MediaImageReference extends MediaReferenceFields {
  id: string;
  file?: File | null;
  preview: string;
  caption: string;
  year: string;
  type: 'photo' | 'video';
  sha256_hash?: string;
}

export interface InteractiveMediaReference extends MediaReferenceFields {
  id: string;
  file?: File | null;
  preview: string;
  description: string;
  sha256_hash?: string;
}

export interface VoiceRecordingReference extends MediaReferenceFields {
  id: string;
  file?: File | null;
  title: string;
  url?: string | null;
  sha256_hash?: string;
}

export interface VideoReference extends MediaReferenceFields {
  id: string;
  file?: File | null;
  url: string;
  thumbnail: string;
  thumbnailAssetId?: string | null;
  thumbnailBucket?: MediaBucket | null;
  thumbnailStoragePath?: string | null;
  thumbnailMimeType?: string | null;
  thumbnailFileSize?: number | null;
  thumbnailUploadedAt?: string | null;
  title: string;
  duration?: string;
  description?: string;
  sha256_hash?: string;
}

export interface ChildhoodPhotoReference extends MediaReferenceFields {
  id: string;
  file?: File | null;
  preview: string;
  caption: string;
  year: string;
  sha256_hash?: string;
}

export interface BasicInfo {
  fullName: string;
  birthDate: string;
  deathDate: string | null;
  isStillLiving: boolean;
  isSelfArchive?: boolean; // NEW: Track if user is creating for themselves
  privateUntilDeath?: boolean; // NEW: Controls visibility logic
  birthPlace: string;
  deathPlace: string;
  profilePhoto: File | null;
  profilePhotoPreview: string | null;
  profilePhotoAssetId?: string | null;
  profilePhotoBucket?: MediaBucket | null;
  profilePhotoStoragePath?: string | null;
  profilePhotoMimeType?: string | null;
  profilePhotoFileSize?: number | null;
  profilePhotoUploadedAt?: string | null;
  profilePhotoUploadStatus?: MediaReferenceFields['uploadStatus'];
  profilePhotoUploadError?: string | null;
  profilePhotoHash?: string; // NEW: Store hash for profile photo
  epitaph: string;
}

export interface ChildhoodInfo {
  childhoodHome: string;
  familyBackground: string;
  schools: {
    elementary: string;
    highSchool: string;
    college: string;
    additionalEducation: string;
  };
  childhoodPersonality: string[];
  earlyInterests: string[];
  childhoodPhotos: ChildhoodPhotoReference[];
}

export interface CareerEducation {
  occupations: Array<{
    id: string;
    title: string;
    company: string;
    yearsFrom: string;
    yearsTo: string;
    description: string;
  }>;
  careerHighlights: string[];
  education: {
    major: string;
    graduationYear: string;
    honors: string;
  };
}

export interface RelationshipsFamily {
  partners: Array<{
    id: string;
    name: string;
    relationshipType: string;
    yearsFrom: string;
    yearsTo: string;
    description: string;
    photo: File | null;
    photoPreview: string | null;
  }>;
  children: Array<{
    id: string;
    name: string;
    birthYear: string;
    description: string;
  }>;
  majorLifeEvents: Array<{
    id: string;
    year: string;
    title: string;
    category: 'marriage' | 'birth' | 'career' | 'achievement' | 'loss' | 'milestone';
    description: string;
  }>;
}

export interface PersonalityValues {
  personalityTraits: string[];
  coreValues: string[];
  passions: string[];
  lifePhilosophy: string;
  favoriteQuotes: Array<{
    id: string;
    text: string;
    context: string;
  }>;
  memorableSayings: string[];
}

export interface LifeStory {
  biography: string;
  lifeChapters: Array<{
    id: string;
    period: string;
    ageRange: string;
    title: string;
    description: string;
    keyEvents: string[];
  }>;
}

// NEW: Invitation tracking type
export interface SentInvitation {
  email: string;
  sentAt: string;        // ISO date string
  status: 'sent' | 'accepted' | 'declined' | 'pending';
  acceptedAt?: string;   // When witness accepted the invitation
}

export interface SharedMemory {
  id: string;
  title: string;
  date: string;
  content: string;
  author: string;
  relationship: string;
}

export interface ImpactStory {
  id: string;
  title: string;
  content: string;
  author: string;
}

export interface MemoriesStories {
  sharedMemories: SharedMemory[];
  impactStories: ImpactStory[];
  invitedEmails: string[];
  witnessPersonalMessage: string;     // ← NEW
  sentInvitations: SentInvitation[];  // ← NEW
  memorialId?: string;               // ← NEW (passed from parent for API calls)
}

// UPDATED: Step 8 now only has Photos & Legacy (no videos)
export interface MediaLegacy {
  coverPhoto: File | null;
  coverPhotoPreview: string | null;
  coverPhotoAssetId?: string | null;
  coverPhotoBucket?: MediaBucket | null;
  coverPhotoStoragePath?: string | null;
  coverPhotoMimeType?: string | null;
  coverPhotoFileSize?: number | null;
  coverPhotoUploadedAt?: string | null;
  coverPhotoUploadStatus?: MediaReferenceFields['uploadStatus'];
  coverPhotoUploadError?: string | null;
  coverPhotoHash?: string; // NEW: Store hash for cover photo
  gallery: MediaImageReference[];
  interactiveGallery: InteractiveMediaReference[];
  voiceRecordings: VoiceRecordingReference[];
  legacyStatement: string;
}

// NEW: Step 9 for Videos only
export interface VideoContent {
  videos: VideoReference[];
}


// UPDATED: MemorialData with step9
export interface MemorialData {
  step1: BasicInfo;
  step2: ChildhoodInfo;
  step3: CareerEducation;
  step4: RelationshipsFamily;
  step5: PersonalityValues;
  step6: LifeStory;
  step7: MemoriesStories;
  step8: MediaLegacy;
  step9: VideoContent; // NEW
  currentStep: number;
  paid: boolean; // Tracking payment status
  lastSaved: string | null;
  completedSteps: number[];
}

export const TOTAL_STEPS = 10; // UPDATED from 9 to 10

// Emotional state vocabulary
export const STEP_NAMES = [
  'Basic Information',
  'Early Life & Childhood',
  'Career & Education',
  'Relationships & Family',
  'Personality, Values & Passions',
  'Full Life Story',
  'Memories & Witnesses',
  'Photos & Legacy',
  'Videos',
  'Review & Seal'
];

export type EmotionalStateName = 'void' | 'fragile' | 'emerging' | 'substantial' | 'eternal';

// ==========================================
// PHASE 2: WITNESS & COLLABORATION TYPES
// ==========================================

export type WitnessRole = 'owner' | 'co_guardian' | 'witness' | 'reader';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type ContributionStatus = 'pending_approval' | 'approved' | 'rejected' | 'needs_changes';

export interface WitnessInvitation {
  id: string; // Unique token/UUID for the link
  memorialId: string;
  inviterName: string;
  inviteeEmail: string;
  role: WitnessRole;
  personalMessage?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string; // Invitations should expire for security (e.g., 30 days)
}

export interface MemorialWitness {
  id: string;
  memorialId: string;
  userId: string; // Link to the registered user
  displayName: string;
  email: string;
  role: WitnessRole;
  joinedAt: string;
  status: 'active' | 'suspended';
}

// Updated structure for a Memory/Contribution to support the Approval System
export interface WitnessContribution {
  id: string;
  memorialId: string;
  witnessId: string; // Who wrote it
  type: 'memory' | 'photo' | 'video';
  content: any; // The actual data (text, url, etc.)
  status: ContributionStatus;
  adminNotes?: string; // If rejected or needs changes, owner writes why here
  createdAt: string;
  updatedAt: string;
  disputed?: boolean; // For Step 2.1.6 (Conflict detection)
}


export interface MemorialRelation {
  id: string;
  from_memorial_id: string;
  to_memorial_id: string;
  target_name?: string; // Fetched from the joined table
  target_photo?: string; // Fetched from the joined table
  relationship_type: 'parent' | 'child' | 'spouse' | 'sibling' | 'other';
}


// ==========================================
// PRESERVATION & LUXURY PLATFORM TYPES
// ==========================================

export type PreservationState =
  | 'draft'
  | 'building'
  | 'review'
  | 'preserving'
  | 'preserved'
  | 'archived';

export interface PreservationStatus {
  state: PreservationState;
  arweaveTxId: string | null;
  gatewayUrls: string[];
  nodeCount: number;
  lastVerifiedAt: string | null;
  preservedAt: string | null;
  storageBytesUsed: number;
  storageBytesIncluded: number; // e.g. 100GB
}

export interface AnchorDeviceInfo {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  syncProgressBytes: number;
  totalBytes: number;
  lastSyncAt: string | null;
  status: 'syncing' | 'synced' | 'error' | 'stale';
  location?: string;
}

export interface RecoveryContactInfo {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: 'pending' | 'confirmed' | 'delivered';
}

export type SuccessorAccessLevel = 'read_only' | 'editorial' | 'full_ownership';

export interface ContentReviewStatus {
  status: 'not_submitted' | 'pending_review' | 'approved' | 'needs_changes';
  submittedAt: string | null;
  reviewedAt: string | null;
  flaggedItems: string[];
}

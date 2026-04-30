// lib/supabase.ts - UPDATED to use auth-aware SSR client
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// This client is now cookie-aware and will use the authenticated session
// when available. All existing imports continue to work.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// ============================================
// EXISTING MEMORIAL INTERFACE
// ============================================

export interface Memorial {
    id: string;
    created_at: string;
    updated_at: string;
    user_id: string;
    mode: 'draft' | 'personal' | 'family';
    step1: any;
    step2: any;
    step3: any;
    step4: any;
    step5: any;
    step6: any;
    step7: any;
    step8: any;
    step9: any;
    status: 'draft' | 'published';
    slug: string | null;
    full_name: string | null;
    birth_date: string | null;
    death_date: string | null;
    profile_photo_url: string | null;
    cover_photo_url: string | null;
    completed_steps: number[];

    // Soft Delete Fields
    deleted?: boolean;
    deleted_at?: string | null;
    paid?: boolean;
    payment_confirmed_at?: string | null;
    arweave_tx_id?: string | null;
    preservation_state?: string | null;
    preservation_date?: string | null;
    sealed_at?: string | null;
    seal_status?: 'pending' | 'in_progress' | 'completed' | 'failed' | null;
    seal_job_id?: string | null;
    seal_selected_asset_ids?: string[] | null;
}


// ============================================
// CONCIERGE EXPORTS (re-export from types)
// ============================================
export type {
    ConciergeProject,
    ConciergeFile,
    ConciergeNote,
    ConciergeStatus,
    ConciergeRequestForm,
    ConciergeFileUpload,
    ConciergeContentPreview
} from '@/types/concierge';

export {
    CONCIERGE_STATUS_CONFIG,
    formatFileSize,
    getFileCategory,
    isImageFile,
    isValidEmail
} from '@/types/concierge';


// lib/supabase.ts

// ... keep your imports and other interfaces (Memorial, ConciergeProject, etc.) ...

export interface MemorialAuthorization {
    // IDs and timestamps
    id: string;
    created_at: string;
    updated_at?: string;
    user_id: string | null;
    memorial_id: string | null;

    // Section 1: Creator Information
    creator_full_name: string;
    creator_dob?: string | null;
    creator_address?: string | null;
    creator_city_state_zip?: string | null;
    creator_email: string;
    creator_phone?: string | null;
    relationship_to_deceased: string;
    relationship_other?: string | null;

    // Section 2: Deceased Information
    deceased_full_name: string;
    deceased_dob?: string;
    deceased_dod?: string | null;
    deceased_death_place?: string | null;
    deceased_last_residence?: string | null;

    // Section 3: Authority / Agreements (Enhanced for Step 4.1)
    agree_legal_authority: boolean;    // NEW
    agree_good_faith: boolean;         // NEW
    agree_permanence: boolean;         // NEW
    agree_indemnification: boolean;    // (Replaces indemnification_accepted or maps to it)
    indemnification_accepted?: boolean; // Keep for backward compatibility if needed

    // Section 4: Content Representations (Old fields, keep for safety)
    accuracy_confirmed?: boolean;
    copyright_confirmed?: boolean;
    privacy_confirmed?: boolean;

    // Section 8: Electronic Signature & Evidence
    signature_type: 'typed' | 'drawn'; // NEW
    electronic_signature: string;      // The text name OR base64 image
    signature_date: string;

    // Technical Evidence
    signature_ip_address: string | null;
    signature_user_agent: string | null;
    device_fingerprint?: string | null; // NEW
    geolocation?: string | null;        // NEW

    // Status and Review
    status: 'pending' | 'approved' | 'rejected';
    reviewed_by?: string | null;
    reviewed_at?: string | null;

    // Optional PDF Storage path
    pdf_storage_path?: string | null;


    authorization_type: 'account' | 'individual'; // ADD THIS LINE

    video_storage_path?: string | null;
    video_hash?: string | null;
}

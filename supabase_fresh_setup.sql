-- ============================================================
-- ULUMAE — COMPLETE SUPABASE SETUP (FRESH PROJECT)
-- ============================================================
-- Run this ENTIRE file in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates ALL tables, indexes, triggers, RLS policies, and functions
-- for a brand new Supabase project.
--
-- IMPORTANT: Run this BEFORE starting your app for the first time.
-- ============================================================


-- ============================================================
-- SECTION 0: EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SECTION 1: UTILITY FUNCTIONS (must come first)
-- ============================================================

-- Auto-update updated_at timestamp on any table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- SECTION 2: USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Dead man's switch
    dead_mans_switch_enabled BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    verification_sent_at TIMESTAMPTZ,

    -- Plan tracking
    highest_plan TEXT DEFAULT 'none'
);

-- Auto-create user row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires on every new auth.users signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access to users"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_dead_mans_switch ON users(dead_mans_switch_enabled) WHERE dead_mans_switch_enabled = true;


-- ============================================================
-- SECTION 3: MEMORIALS TABLE (core table)
-- ============================================================

CREATE TABLE IF NOT EXISTS memorials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Memorial data (wizard steps stored as JSONB)
    step1 JSONB NOT NULL DEFAULT '{}',
    step2 JSONB NOT NULL DEFAULT '{}',
    step3 JSONB NOT NULL DEFAULT '{}',
    step4 JSONB NOT NULL DEFAULT '{}',
    step5 JSONB NOT NULL DEFAULT '{}',
    step6 JSONB NOT NULL DEFAULT '{}',
    step7 JSONB NOT NULL DEFAULT '{}',
    step8 JSONB NOT NULL DEFAULT '{}',
    step9 JSONB NOT NULL DEFAULT '{"videos": []}',

    -- Status and metadata
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    slug TEXT UNIQUE,
    mode VARCHAR(10) DEFAULT 'draft'
        CHECK (mode IN ('draft', 'personal', 'family')),

    -- Quick access fields (denormalized)
    full_name TEXT,
    birth_date DATE,
    death_date DATE,
    profile_photo_url TEXT,
    cover_photo_url TEXT,
    completed_steps INTEGER[] DEFAULT '{}',

    -- Soft delete
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    -- Payment
    paid BOOLEAN DEFAULT FALSE,
    payment_confirmed_at TIMESTAMPTZ,
    plan_type TEXT CHECK (plan_type IN ('personal', 'family', 'concierge')),
    amount_paid INTEGER DEFAULT 0,
    stripe_payment_id TEXT,
    refund_eligible BOOLEAN DEFAULT TRUE,
    upgraded_from TEXT,
    upgraded_at TIMESTAMPTZ,
    last_exported_at TIMESTAMPTZ,

    -- Preservation (Arweave)
    arweave_tx_id TEXT,
    preservation_state TEXT DEFAULT 'draft'
        CHECK (preservation_state IN ('draft', 'building', 'review', 'preserving', 'preserved', 'archived')),
    preservation_date TIMESTAMPTZ,
    content_size_bytes BIGINT DEFAULT 0,

    -- Content review
    review_status TEXT DEFAULT 'not_submitted'
        CHECK (review_status IN ('not_submitted', 'pending_review', 'approved', 'needs_changes'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memorials_user_id ON memorials(user_id);
CREATE INDEX IF NOT EXISTS idx_memorials_status ON memorials(status);
CREATE INDEX IF NOT EXISTS idx_memorials_created_at ON memorials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memorials_slug ON memorials(slug);
CREATE INDEX IF NOT EXISTS idx_memorials_mode ON memorials(mode);
CREATE INDEX IF NOT EXISTS idx_memorials_user_mode ON memorials(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_memorials_preservation_state ON memorials(preservation_state);
CREATE INDEX IF NOT EXISTS idx_memorials_arweave_tx ON memorials(arweave_tx_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER update_memorials_updated_at
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: prevent manual paid=true (only service_role can set paid)
CREATE OR REPLACE FUNCTION check_paid_status_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.paid = false AND NEW.paid = true) THEN
        IF current_setting('role') != 'service_role' THEN
            RAISE EXCEPTION 'You cannot manually set your archive as paid.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER secure_paid_column
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    EXECUTE FUNCTION check_paid_status_integrity();

-- Trigger: validate preservation state transitions
CREATE OR REPLACE FUNCTION validate_preservation_state_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions JSONB := '{
        "draft": ["building"],
        "building": ["review", "draft"],
        "review": ["preserving", "building"],
        "preserving": ["preserved", "review"],
        "preserved": ["archived"],
        "archived": []
    }'::JSONB;
    allowed_next JSONB;
BEGIN
    IF OLD.preservation_state = NEW.preservation_state THEN
        RETURN NEW;
    END IF;
    IF OLD.preservation_state IS NULL THEN
        RETURN NEW;
    END IF;
    allowed_next := valid_transitions->OLD.preservation_state;
    IF allowed_next IS NULL OR NOT (allowed_next ? NEW.preservation_state) THEN
        RAISE EXCEPTION 'Invalid state transition: % -> %',
            OLD.preservation_state, NEW.preservation_state;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validate_preservation_state
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    WHEN (OLD.preservation_state IS DISTINCT FROM NEW.preservation_state)
    EXECUTE FUNCTION validate_preservation_state_transition();

-- RLS
ALTER TABLE memorials ENABLE ROW LEVEL SECURITY;

-- Owners can view their own memorials
CREATE POLICY "Owners can view own memorials"
    ON memorials FOR SELECT
    USING (user_id = auth.uid() OR status = 'published');

-- Owners can insert memorials
CREATE POLICY "Authenticated users can create memorials"
    ON memorials FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Owners can update own memorials
CREATE POLICY "Owners can update own memorials"
    ON memorials FOR UPDATE
    USING (user_id = auth.uid());

-- Owners can delete own memorials
CREATE POLICY "Owners can delete own memorials"
    ON memorials FOR DELETE
    USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access to memorials"
    ON memorials FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 4: MEMORIAL AUTHORIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_authorizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    user_id UUID REFERENCES auth.users(id),
    memorial_id UUID REFERENCES memorials(id) ON DELETE CASCADE,

    -- Creator Information
    creator_full_name TEXT NOT NULL,
    creator_dob DATE,
    creator_address TEXT,
    creator_city_state_zip TEXT,
    creator_email TEXT NOT NULL,
    creator_phone TEXT,
    relationship_to_deceased TEXT NOT NULL,
    relationship_other TEXT,

    -- Deceased Information
    deceased_full_name TEXT NOT NULL,
    deceased_dob DATE NOT NULL,
    deceased_dod DATE,
    deceased_death_place TEXT,
    deceased_last_residence TEXT,

    -- Authority & Agreements
    agree_legal_authority BOOLEAN DEFAULT FALSE,
    agree_good_faith BOOLEAN DEFAULT FALSE,
    agree_permanence BOOLEAN DEFAULT FALSE,
    agree_indemnification BOOLEAN DEFAULT FALSE,
    indemnification_accepted BOOLEAN DEFAULT FALSE,
    accuracy_confirmed BOOLEAN DEFAULT FALSE,
    copyright_confirmed BOOLEAN DEFAULT FALSE,
    privacy_confirmed BOOLEAN DEFAULT FALSE,

    -- Electronic Signature
    signature_type TEXT DEFAULT 'typed'
        CHECK (signature_type IN ('typed', 'drawn')),
    electronic_signature TEXT NOT NULL,
    signature_date TIMESTAMPTZ NOT NULL,
    signature_ip_address TEXT,
    signature_user_agent TEXT,
    device_fingerprint TEXT,
    geolocation TEXT,

    -- Status
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Storage
    pdf_storage_path TEXT,
    authorization_type TEXT DEFAULT 'individual'
        CHECK (authorization_type IN ('account', 'individual')),
    video_storage_path TEXT,
    video_hash TEXT,

    -- Payment tracking (for concierge)
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_user_id ON memorial_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_memorial_id ON memorial_authorizations(memorial_id);
CREATE INDEX IF NOT EXISTS idx_auth_status ON memorial_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_auth_created_at ON memorial_authorizations(created_at DESC);

-- Trigger
CREATE TRIGGER update_memorial_authorizations_updated_at
    BEFORE UPDATE ON memorial_authorizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE memorial_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own authorizations"
    ON memorial_authorizations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create authorizations"
    ON memorial_authorizations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own authorizations"
    ON memorial_authorizations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to authorizations"
    ON memorial_authorizations FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 5: MEMORIAL VERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    change_summary TEXT NOT NULL,
    change_reason TEXT,
    change_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (change_type IN ('manual', 'auto_save', 'witness_contribution', 'restore')),
    steps_modified INTEGER[] NOT NULL DEFAULT '{}',
    snapshot_data JSONB NOT NULL,
    is_full_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
    is_restored_from UUID REFERENCES memorial_versions(id),

    CONSTRAINT unique_version_per_memorial UNIQUE (memorial_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_versions_memorial_date ON memorial_versions(memorial_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_created_by ON memorial_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_versions_type ON memorial_versions(memorial_id, change_type);

-- Function: get next version number
CREATE OR REPLACE FUNCTION get_next_version_number(p_memorial_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(MAX(version_number), 0) + 1
    FROM memorial_versions
    WHERE memorial_id = p_memorial_id;
$$ LANGUAGE sql STABLE;

-- RLS
ALTER TABLE memorial_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read versions of their memorials"
    ON memorial_versions FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete versions of their memorials"
    ON memorial_versions FOR DELETE
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role full access to versions"
    ON memorial_versions FOR ALL
    USING (auth.role() = 'service_role');

GRANT ALL ON memorial_versions TO service_role;


-- ============================================================
-- SECTION 6: WITNESS INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS witness_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    inviter_name TEXT NOT NULL DEFAULT '',
    invitee_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'witness'
        CHECK (role IN ('witness', 'co_guardian')),
    personal_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_witness_inv_memorial ON witness_invitations(memorial_id);
CREATE INDEX IF NOT EXISTS idx_witness_inv_email ON witness_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_witness_inv_status ON witness_invitations(status);

-- RLS
ALTER TABLE witness_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can read by ID (for accepting invitations via link)
CREATE POLICY "Public can read invitations by id"
    ON witness_invitations FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create invitations"
    ON witness_invitations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update invitations"
    ON witness_invitations FOR UPDATE
    USING (true);

CREATE POLICY "Service role full access to invitations"
    ON witness_invitations FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 7: MEMORIAL CONTRIBUTIONS (from witnesses)
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    witness_name TEXT,
    type TEXT NOT NULL DEFAULT 'memory'
        CHECK (type IN ('memory', 'photo', 'video')),
    content JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending_approval'
        CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contributions_memorial ON memorial_contributions(memorial_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON memorial_contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON memorial_contributions(user_id);

-- RLS
ALTER TABLE memorial_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved contributions"
    ON memorial_contributions FOR SELECT
    USING (status = 'approved' OR user_id = auth.uid());

CREATE POLICY "Anyone can submit contributions"
    ON memorial_contributions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Owners can update contributions"
    ON memorial_contributions FOR UPDATE
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
        OR user_id = auth.uid()
    );

CREATE POLICY "Service role full access to contributions"
    ON memorial_contributions FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 7.5: MEMORIAL MEDIA ASSETS
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_media_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    contribution_id UUID REFERENCES memorial_contributions(id) ON DELETE SET NULL,
    kind TEXT NOT NULL
        CHECK (
            kind IN (
                'profile_photo',
                'cover_photo',
                'gallery_photo',
                'interactive_photo',
                'voice_recording',
                'video',
                'video_thumbnail',
                'contribution_photo'
            )
        ),
    bucket TEXT NOT NULL
        CHECK (bucket IN ('memorial-media', 'videos')),
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    original_file_name TEXT,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    sha256_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memorial_media_assets_bucket_storage
    ON memorial_media_assets(bucket, storage_path);
CREATE INDEX IF NOT EXISTS idx_memorial_media_assets_memorial
    ON memorial_media_assets(memorial_id);
CREATE INDEX IF NOT EXISTS idx_memorial_media_assets_kind
    ON memorial_media_assets(kind);
CREATE INDEX IF NOT EXISTS idx_memorial_media_assets_deleted_at
    ON memorial_media_assets(deleted_at);

ALTER TABLE memorial_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to memorial media assets"
    ON memorial_media_assets FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- SECTION 8: MEMORIAL RELATIONS (family connections)
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    to_memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
        CHECK (relationship_type IN ('parent', 'child', 'spouse', 'sibling', 'other')),
    description TEXT,
    accepted_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Prevent duplicate relations
    CONSTRAINT unique_relation UNIQUE (from_memorial_id, to_memorial_id, relationship_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_relations_from ON memorial_relations(from_memorial_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON memorial_relations(to_memorial_id);

-- RLS
ALTER TABLE memorial_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view relations"
    ON memorial_relations FOR SELECT
    USING (true);

CREATE POLICY "Owners can manage relations"
    ON memorial_relations FOR INSERT
    WITH CHECK (
        from_memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners can update relations"
    ON memorial_relations FOR UPDATE
    USING (
        from_memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Owners can delete relations"
    ON memorial_relations FOR DELETE
    USING (
        from_memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role full access to relations"
    ON memorial_relations FOR ALL
    USING (auth.role() = 'service_role');

-- ── Mode enforcement: Only family-mode memorials can have relations ──────────

CREATE OR REPLACE FUNCTION enforce_family_mode_relations()
RETURNS TRIGGER AS $$
DECLARE
  from_mode TEXT;
  to_mode TEXT;
BEGIN
  SELECT mode INTO from_mode FROM memorials WHERE id = NEW.from_memorial_id;
  SELECT mode INTO to_mode FROM memorials WHERE id = NEW.to_memorial_id;
  IF from_mode IS NULL THEN
    RAISE EXCEPTION 'Source memorial not found: %', NEW.from_memorial_id;
  END IF;
  IF to_mode IS NULL THEN
    RAISE EXCEPTION 'Target memorial not found: %', NEW.to_memorial_id;
  END IF;
  IF from_mode != 'family' OR to_mode != 'family' THEN
    RAISE EXCEPTION 'Relations are only allowed between family-mode memorials. from_mode=%, to_mode=%', from_mode, to_mode;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_enforce_family_mode_relations
  BEFORE INSERT ON memorial_relations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_family_mode_relations();

-- ── Prevent downgrading mode if relations exist ─────────────────────────────

CREATE OR REPLACE FUNCTION prevent_mode_downgrade_with_relations()
RETURNS TRIGGER AS $$
DECLARE
  relation_count INTEGER;
BEGIN
  IF OLD.mode = 'family' AND NEW.mode != 'family' THEN
    SELECT COUNT(*) INTO relation_count
    FROM memorial_relations
    WHERE from_memorial_id = NEW.id OR to_memorial_id = NEW.id;
    IF relation_count > 0 THEN
      RAISE EXCEPTION 'Cannot change mode from family to % — this memorial has % active relation(s). Remove all relations first.', NEW.mode, relation_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_mode_downgrade_with_relations
  BEFORE UPDATE ON memorials
  FOR EACH ROW
  WHEN (OLD.mode IS DISTINCT FROM NEW.mode)
  EXECUTE FUNCTION prevent_mode_downgrade_with_relations();


-- ============================================================
-- SECTION 9: USER SUCCESSORS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_successors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    successor_name TEXT NOT NULL,
    successor_email TEXT NOT NULL,
    relationship TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),
    verification_token UUID DEFAULT gen_random_uuid(),
    access_level TEXT DEFAULT 'editorial'
        CHECK (access_level IN ('read_only', 'editorial', 'full_ownership')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_successors_user ON user_successors(user_id);
CREATE INDEX IF NOT EXISTS idx_successors_email ON user_successors(successor_email);
CREATE INDEX IF NOT EXISTS idx_successors_token ON user_successors(verification_token);

-- RLS
ALTER TABLE user_successors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own successors"
    ON user_successors FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own successors"
    ON user_successors FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own successors"
    ON user_successors FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own successors"
    ON user_successors FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to successors"
    ON user_successors FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 10: SUCCESSION ACTIVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS succession_activations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    successor_id UUID NOT NULL REFERENCES user_successors(id) ON DELETE CASCADE,
    death_certificate_url TEXT,
    id_proof_url TEXT,
    request_note TEXT,
    status TEXT NOT NULL DEFAULT 'under_review'
        CHECK (status IN ('under_review', 'approved', 'rejected')),
    verification_period_ends TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE succession_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to activations"
    ON succession_activations FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own activations"
    ON succession_activations FOR SELECT
    USING (
        successor_id IN (SELECT id FROM user_successors WHERE user_id = auth.uid())
    );


-- ============================================================
-- SECTION 11: MEMORIAL REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS memorial_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    memorial_name TEXT,
    remind_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    sent_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user ON memorial_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON memorial_reminders(status, remind_at);

-- RLS
ALTER TABLE memorial_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
    ON memorial_reminders FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create reminders"
    ON memorial_reminders FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access to reminders"
    ON memorial_reminders FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 12: CONCIERGE TABLES
-- ============================================================

-- 12.1 Concierge Projects
CREATE TABLE IF NOT EXISTS concierge_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    initial_message TEXT,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'in_progress', 'in_review', 'finalized')),

    -- Person being memorialized
    person_full_name TEXT,
    person_birth_date TEXT,
    person_death_date TEXT,
    relationship TEXT,
    materials_inventory JSONB DEFAULT '{}',
    preservation_priorities TEXT,
    sensitive_aspects TEXT,
    contact_preference TEXT DEFAULT 'email'
        CHECK (contact_preference IN ('email', 'call')),

    -- Payment
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    total_amount INTEGER DEFAULT 0,
    amount_paid_so_far INTEGER DEFAULT 0,
    payment_phase TEXT DEFAULT 'pending'
        CHECK (payment_phase IN ('pending', 'deposit_30', 'draft_40', 'final_30', 'complete')),
    upgraded_from TEXT,
    differential_amount INTEGER DEFAULT 0,

    -- Content
    zoom_link TEXT,
    content_preview JSONB DEFAULT '{}',
    memorial_data JSONB DEFAULT '{}'
);

-- 12.2 Concierge Files
CREATE TABLE IF NOT EXISTS concierge_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    project_id UUID NOT NULL REFERENCES concierge_projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    public_url TEXT,
    user_note TEXT
);

-- 12.3 Concierge Notes
CREATE TABLE IF NOT EXISTS concierge_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    project_id UUID NOT NULL REFERENCES concierge_projects(id) ON DELETE CASCADE,
    note_type TEXT NOT NULL DEFAULT 'text'
        CHECK (note_type IN ('text', 'voice')),
    content TEXT,
    audio_url TEXT,
    from_user BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_concierge_projects_user_id ON concierge_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_status ON concierge_projects(status);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_email ON concierge_projects(email);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_created_at ON concierge_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_files_project_id ON concierge_files(project_id);
CREATE INDEX IF NOT EXISTS idx_concierge_notes_project_id ON concierge_notes(project_id);

-- Trigger
CREATE TRIGGER update_concierge_projects_updated_at
    BEFORE UPDATE ON concierge_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE concierge_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own concierge projects"
    ON concierge_projects FOR SELECT
    USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create concierge projects"
    ON concierge_projects FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update own concierge projects"
    ON concierge_projects FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to concierge_projects"
    ON concierge_projects FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own concierge files"
    ON concierge_files FOR SELECT
    USING (
        project_id IN (SELECT id FROM concierge_projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Anyone can upload concierge files"
    ON concierge_files FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role full access to concierge_files"
    ON concierge_files FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own concierge notes"
    ON concierge_notes FOR SELECT
    USING (
        project_id IN (SELECT id FROM concierge_projects WHERE user_id = auth.uid())
    );

CREATE POLICY "Anyone can create concierge notes"
    ON concierge_notes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role full access to concierge_notes"
    ON concierge_notes FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 13: ARWEAVE TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS arweave_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    tx_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'confirming', 'confirmed', 'failed')),
    gateway_urls TEXT[] DEFAULT '{}',
    file_count INTEGER DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arweave_tx_memorial ON arweave_transactions(memorial_id);
CREATE INDEX IF NOT EXISTS idx_arweave_tx_id ON arweave_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_arweave_tx_status ON arweave_transactions(status);

-- Trigger
CREATE TRIGGER tr_arweave_transactions_updated_at
    BEFORE UPDATE ON arweave_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE arweave_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own arweave transactions"
    ON arweave_transactions FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages arweave transactions"
    ON arweave_transactions FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 14: ANCHOR DEVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS anchor_devices (
    id TEXT PRIMARY KEY,  -- client-generated device ID
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL DEFAULT 'Unknown Device',
    browser TEXT DEFAULT 'Unknown',
    os TEXT DEFAULT 'Unknown',
    sync_progress_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'syncing'
        CHECK (status IN ('syncing', 'synced', 'error', 'stale')),
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anchor_user ON anchor_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_anchor_memorial ON anchor_devices(memorial_id);
CREATE INDEX IF NOT EXISTS idx_anchor_status ON anchor_devices(status);

-- Trigger
CREATE TRIGGER tr_anchor_devices_updated_at
    BEFORE UPDATE ON anchor_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE anchor_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
    ON anchor_devices FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own devices"
    ON anchor_devices FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to anchor_devices"
    ON anchor_devices FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 15: RECOVERY CONTACTS (Social Recovery / Shamir's SSS)
-- ============================================================

CREATE TABLE IF NOT EXISTS recovery_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    relationship TEXT DEFAULT '',
    key_shard_encrypted TEXT,
    shard_index INTEGER,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'delivered')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_contacts(user_id);

-- Trigger
CREATE TRIGGER tr_recovery_contacts_updated_at
    BEFORE UPDATE ON recovery_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE recovery_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery contacts"
    ON recovery_contacts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own recovery contacts"
    ON recovery_contacts FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to recovery_contacts"
    ON recovery_contacts FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 16: ENCRYPTION KEYS
-- ============================================================

CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_encryption_memorial ON encryption_keys(memorial_id);

-- RLS
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own encryption keys"
    ON encryption_keys FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages encryption keys"
    ON encryption_keys FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 17: CONTENT REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS content_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_submitted'
        CHECK (status IN ('not_submitted', 'pending_review', 'approved', 'needs_changes')),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    flagged_items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_review_memorial ON content_reviews(memorial_id);

-- Trigger
CREATE TRIGGER tr_content_reviews_updated_at
    BEFORE UPDATE ON content_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content reviews"
    ON content_reviews FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages content reviews"
    ON content_reviews FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 18: PRESERVATION CERTIFICATES
-- ============================================================

CREATE TABLE IF NOT EXISTS preservation_certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    certificate_data JSONB NOT NULL DEFAULT '{}',
    pdf_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_memorial ON preservation_certificates(memorial_id);

-- RLS
ALTER TABLE preservation_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
    ON preservation_certificates FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages certificates"
    ON preservation_certificates FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================
-- SECTION 19: STORAGE BUCKETS
-- ============================================================
-- NOTE: Buckets are created via SQL below, but you may also
-- create them manually in Dashboard > Storage > New Bucket

-- 19.1 Videos bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'videos',
    'videos',
    true,
    524288000,  -- 500MB
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- 19.2 Concierge files bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'concierge-files',
    'concierge-files',
    true,
    104857600,  -- 100MB
    NULL  -- allow all file types
)
ON CONFLICT (id) DO NOTHING;

-- 19.3 Authorization PDFs bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'authorization-pdfs',
    'authorization-pdfs',
    false,
    10485760,  -- 10MB
    ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- 19.4 Memorial media bucket (public - photos, audio, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'memorial-media',
    'memorial-media',
    true,
    104857600,  -- 100MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- 19.5 Certificates bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'certificates',
    'certificates',
    false,
    10485760,  -- 10MB
    ARRAY['application/pdf', 'image/png']
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 20: STORAGE BUCKET POLICIES
-- ============================================================

-- Videos bucket policies
CREATE POLICY "Anyone can read videos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'videos');

CREATE POLICY "Service role can manage videos"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'videos'
        AND auth.role() = 'service_role'
    )
    WITH CHECK (
        bucket_id = 'videos'
        AND auth.role() = 'service_role'
    );

-- Paid users video upload restriction (optional, uncomment if needed)
-- CREATE POLICY "Only paid users can upload videos"
--     ON storage.objects FOR INSERT
--     TO public
--     WITH CHECK (
--         bucket_id = 'videos' AND (
--             SELECT paid FROM memorials WHERE id::text = (storage.foldername(name))[1]
--         ) = true
--     );

-- Concierge files policies
CREATE POLICY "Anyone can upload concierge files"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'concierge-files');

CREATE POLICY "Anyone can read concierge files"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'concierge-files');

CREATE POLICY "Anyone can delete concierge files"
    ON storage.objects FOR DELETE
    TO public
    USING (bucket_id = 'concierge-files');

-- Authorization PDFs policies
CREATE POLICY "Users can upload authorization PDFs"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'authorization-pdfs');

CREATE POLICY "Users can read authorization PDFs"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'authorization-pdfs');

-- Memorial media policies
CREATE POLICY "Anyone can read memorial media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'memorial-media');

CREATE POLICY "Service role can manage memorial media"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'memorial-media'
        AND auth.role() = 'service_role'
    )
    WITH CHECK (
        bucket_id = 'memorial-media'
        AND auth.role() = 'service_role'
    );

-- Certificates policies
CREATE POLICY "Users can view own certificates files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'certificates'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Service role can manage certificates files"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'certificates'
        AND auth.role() = 'service_role'
    );


-- ============================================================
-- SECTION 21: VERIFICATION QUERIES
-- ============================================================
-- Run these after executing everything above to verify setup.

-- Check all 20 tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'users',
    'memorials',
    'memorial_authorizations',
    'memorial_versions',
    'witness_invitations',
    'memorial_contributions',
    'memorial_media_assets',
    'memorial_relations',
    'user_successors',
    'succession_activations',
    'memorial_reminders',
    'concierge_projects',
    'concierge_files',
    'concierge_notes',
    'arweave_transactions',
    'anchor_devices',
    'recovery_contacts',
    'encryption_keys',
    'content_reviews',
    'preservation_certificates'
)
ORDER BY table_name;

-- Check all storage buckets exist
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('videos', 'concierge-files', 'authorization-pdfs', 'memorial-media', 'certificates');

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'memorials', 'memorial_authorizations', 'memorial_versions',
    'witness_invitations', 'memorial_contributions', 'memorial_media_assets', 'memorial_relations',
    'user_successors', 'succession_activations', 'memorial_reminders',
    'concierge_projects', 'concierge_files', 'concierge_notes',
    'arweave_transactions', 'anchor_devices', 'recovery_contacts',
    'encryption_keys', 'content_reviews', 'preservation_certificates'
);


-- ============================================================
-- SECTION 22
-- ============================================================

ALTER TABLE witness_invitations
ADD COLUMN IF NOT EXISTS plan TEXT
  NOT NULL DEFAULT 'personal'
  CHECK (plan IN ('personal', 'family'));


-- After 

ALTER TABLE memorial_contributions
ADD COLUMN IF NOT EXISTS contributor_email TEXT,
ADD COLUMN IF NOT EXISTS contributor_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code TEXT,
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

--After 

CREATE TABLE IF NOT EXISTS user_memorial_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'witness', 'co_guardian')),
  invited_via_invitation_id UUID REFERENCES witness_invitations(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_visited_at TIMESTAMPTZ,
  CONSTRAINT unique_user_memorial UNIQUE (user_id, memorial_id)
);

CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_user ON user_memorial_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_memorial ON user_memorial_roles(memorial_id);
CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_role ON user_memorial_roles(memorial_id, role);

-- After 

ALTER TABLE user_memorial_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON user_memorial_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can view all roles for their memorials"
  ON user_memorial_roles FOR SELECT
  USING (
    memorial_id IN (
      SELECT id FROM memorials WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON user_memorial_roles FOR ALL
  USING (auth.role() = 'service_role');

-- After 

CREATE OR REPLACE FUNCTION link_anonymous_contributions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE memorial_contributions
  SET
    user_id = NEW.id,
    is_anonymous = FALSE
  WHERE
    contributor_email = NEW.email
    AND is_anonymous = TRUE
    AND contributor_verified = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_link_anonymous_contributions
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_anonymous_contributions();

-- After 

CREATE OR REPLACE FUNCTION accept_invitation(
  p_invitation_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invitation witness_invitations%ROWTYPE;
  v_role_id UUID;
BEGIN
  SELECT * INTO v_invitation
  FROM witness_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITATION_NOT_FOUND');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITATION_NOT_PENDING', 'status', v_invitation.status);
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    UPDATE witness_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RETURN jsonb_build_object('success', false, 'error', 'INVITATION_EXPIRED');
  END IF;

  UPDATE witness_invitations
  SET status = 'accepted', accepted_by_user_id = p_user_id
  WHERE id = p_invitation_id;

  INSERT INTO user_memorial_roles (
    user_id, memorial_id, role, invited_via_invitation_id, joined_at
  ) VALUES (
    p_user_id, v_invitation.memorial_id, v_invitation.role, p_invitation_id, NOW()
  )
  ON CONFLICT (user_id, memorial_id) DO NOTHING
  RETURNING id INTO v_role_id;

  RETURN jsonb_build_object(
    'success', true,
    'memorial_id', v_invitation.memorial_id,
    'role', v_invitation.role,
    'plan', v_invitation.plan
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- After 

CREATE TABLE IF NOT EXISTS flow_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flow_events_event
  ON flow_events(event);
CREATE INDEX idx_flow_events_created
  ON flow_events(created_at);

-- After

DROP TRIGGER IF EXISTS tr_link_anonymous_contributions ON auth.users;
DROP FUNCTION IF EXISTS link_anonymous_contributions();

-- After 

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'memorials'
ORDER BY column_name;

-- After 

-- Add the missing column to witness_invitations table
ALTER TABLE witness_invitations 
ADD COLUMN accepted_by_user_id UUID REFERENCES auth.users(id);

-- Optional: Add an index for better query performance
CREATE INDEX idx_witness_invitations_accepted_by_user_id 
ON witness_invitations(accepted_by_user_id);

-- After 

SELECT * FROM memorial_contributions;

-- After 

DROP POLICY IF EXISTS "Owners can update contributions" ON memorial_contributions;

CREATE POLICY "Owners can update contributions"
 ON memorial_contributions FOR UPDATE
 USING (
   -- Only allow the owner of the memorial, OR the owner of the contribution
   memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
 );

-- After 

-- 1. Remove the old, permissive policy
DROP POLICY IF EXISTS "Owners can update contributions" ON memorial_contributions;

-- 2. Create the strict policy
CREATE POLICY "Only owners/co-guardians can update contributions"
 ON memorial_contributions FOR UPDATE
 USING (
   -- Allow if the user owns the memorial
   memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
   OR
   -- OR allow if the user is a co-guardian for this memorial
   memorial_id IN (
     SELECT memorial_id 
     FROM user_memorial_roles 
     WHERE user_id = auth.uid() 
     AND role = 'co_guardian'
   )
 );

-- ============================================================
-- FIX: Identity, Authorization & Data Visibility Bugs
-- ============================================================
-- IMPORTANT: RLS policies on memorials and user_memorial_roles
-- previously formed a circular dependency (each table's SELECT
-- policy subqueried the other), causing PostgreSQL error 42P17:
-- "infinite recursion detected in policy for relation memorials".
--
-- Solution: SECURITY DEFINER helper functions that bypass RLS,
-- breaking the cycle while keeping the same access logic.
-- ============================================================

-- Helper: memorial IDs where the user has any role (bypasses user_memorial_roles RLS)
CREATE OR REPLACE FUNCTION get_memorial_ids_for_user(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT memorial_id FROM user_memorial_roles WHERE user_id = p_user_id;
$$;

-- Helper: memorial IDs owned by the user (bypasses memorials RLS)
CREATE OR REPLACE FUNCTION get_owned_memorial_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id FROM memorials WHERE user_id = p_user_id;
$$;

-- Helper: memorial IDs where the user is co-guardian (bypasses user_memorial_roles RLS)
CREATE OR REPLACE FUNCTION get_co_guardian_memorial_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT memorial_id FROM user_memorial_roles
  WHERE user_id = p_user_id AND role = 'co_guardian';
$$;

-- BUG 1 FIX: Owners and co-guardians can now see ALL contributions
-- (including pending) for their memorials, not just approved ones.

DROP POLICY IF EXISTS "Anyone can view approved contributions" ON memorial_contributions;

CREATE POLICY "Anyone can view approved contributions"
  ON memorial_contributions FOR SELECT
  USING (
    status = 'approved'
    OR user_id = auth.uid()
    OR memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
    OR memorial_id IN (SELECT get_co_guardian_memorial_ids(auth.uid()))
  );

-- BUG 2 FIX: Co-guardians and witnesses can now see draft memorials.

DROP POLICY IF EXISTS "Owners and role-holders can view memorials" ON memorials;
DROP POLICY IF EXISTS "Owners can view own memorials" ON memorials;

CREATE POLICY "Owners and role-holders can view memorials"
  ON memorials FOR SELECT
  USING (
    user_id = auth.uid()
    OR status = 'published'
    OR id IN (SELECT get_memorial_ids_for_user(auth.uid()))
  );

-- BUG 3 FIX: Co-guardians can now update memorials.

DROP POLICY IF EXISTS "Owners and co-guardians can update memorials" ON memorials;
DROP POLICY IF EXISTS "Owners can update own memorials" ON memorials;

CREATE POLICY "Owners and co-guardians can update memorials"
  ON memorials FOR UPDATE
  USING (
    user_id = auth.uid()
    OR id IN (SELECT get_co_guardian_memorial_ids(auth.uid()))
  );

-- FIX the other side of the cycle: user_memorial_roles SELECT was
-- subquerying memorials directly, now uses the helper function.

DROP POLICY IF EXISTS "Owners can view all roles for their memorials" ON user_memorial_roles;

CREATE POLICY "Owners can view all roles for their memorials"
  ON user_memorial_roles FOR SELECT
  USING (
    memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
  );

-- BUG 4 FIX (part 1): Allow users to insert their own role row.

DROP POLICY IF EXISTS "Users can insert own role" ON user_memorial_roles;

CREATE POLICY "Users can insert own role"
  ON user_memorial_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- BUG 4 FIX (part 2): Backfill existing memorials with owner roles.

INSERT INTO user_memorial_roles (user_id, memorial_id, role, joined_at)
SELECT user_id, id, 'owner', created_at
FROM memorials
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, memorial_id) DO NOTHING;

-- BUG 5 FIX: Enable realtime for contributions table.
-- Wrapped in DO block to avoid error if already a member.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_contributions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;


-- ============================================================
-- SECTION 23
-- ============================================================


-- Migration : Enforce family-mode isolation for memorial_relations
-- Rule: Only memorials with mode='family' can have relationships

-- ============================================================
-- STEP 1: Clean up any existing invalid relations
-- (relations involving non-family memorials)
-- ============================================================
DELETE FROM memorial_relations
WHERE from_memorial_id IN (SELECT id FROM memorials WHERE mode != 'family')
   OR to_memorial_id IN (SELECT id FROM memorials WHERE mode != 'family');

-- ============================================================
-- STEP 2: Trigger — block INSERT of relations on non-family memorials
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_family_mode_relations()
RETURNS TRIGGER AS $$
DECLARE
  from_mode TEXT;
  to_mode TEXT;
BEGIN
  SELECT mode INTO from_mode FROM memorials WHERE id = NEW.from_memorial_id;
  SELECT mode INTO to_mode FROM memorials WHERE id = NEW.to_memorial_id;

  IF from_mode IS NULL THEN
    RAISE EXCEPTION 'Source memorial not found: %', NEW.from_memorial_id;
  END IF;

  IF to_mode IS NULL THEN
    RAISE EXCEPTION 'Target memorial not found: %', NEW.to_memorial_id;
  END IF;

  IF from_mode != 'family' OR to_mode != 'family' THEN
    RAISE EXCEPTION 'Relations are only allowed between family-mode memorials. from_mode=%, to_mode=%', from_mode, to_mode;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_enforce_family_mode_relations
  BEFORE INSERT ON memorial_relations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_family_mode_relations();

-- ============================================================
-- STEP 3: Trigger — prevent downgrading memorial mode if relations exist
-- (blocks family → personal/draft if memorial has active relations)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_mode_downgrade_with_relations()
RETURNS TRIGGER AS $$
DECLARE
  relation_count INTEGER;
BEGIN
  -- Only check when mode is changing away from 'family'
  IF OLD.mode = 'family' AND NEW.mode != 'family' THEN
    SELECT COUNT(*) INTO relation_count
    FROM memorial_relations
    WHERE from_memorial_id = NEW.id OR to_memorial_id = NEW.id;

    IF relation_count > 0 THEN
      RAISE EXCEPTION 'Cannot change mode from family to % — this memorial has % active relation(s). Remove all relations first.', NEW.mode, relation_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_mode_downgrade_with_relations
  BEFORE UPDATE ON memorials
  FOR EACH ROW
  WHEN (OLD.mode IS DISTINCT FROM NEW.mode)
  EXECUTE FUNCTION prevent_mode_downgrade_with_relations();


  -- ============================================================
-- SECTION 24
-- ============================================================

-- Commands to execute in Supabase SQL Editor (in order)
-- Phase: Role Management & UX Cleanup

-- 1. Add 'reader' role to user_memorial_roles table
ALTER TABLE user_memorial_roles DROP CONSTRAINT IF EXISTS user_memorial_roles_role_check;
ALTER TABLE user_memorial_roles ADD CONSTRAINT user_memorial_roles_role_check
  CHECK (role IN ('owner', 'witness', 'co_guardian', 'reader'));

-- 2. Add 'reader' role to witness_invitations table
ALTER TABLE witness_invitations DROP CONSTRAINT IF EXISTS witness_invitations_role_check;
ALTER TABLE witness_invitations ADD CONSTRAINT witness_invitations_role_check
  CHECK (role IN ('witness', 'co_guardian', 'reader'));

-- Note: Existing RLS policies on user_memorial_roles already handle
-- view access via role membership. Readers will be able to view
-- memorial data through the same policies that govern witnesses.
-- No additional RLS policies are required.

  -- ============================================================
-- SECTION 24
-- ============================================================


-- 1. Enable Realtime for user_memorial_roles (Required for mid-session downgrades)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_memorial_roles;
EXCEPTION WHEN duplicate_object THEN 
  NULL;
END;
$$;

-- 2. Prevent Owner Role Removal (Last Admin Protection)
CREATE OR REPLACE FUNCTION prevent_owner_role_removal()
RETURNS TRIGGER AS $$
DECLARE
  memorial_owner_id UUID;
BEGIN
  SELECT user_id INTO memorial_owner_id FROM memorials WHERE id = OLD.memorial_id;
  IF OLD.user_id = memorial_owner_id AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the Owner role from the memorial owner.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_owner_role_removal ON user_memorial_roles;
CREATE TRIGGER tr_prevent_owner_role_removal
  BEFORE DELETE ON user_memorial_roles
  FOR EACH ROW EXECUTE FUNCTION prevent_owner_role_removal();

-- 3. Lock down role updates (Only API routes using service_role can change roles)
DROP POLICY IF EXISTS "Owners can update roles" ON user_memorial_roles;
CREATE POLICY "Only service_role can update roles"
  ON user_memorial_roles FOR UPDATE
  USING (auth.role() = 'service_role');

-- 4. Prevent Duplicate Pending Invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
  ON witness_invitations(memorial_id, invitee_email)
  WHERE status = 'pending';

-- 1. Delete older duplicate pending invitations, keeping only the most recent one
DELETE FROM witness_invitations
WHERE status = 'pending'
AND id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY memorial_id, invitee_email 
                   ORDER BY created_at DESC
               ) as row_num
        FROM witness_invitations
        WHERE status = 'pending'
    ) duplicates
    WHERE duplicates.row_num > 1
);

-- 2. Now that duplicates are gone, apply the unique index safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
  ON witness_invitations(memorial_id, invitee_email)
  WHERE status = 'pending';

  -- 5. Harden witness_invitations UPDATE policy (Close security gap)
DROP POLICY IF EXISTS "Authenticated users can update invitations" ON witness_invitations;
CREATE POLICY "Only memorial owner can update invitations"
  ON witness_invitations FOR UPDATE
  USING (
    memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
  );


-- 6. Add Infinite Revision Loop Tracking to memorial_contributions
ALTER TABLE memorial_contributions
  ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;


-- 7. Harden memorial_contributions INSERT policy
DROP POLICY IF EXISTS "Anyone can submit contributions" ON memorial_contributions;
CREATE POLICY "Verified contributors can submit"
  ON memorial_contributions FOR INSERT
  WITH CHECK (
    -- Authenticated users
    auth.uid() IS NOT NULL
    OR
    -- Anonymous users must have a server-set verification_code
    (is_anonymous = true AND verification_code IS NOT NULL)
  );


-- 8. Create Family Access Request Table (Corrected column name to avoid reserved keyword)
CREATE TABLE IF NOT EXISTS memorial_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL, -- Renamed from current_role to avoid keyword conflict
  request_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

-- Partial Unique Index to prevent multiple pending requests from the same user to the same archive
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_access_request
  ON memorial_access_requests (requester_user_id, memorial_id) 
  WHERE status = 'pending';

-- RLS Policies for memorial_access_requests
ALTER TABLE memorial_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view own requests"
  ON memorial_access_requests FOR SELECT
  USING (requester_user_id = auth.uid());

CREATE POLICY "Memorial owners can view requests for their memorials"
  ON memorial_access_requests FOR SELECT
  USING (memorial_id IN (SELECT get_owned_memorial_ids(auth.uid())));

CREATE POLICY "Authenticated users can create requests"
  ON memorial_access_requests FOR INSERT
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Owners can update requests"
  ON memorial_access_requests FOR UPDATE
  USING (memorial_id IN (SELECT get_owned_memorial_ids(auth.uid())));

CREATE POLICY "Service role full access to requests"
  ON memorial_access_requests FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Done
-- ============================================================


-- ============================================================
-- SECTION 25 (Codex commands)
-- ============================================================
-- Commands to execute in Supabase SQL Editor (in order)
-- Phase: Advanced review workflow + owner request queue

-- 1. Allow the richer contribution review state used by the steward UI
ALTER TABLE memorial_contributions
  DROP CONSTRAINT IF EXISTS memorial_contributions_status_check;

ALTER TABLE memorial_contributions
  ADD CONSTRAINT memorial_contributions_status_check
  CHECK (status IN ('pending_approval', 'approved', 'rejected', 'needs_changes'));

-- 2. Enable Realtime for family access requests so the steward queue stays fresh
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_access_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;


-- ============================================================
-- SECTION 26 (Codex commands)
-- ============================================================
-- Commands to execute in Supabase SQL Editor (in order)
-- Phase: Co-guardian family workspace + memorial creation requests

-- 1. Create a request table so co-guardians can ask the owner to add a new family memorial
CREATE TABLE IF NOT EXISTS memorial_creation_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
  proposed_name TEXT,
  request_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_memorial_id UUID REFERENCES memorials(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

-- 2. Prevent duplicate pending requests between the same owner and co-guardian
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_memorial_creation_request
  ON memorial_creation_requests (owner_user_id, requester_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_memorial_creation_requests_owner_status
  ON memorial_creation_requests (owner_user_id, status, created_at DESC);

-- 3. RLS for memorial creation requests
ALTER TABLE memorial_creation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view own memorial creation requests"
  ON memorial_creation_requests FOR SELECT
  USING (requester_user_id = auth.uid());

CREATE POLICY "Owners can view memorial creation requests"
  ON memorial_creation_requests FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Authenticated users can create memorial creation requests"
  ON memorial_creation_requests FOR INSERT
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Owners can update memorial creation requests"
  ON memorial_creation_requests FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Service role full access to memorial creation requests"
  ON memorial_creation_requests FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Enable Realtime so owner steward queues update when a co-guardian requests a memorial
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_creation_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

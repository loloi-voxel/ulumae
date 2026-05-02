-- EXTENSIONS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- CUSTOM TYPES AND ENUMS
-- No custom types or enums are defined in the source files.


-- TABLES

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    dead_mans_switch_enabled BOOLEAN DEFAULT FALSE,
    dead_mans_switch_delay_months INTEGER DEFAULT 12
        CHECK (dead_mans_switch_delay_months IN (3, 6, 12, 24)),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    verification_sent_at TIMESTAMPTZ,
    dead_mans_switch_warning_30_sent_at TIMESTAMPTZ,
    dead_mans_switch_warning_7_sent_at TIMESTAMPTZ,
    dead_mans_switch_warning_1_sent_at TIMESTAMPTZ,
    dead_mans_switch_transferred_at TIMESTAMPTZ,
    highest_plan TEXT DEFAULT 'none',
    family_display_name TEXT
);

CREATE TABLE IF NOT EXISTS memorials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    step1 JSONB NOT NULL DEFAULT '{}',
    step2 JSONB NOT NULL DEFAULT '{}',
    step3 JSONB NOT NULL DEFAULT '{}',
    step4 JSONB NOT NULL DEFAULT '{}',
    step5 JSONB NOT NULL DEFAULT '{}',
    step6 JSONB NOT NULL DEFAULT '{}',
    step7 JSONB NOT NULL DEFAULT '{}',
    step8 JSONB NOT NULL DEFAULT '{}',
    step9 JSONB NOT NULL DEFAULT '{"videos": []}',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    slug TEXT UNIQUE,
    mode VARCHAR(10) DEFAULT 'draft'
        CHECK (mode IN ('draft', 'personal', 'family')),
    full_name TEXT,
    birth_date DATE,
    death_date DATE,
    profile_photo_url TEXT,
    cover_photo_url TEXT,
    completed_steps INTEGER[] DEFAULT '{}',
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    paid BOOLEAN DEFAULT FALSE,
    payment_confirmed_at TIMESTAMPTZ,
    plan_type TEXT CHECK (plan_type IN ('personal', 'family', 'concierge')),
    amount_paid INTEGER DEFAULT 0,
    stripe_payment_id TEXT,
    refund_eligible BOOLEAN DEFAULT TRUE,
    upgraded_from TEXT,
    upgraded_at TIMESTAMPTZ,
    last_exported_at TIMESTAMPTZ,
    arweave_tx_id TEXT,
    preservation_state TEXT DEFAULT 'draft'
        CHECK (preservation_state IN ('draft', 'building', 'review', 'preserving', 'preserved', 'archived')),
    preservation_date TIMESTAMPTZ,
    content_size_bytes BIGINT DEFAULT 0,
    review_status TEXT DEFAULT 'not_submitted'
        CHECK (review_status IN ('not_submitted', 'pending_review', 'approved', 'needs_changes'))
);

CREATE TABLE IF NOT EXISTS memorial_authorizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    memorial_id UUID REFERENCES memorials(id) ON DELETE CASCADE,
    creator_full_name TEXT NOT NULL,
    creator_dob DATE,
    creator_address TEXT,
    creator_city_state_zip TEXT,
    creator_email TEXT NOT NULL,
    creator_phone TEXT,
    relationship_to_deceased TEXT NOT NULL,
    relationship_other TEXT,
    deceased_full_name TEXT NOT NULL,
    deceased_dob DATE NOT NULL,
    deceased_dod DATE,
    deceased_death_place TEXT,
    deceased_last_residence TEXT,
    agree_legal_authority BOOLEAN DEFAULT FALSE,
    agree_good_faith BOOLEAN DEFAULT FALSE,
    agree_permanence BOOLEAN DEFAULT FALSE,
    agree_indemnification BOOLEAN DEFAULT FALSE,
    indemnification_accepted BOOLEAN DEFAULT FALSE,
    accuracy_confirmed BOOLEAN DEFAULT FALSE,
    copyright_confirmed BOOLEAN DEFAULT FALSE,
    privacy_confirmed BOOLEAN DEFAULT FALSE,
    signature_type TEXT DEFAULT 'typed'
        CHECK (signature_type IN ('typed', 'drawn')),
    electronic_signature TEXT NOT NULL,
    signature_date TIMESTAMPTZ NOT NULL,
    signature_ip_address TEXT,
    signature_user_agent TEXT,
    device_fingerprint TEXT,
    geolocation TEXT,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    pdf_storage_path TEXT,
    authorization_type TEXT DEFAULT 'individual'
        CHECK (authorization_type IN ('account', 'individual')),
    video_storage_path TEXT,
    video_hash TEXT,
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ
);

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

CREATE TABLE IF NOT EXISTS witness_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    inviter_name TEXT NOT NULL DEFAULT '',
    invitee_email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'witness'
        CHECK (role IN ('witness', 'co_guardian', 'reader')),
    personal_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    plan TEXT NOT NULL DEFAULT 'personal'
        CHECK (plan IN ('personal', 'family')),
    accepted_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS memorial_contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    witness_name TEXT,
    contributor_email TEXT,
    contributor_verified BOOLEAN DEFAULT FALSE,
    verification_code TEXT,
    verification_expires_at TIMESTAMPTZ,
    is_anonymous BOOLEAN DEFAULT FALSE,
    type TEXT NOT NULL DEFAULT 'memory'
        CHECK (type IN ('memory', 'photo', 'video')),
    content JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending_approval'
        CHECK (status IN ('pending_approval', 'approved', 'rejected', 'needs_changes')),
    admin_notes TEXT,
    revision_count INTEGER DEFAULT 0,
    retracted_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS memorial_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS memorial_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    to_memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
        CHECK (relationship_type IN ('parent', 'child', 'spouse', 'sibling', 'other')),
    description TEXT,
    accepted_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_relation UNIQUE (from_memorial_id, to_memorial_id, relationship_type)
);

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

CREATE TABLE IF NOT EXISTS anchor_devices (
    id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS preservation_certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    certificate_data JSONB NOT NULL DEFAULT '{}',
    pdf_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_memorial_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'witness', 'co_guardian', 'reader')),
    invited_via_invitation_id UUID REFERENCES witness_invitations(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_visited_at TIMESTAMPTZ,
    CONSTRAINT unique_user_memorial UNIQUE (user_id, memorial_id)
);

CREATE TABLE IF NOT EXISTS memorial_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    requested_role TEXT NOT NULL,
    request_message TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'denied')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES auth.users(id)
);

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

CREATE TABLE IF NOT EXISTS memorial_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memorial_id UUID NOT NULL REFERENCES memorials(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    subject_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject_email TEXT,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    person_full_name TEXT,
    person_birth_date TEXT,
    person_death_date TEXT,
    relationship TEXT,
    materials_inventory JSONB DEFAULT '{}',
    preservation_priorities TEXT,
    sensitive_aspects TEXT,
    contact_preference TEXT DEFAULT 'email'
        CHECK (contact_preference IN ('email', 'call')),
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    total_amount INTEGER DEFAULT 0,
    amount_paid_so_far INTEGER DEFAULT 0,
    payment_phase TEXT DEFAULT 'pending'
        CHECK (payment_phase IN ('pending', 'deposit_30', 'draft_40', 'final_30', 'complete')),
    upgraded_from TEXT,
    differential_amount INTEGER DEFAULT 0,
    zoom_link TEXT,
    content_preview JSONB DEFAULT '{}',
    memorial_data JSONB DEFAULT '{}'
);

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

CREATE TABLE IF NOT EXISTS flow_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    session_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_session_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    fingerprint TEXT,
    device_label TEXT NOT NULL DEFAULT 'Unknown device',
    ip_address TEXT,
    user_agent TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, session_id)
);

CREATE TABLE IF NOT EXISTS notification_reads (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS user_two_factor_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friendly_name TEXT NOT NULL,
    secret_ciphertext TEXT NOT NULL,
    secret_iv TEXT NOT NULL,
    secret_auth_tag TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    last_verified_time_step BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_two_factor_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    code_hint TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_two_factor_trusted_sessions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, session_id)
);


-- INDEXES

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_dead_mans_switch ON users(dead_mans_switch_enabled)
    WHERE dead_mans_switch_enabled = true;

CREATE INDEX IF NOT EXISTS idx_memorials_user_id ON memorials(user_id);
CREATE INDEX IF NOT EXISTS idx_memorials_status ON memorials(status);
CREATE INDEX IF NOT EXISTS idx_memorials_created_at ON memorials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memorials_slug ON memorials(slug);
CREATE INDEX IF NOT EXISTS idx_memorials_mode ON memorials(mode);
CREATE INDEX IF NOT EXISTS idx_memorials_user_mode ON memorials(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_memorials_preservation_state ON memorials(preservation_state);
CREATE INDEX IF NOT EXISTS idx_memorials_arweave_tx ON memorials(arweave_tx_id);

CREATE INDEX IF NOT EXISTS idx_auth_user_id ON memorial_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_memorial_id ON memorial_authorizations(memorial_id);
CREATE INDEX IF NOT EXISTS idx_auth_status ON memorial_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_auth_created_at ON memorial_authorizations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_versions_memorial_date ON memorial_versions(memorial_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_created_by ON memorial_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_versions_type ON memorial_versions(memorial_id, change_type);

CREATE INDEX IF NOT EXISTS idx_witness_inv_memorial ON witness_invitations(memorial_id);
CREATE INDEX IF NOT EXISTS idx_witness_inv_email ON witness_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_witness_inv_status ON witness_invitations(status);
CREATE INDEX idx_witness_invitations_accepted_by_user_id ON witness_invitations(accepted_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation
    ON witness_invitations(memorial_id, invitee_email)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_contributions_memorial ON memorial_contributions(memorial_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON memorial_contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON memorial_contributions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS memorial_media_assets_bucket_storage_path_uidx
    ON memorial_media_assets(bucket, storage_path);
CREATE INDEX IF NOT EXISTS memorial_media_assets_memorial_id_idx
    ON memorial_media_assets(memorial_id);
CREATE INDEX IF NOT EXISTS memorial_media_assets_kind_idx
    ON memorial_media_assets(kind);
CREATE INDEX IF NOT EXISTS memorial_media_assets_deleted_at_idx
    ON memorial_media_assets(deleted_at);

CREATE INDEX IF NOT EXISTS idx_relations_from ON memorial_relations(from_memorial_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON memorial_relations(to_memorial_id);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON memorial_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON memorial_reminders(status, remind_at);

CREATE INDEX IF NOT EXISTS idx_arweave_tx_memorial ON arweave_transactions(memorial_id);
CREATE INDEX IF NOT EXISTS idx_arweave_tx_id ON arweave_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_arweave_tx_status ON arweave_transactions(status);

CREATE INDEX IF NOT EXISTS idx_anchor_user ON anchor_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_anchor_memorial ON anchor_devices(memorial_id);
CREATE INDEX IF NOT EXISTS idx_anchor_status ON anchor_devices(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_encryption_memorial ON encryption_keys(memorial_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_review_memorial ON content_reviews(memorial_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_memorial ON preservation_certificates(memorial_id);

CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_user ON user_memorial_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_memorial ON user_memorial_roles(memorial_id);
CREATE INDEX IF NOT EXISTS idx_user_memorial_roles_role ON user_memorial_roles(memorial_id, role);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_access_request
    ON memorial_access_requests(requester_user_id, memorial_id)
    WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_memorial_creation_request
    ON memorial_creation_requests(owner_user_id, requester_user_id)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_memorial_creation_requests_owner_status
    ON memorial_creation_requests(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memorial_activity_log_memorial_id_created_at_idx
    ON memorial_activity_log(memorial_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memorial_activity_log_actor_user_id_idx
    ON memorial_activity_log(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_successors_user ON user_successors(user_id);
CREATE INDEX IF NOT EXISTS idx_successors_email ON user_successors(successor_email);
CREATE INDEX IF NOT EXISTS idx_successors_token ON user_successors(verification_token);

CREATE INDEX IF NOT EXISTS idx_concierge_projects_user_id ON concierge_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_status ON concierge_projects(status);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_email ON concierge_projects(email);
CREATE INDEX IF NOT EXISTS idx_concierge_projects_created_at ON concierge_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_files_project_id ON concierge_files(project_id);
CREATE INDEX IF NOT EXISTS idx_concierge_notes_project_id ON concierge_notes(project_id);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_contacts(user_id);

CREATE INDEX idx_flow_events_event ON flow_events(event);
CREATE INDEX idx_flow_events_created ON flow_events(created_at);

CREATE INDEX IF NOT EXISTS user_session_devices_user_id_last_seen_idx
    ON user_session_devices(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS user_session_devices_user_id_fingerprint_idx
    ON user_session_devices(user_id, fingerprint, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS notification_reads_user_id_read_at_idx
    ON notification_reads(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS user_two_factor_factors_user_id_idx
    ON user_two_factor_factors(user_id);
CREATE INDEX IF NOT EXISTS user_two_factor_factors_user_id_verified_idx
    ON user_two_factor_factors(user_id, verified_at);

CREATE INDEX IF NOT EXISTS user_two_factor_recovery_codes_user_id_idx
    ON user_two_factor_recovery_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_two_factor_recovery_codes_user_id_code_hash_idx
    ON user_two_factor_recovery_codes(user_id, code_hash);

CREATE INDEX IF NOT EXISTS user_two_factor_trusted_sessions_expires_at_idx
    ON user_two_factor_trusted_sessions(expires_at);


-- FUNCTIONS

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE OR REPLACE FUNCTION get_next_version_number(p_memorial_id UUID)
RETURNS INTEGER AS $$
    SELECT COALESCE(MAX(version_number), 0) + 1
    FROM memorial_versions
    WHERE memorial_id = p_memorial_id;
$$ LANGUAGE sql STABLE;

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
      RAISE EXCEPTION 'Cannot change mode from family to % - this memorial has % active relation(s). Remove all relations first.', NEW.mode, relation_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION get_memorial_ids_for_user(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT memorial_id FROM user_memorial_roles WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_owned_memorial_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id FROM memorials WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_co_guardian_memorial_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT memorial_id FROM user_memorial_roles
  WHERE user_id = p_user_id AND role = 'co_guardian';
$$;

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


-- TRIGGERS

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_memorials_updated_at
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER secure_paid_column
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    EXECUTE FUNCTION check_paid_status_integrity();

CREATE TRIGGER tr_validate_preservation_state
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    WHEN (OLD.preservation_state IS DISTINCT FROM NEW.preservation_state)
    EXECUTE FUNCTION validate_preservation_state_transition();

CREATE TRIGGER update_memorial_authorizations_updated_at
    BEFORE UPDATE ON memorial_authorizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_enforce_family_mode_relations
    BEFORE INSERT ON memorial_relations
    FOR EACH ROW
    EXECUTE FUNCTION enforce_family_mode_relations();

CREATE TRIGGER tr_prevent_mode_downgrade_with_relations
    BEFORE UPDATE ON memorials
    FOR EACH ROW
    WHEN (OLD.mode IS DISTINCT FROM NEW.mode)
    EXECUTE FUNCTION prevent_mode_downgrade_with_relations();

CREATE TRIGGER tr_arweave_transactions_updated_at
    BEFORE UPDATE ON arweave_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_anchor_devices_updated_at
    BEFORE UPDATE ON anchor_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_content_reviews_updated_at
    BEFORE UPDATE ON content_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_concierge_projects_updated_at
    BEFORE UPDATE ON concierge_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_recovery_contacts_updated_at
    BEFORE UPDATE ON recovery_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_prevent_owner_role_removal
    BEFORE DELETE ON user_memorial_roles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_owner_role_removal();


-- RLS ENABLEMENT

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE witness_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE arweave_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE preservation_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memorial_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_successors ENABLE ROW LEVEL SECURITY;
ALTER TABLE succession_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_session_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_two_factor_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_two_factor_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_two_factor_trusted_sessions ENABLE ROW LEVEL SECURITY;


-- RLS POLICIES

CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Service role full access to users"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can create memorials"
    ON memorials FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can delete own memorials"
    ON memorials FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to memorials"
    ON memorials FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Owners and role-holders can view memorials"
    ON memorials FOR SELECT
    USING (
        user_id = auth.uid()
        OR status = 'published'
        OR id IN (SELECT get_memorial_ids_for_user(auth.uid()))
    );

CREATE POLICY "Owners and co-guardians can update memorials"
    ON memorials FOR UPDATE
    USING (
        user_id = auth.uid()
        OR id IN (SELECT get_co_guardian_memorial_ids(auth.uid()))
    );

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

CREATE POLICY "Public can read invitations by id"
    ON witness_invitations FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create invitations"
    ON witness_invitations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only memorial owner can update invitations"
    ON witness_invitations FOR UPDATE
    USING (
        memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
    );

CREATE POLICY "Service role full access to invitations"
    ON witness_invitations FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can view approved contributions"
    ON memorial_contributions FOR SELECT
    USING (
        status = 'approved'
        OR user_id = auth.uid()
        OR memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
        OR memorial_id IN (SELECT get_co_guardian_memorial_ids(auth.uid()))
    );

CREATE POLICY "Verified contributors can submit"
    ON memorial_contributions FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        OR (is_anonymous = true AND verification_code IS NOT NULL)
    );

CREATE POLICY "Only owners/co-guardians can update contributions"
    ON memorial_contributions FOR UPDATE
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
        OR memorial_id IN (
            SELECT memorial_id
            FROM user_memorial_roles
            WHERE user_id = auth.uid()
            AND role = 'co_guardian'
        )
    );

CREATE POLICY "Service role full access to contributions"
    ON memorial_contributions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to memorial media assets"
    ON memorial_media_assets FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

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

CREATE POLICY "Users can view own reminders"
    ON memorial_reminders FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create reminders"
    ON memorial_reminders FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access to reminders"
    ON memorial_reminders FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own arweave transactions"
    ON arweave_transactions FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages arweave transactions"
    ON arweave_transactions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own devices"
    ON anchor_devices FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own devices"
    ON anchor_devices FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to anchor_devices"
    ON anchor_devices FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own encryption keys"
    ON encryption_keys FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages encryption keys"
    ON encryption_keys FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own content reviews"
    ON content_reviews FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages content reviews"
    ON content_reviews FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own certificates"
    ON preservation_certificates FOR SELECT
    USING (
        memorial_id IN (SELECT id FROM memorials WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role manages certificates"
    ON preservation_certificates FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own roles"
    ON user_memorial_roles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Owners can view all roles for their memorials"
    ON user_memorial_roles FOR SELECT
    USING (
        memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
    );

CREATE POLICY "Service role full access"
    ON user_memorial_roles FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can insert own role"
    ON user_memorial_roles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Only service_role can update roles"
    ON user_memorial_roles FOR UPDATE
    USING (auth.role() = 'service_role');

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

CREATE POLICY "Service role full access to memorial activity log"
    ON memorial_activity_log
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Members with stewardship can view memorial activity log"
    ON memorial_activity_log
    FOR SELECT
    USING (
        memorial_id IN (SELECT get_owned_memorial_ids(auth.uid()))
        OR memorial_id IN (SELECT get_co_guardian_memorial_ids(auth.uid()))
    );

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

CREATE POLICY "Service role full access to activations"
    ON succession_activations FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own activations"
    ON succession_activations FOR SELECT
    USING (
        successor_id IN (SELECT id FROM user_successors WHERE user_id = auth.uid())
    );

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

CREATE POLICY "Users can view own recovery contacts"
    ON recovery_contacts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own recovery contacts"
    ON recovery_contacts FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to recovery_contacts"
    ON recovery_contacts FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own session devices"
    ON user_session_devices
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role full access to session devices"
    ON user_session_devices
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can view own notification reads"
    ON notification_reads
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own notification reads"
    ON notification_reads
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to notification reads"
    ON notification_reads
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

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

CREATE POLICY "Users can upload authorization PDFs"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'authorization-pdfs');

CREATE POLICY "Users can read authorization PDFs"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'authorization-pdfs');

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


-- REMAINING CONFIGURATION

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'videos',
    'videos',
    true,
    524288000,
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'concierge-files',
    'concierge-files',
    true,
    104857600,
    NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'authorization-pdfs',
    'authorization-pdfs',
    false,
    10485760,
    ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'memorial-media',
    'memorial-media',
    true,
    104857600,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'certificates',
    'certificates',
    false,
    10485760,
    ARRAY['application/pdf', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON memorial_versions TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_contributions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_memorial_roles;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_access_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memorial_creation_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;


-- ==============================================================
-- Commands execute after 
-- ==============================================================

-- First 
CREATE POLICY "Anyone can view memorial media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'memorial-media');

-- Done

-- Second


BEGIN;

-- Remove duplicate live authorization records before adding the index.
WITH ranked_authorizations AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY memorial_id, user_id, authorization_type
            ORDER BY
                CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
                created_at ASC,
                id ASC
        ) AS row_number
    FROM memorial_authorizations
    WHERE status IN ('pending', 'approved')
)
DELETE FROM memorial_authorizations ma
USING ranked_authorizations ra
WHERE ma.id = ra.id
  AND ra.row_number > 1;

-- Enforce one live authorization per memorial, per user, per authorization type.
CREATE UNIQUE INDEX IF NOT EXISTS memorial_authorizations_one_live_record_per_type_idx
    ON memorial_authorizations (memorial_id, user_id, authorization_type)
    WHERE status IN ('pending', 'approved');

COMMIT;

-- Done

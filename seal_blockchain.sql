-- ULUMAE seal + R2 support
-- Run this file manually in the Supabase SQL editor.

BEGIN;

ALTER TABLE public.memorials
    ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS seal_status TEXT,
    ADD COLUMN IF NOT EXISTS arweave_tx_id TEXT,
    ADD COLUMN IF NOT EXISTS seal_job_id TEXT,
    ADD COLUMN IF NOT EXISTS seal_selected_asset_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.memorial_media_assets
    ADD COLUMN IF NOT EXISTS arweave_url TEXT,
    ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.memorials'::regclass
          AND conname = 'memorials_seal_status_check'
    ) THEN
        ALTER TABLE public.memorials
            ADD CONSTRAINT memorials_seal_status_check
            CHECK (seal_status IN ('pending', 'in_progress', 'completed', 'failed'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.memorials'::regclass
          AND conname = 'memorials_seal_selected_asset_ids_is_array_check'
    ) THEN
        ALTER TABLE public.memorials
            ADD CONSTRAINT memorials_seal_selected_asset_ids_is_array_check
            CHECK (
                seal_selected_asset_ids IS NULL
                OR jsonb_typeof(seal_selected_asset_ids) = 'array'
            );
    END IF;
END $$;

DO $$
DECLARE
    bucket_constraint_name TEXT;
BEGIN
    SELECT conname
    INTO bucket_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.memorial_media_assets'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%bucket IN%';

    IF bucket_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE public.memorial_media_assets DROP CONSTRAINT %I',
            bucket_constraint_name
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.memorial_media_assets'::regclass
          AND conname = 'memorial_media_assets_bucket_check'
    ) THEN
        ALTER TABLE public.memorial_media_assets
            ADD CONSTRAINT memorial_media_assets_bucket_check
            CHECK (bucket IN ('memorial-media', 'videos', 'r2'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memorials_seal_status
    ON public.memorials (seal_status);

CREATE INDEX IF NOT EXISTS idx_memorials_sealed_at
    ON public.memorials (sealed_at DESC);

CREATE INDEX IF NOT EXISTS idx_memorial_media_assets_sealed_at
    ON public.memorial_media_assets (sealed_at DESC);

CREATE INDEX IF NOT EXISTS idx_memorial_media_assets_arweave_url
    ON public.memorial_media_assets (arweave_url);

-- RLS is row-level, so the trigger below is what actually enforces
-- service-role-only updates for the seal-specific columns.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'memorials'
          AND policyname = 'Service role can update memorial seal state'
    ) THEN
        CREATE POLICY "Service role can update memorial seal state"
            ON public.memorials
            FOR UPDATE
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'memorial_media_assets'
          AND policyname = 'Service role can update memorial media seal state'
    ) THEN
        CREATE POLICY "Service role can update memorial media seal state"
            ON public.memorial_media_assets
            FOR UPDATE
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_service_role_for_memorial_seal_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF NEW.sealed_at IS DISTINCT FROM OLD.sealed_at
       OR NEW.seal_status IS DISTINCT FROM OLD.seal_status
       OR NEW.arweave_tx_id IS DISTINCT FROM OLD.arweave_tx_id
       OR NEW.seal_job_id IS DISTINCT FROM OLD.seal_job_id
       OR NEW.seal_selected_asset_ids IS DISTINCT FROM OLD.seal_selected_asset_ids THEN
        RAISE EXCEPTION 'Only the service role can update memorial seal fields.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_service_role_for_media_seal_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF NEW.arweave_url IS DISTINCT FROM OLD.arweave_url
       OR NEW.sealed_at IS DISTINCT FROM OLD.sealed_at THEN
        RAISE EXCEPTION 'Only the service role can update memorial media seal fields.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memorials_service_role_seal_columns
    ON public.memorials;

CREATE TRIGGER trg_memorials_service_role_seal_columns
    BEFORE UPDATE ON public.memorials
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_service_role_for_memorial_seal_columns();

DROP TRIGGER IF EXISTS trg_memorial_media_assets_service_role_seal_columns
    ON public.memorial_media_assets;

CREATE TRIGGER trg_memorial_media_assets_service_role_seal_columns
    BEFORE UPDATE ON public.memorial_media_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_service_role_for_media_seal_columns();

COMMIT;

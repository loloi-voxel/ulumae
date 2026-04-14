create extension if not exists pgcrypto;

create table if not exists public.memorial_media_assets (
    id uuid primary key default gen_random_uuid(),
    memorial_id uuid not null references public.memorials(id) on delete cascade,
    contribution_id uuid references public.memorial_contributions(id) on delete set null,
    kind text not null
        check (
            kind in (
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
    bucket text not null
        check (bucket in ('memorial-media', 'videos')),
    storage_path text not null,
    public_url text not null,
    original_file_name text,
    mime_type text not null,
    file_size bigint not null check (file_size > 0),
    sha256_hash text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid references auth.users(id) on delete set null
);

create unique index if not exists memorial_media_assets_bucket_storage_path_uidx
    on public.memorial_media_assets (bucket, storage_path);

create index if not exists memorial_media_assets_memorial_id_idx
    on public.memorial_media_assets (memorial_id);

create index if not exists memorial_media_assets_kind_idx
    on public.memorial_media_assets (kind);

create index if not exists memorial_media_assets_deleted_at_idx
    on public.memorial_media_assets (deleted_at);

alter table public.memorial_media_assets enable row level security;

drop policy if exists "Service role full access to memorial media assets" on public.memorial_media_assets;
create policy "Service role full access to memorial media assets"
    on public.memorial_media_assets
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

drop policy if exists "Anyone can upload videos" on storage.objects;
drop policy if exists "Anyone can delete videos" on storage.objects;
drop policy if exists "Anyone can upload memorial media" on storage.objects;
drop policy if exists "Anyone can delete memorial media" on storage.objects;
drop policy if exists "Service role can manage videos" on storage.objects;
drop policy if exists "Service role can manage memorial media" on storage.objects;

create policy "Service role can manage videos"
    on storage.objects
    for all
    using (
        bucket_id = 'videos'
        and auth.role() = 'service_role'
    )
    with check (
        bucket_id = 'videos'
        and auth.role() = 'service_role'
    );

create policy "Service role can manage memorial media"
    on storage.objects
    for all
    using (
        bucket_id = 'memorial-media'
        and auth.role() = 'service_role'
    )
    with check (
        bucket_id = 'memorial-media'
        and auth.role() = 'service_role'
    );

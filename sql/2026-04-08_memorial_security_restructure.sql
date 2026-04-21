create extension if not exists pgcrypto;

create table if not exists public.memorial_activity_log (
    id uuid primary key default gen_random_uuid(),
    memorial_id uuid not null references public.memorials(id) on delete cascade,
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_email text,
    subject_user_id uuid references auth.users(id) on delete set null,
    subject_email text,
    action text not null,
    summary text not null,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists memorial_activity_log_memorial_id_created_at_idx
    on public.memorial_activity_log (memorial_id, created_at desc);

create index if not exists memorial_activity_log_actor_user_id_idx
    on public.memorial_activity_log (actor_user_id);

alter table public.memorial_activity_log enable row level security;

drop policy if exists "Service role full access to memorial activity log" on public.memorial_activity_log;
create policy "Service role full access to memorial activity log"
    on public.memorial_activity_log
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

drop policy if exists "Members with stewardship can view memorial activity log" on public.memorial_activity_log;
create policy "Members with stewardship can view memorial activity log"
    on public.memorial_activity_log
    for select
    using (
        memorial_id in (select get_owned_memorial_ids(auth.uid()))
        or memorial_id in (select get_co_guardian_memorial_ids(auth.uid()))
    );

create table if not exists public.user_session_devices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    session_id text not null,
    fingerprint text,
    device_label text not null default 'Unknown device',
    ip_address text,
    user_agent text,
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    unique (user_id, session_id)
);

create index if not exists user_session_devices_user_id_last_seen_idx
    on public.user_session_devices (user_id, last_seen_at desc);

create index if not exists user_session_devices_user_id_fingerprint_idx
    on public.user_session_devices (user_id, fingerprint, last_seen_at desc);

alter table public.user_session_devices enable row level security;

drop policy if exists "Users can view own session devices" on public.user_session_devices;
create policy "Users can view own session devices"
    on public.user_session_devices
    for select
    using (user_id = auth.uid());

drop policy if exists "Service role full access to session devices" on public.user_session_devices;
create policy "Service role full access to session devices"
    on public.user_session_devices
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

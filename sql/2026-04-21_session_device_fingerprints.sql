alter table if exists public.user_session_devices
    add column if not exists fingerprint text;

create index if not exists user_session_devices_user_id_fingerprint_idx
    on public.user_session_devices (user_id, fingerprint, last_seen_at desc);

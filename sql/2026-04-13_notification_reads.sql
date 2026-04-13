create table if not exists public.notification_reads (
    user_id uuid not null references auth.users(id) on delete cascade,
    notification_id text not null,
    read_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (user_id, notification_id)
);

create index if not exists notification_reads_user_id_read_at_idx
    on public.notification_reads (user_id, read_at desc);

alter table public.notification_reads enable row level security;

drop policy if exists "Users can view own notification reads" on public.notification_reads;
create policy "Users can view own notification reads"
    on public.notification_reads
    for select
    using (user_id = auth.uid());

drop policy if exists "Users can manage own notification reads" on public.notification_reads;
create policy "Users can manage own notification reads"
    on public.notification_reads
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists "Service role full access to notification reads" on public.notification_reads;
create policy "Service role full access to notification reads"
    on public.notification_reads
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

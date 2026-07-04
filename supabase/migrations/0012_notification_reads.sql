-- Beacon — 0012_notification_reads.sql
-- Per-patient read/dismiss state for the notifications feed, kept in its own
-- table rather than as columns on access_logs. access_logs has NO client
-- write policies at all (not even insert) — it's the permanent, immutable
-- audit trail patients rely on to know who accessed their data, and it stays
-- that way. "Delete" in the notifications UI only sets dismissed_at here; the
-- underlying access_logs row (and the /access-log page) is never touched.

create table if not exists public.notification_reads (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references public.profiles (id) on delete cascade,
  access_log_id   uuid not null references public.access_logs (id) on delete cascade,
  read_at         timestamptz,
  dismissed_at    timestamptz,
  unique (patient_user_id, access_log_id)
);
create index if not exists notification_reads_patient_idx
  on public.notification_reads (patient_user_id);

alter table public.notification_reads enable row level security;

drop policy if exists "nr_select_own" on public.notification_reads;
create policy "nr_select_own" on public.notification_reads
  for select using (patient_user_id = auth.uid());

drop policy if exists "nr_insert_own" on public.notification_reads;
create policy "nr_insert_own" on public.notification_reads
  for insert with check (patient_user_id = auth.uid());

drop policy if exists "nr_update_own" on public.notification_reads;
create policy "nr_update_own" on public.notification_reads
  for update using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

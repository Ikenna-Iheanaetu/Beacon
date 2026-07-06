-- Beacon — 0014_auth_events.sql
-- A platform-wide signup/login audit trail for regular accounts (patient,
-- provider, institution). Admin activity is deliberately excluded — the
-- app-level check lives in signUpAction/signInAction (via isAdmin()), not
-- here, so this table only ever contains non-admin events.
--
-- Mirrors access_logs / admin_actions: NO client policies at all — this is
-- written only via the secret-key path inside signUpAction/signInAction, and
-- read only by admins via the admin client. Nobody can read, insert, or
-- tamper with it through the normal RLS-scoped client.

create table if not exists public.auth_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in ('signup','login')),
  email      text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_events_created_at_idx
  on public.auth_events (created_at desc);
create index if not exists auth_events_user_id_idx
  on public.auth_events (user_id);

alter table public.auth_events enable row level security;
-- Deliberately no policies — RLS with zero policies denies all client access
-- (select/insert/update/delete alike). Only the service-role client bypasses
-- RLS entirely, which is how signUpAction/signInAction and the admin page
-- read/write this table.

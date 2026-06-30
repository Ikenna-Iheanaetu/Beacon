-- Beacon — 0004_verification_audit.sql
-- Doctor license verification, admin audit trail, national-ID backup lookup,
-- patient-visible admin/lookup notes, and hardening of the new-user trigger.
-- Runs AFTER 0003 has committed the 'admin' enum value. Idempotent where practical.

-- ---------------------------------------------------------------------------
-- provider_verifications — a doctor's license review record.
--   status here is the DOCUMENT review state, distinct from
--   profiles.provider_status. On approval the admin flips BOTH.
-- ---------------------------------------------------------------------------
create table if not exists public.provider_verifications (
  id                     uuid primary key default gen_random_uuid(),
  provider_id            uuid not null unique references public.profiles (id) on delete cascade,
  license_number         text not null,
  license_document_path  text,                          -- object path in the private 'license-docs' bucket
  status                 text not null default 'pending'
                           check (status in ('pending','verified','rejected')),
  verify_check_result    jsonb,                          -- output of verifyLicense() stub
  verified_by            uuid references public.profiles (id),
  verified_at            timestamptz,
  notes                  text,                           -- reviewer note / rejection reason
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists provider_verifications_status_idx
  on public.provider_verifications (status);

-- A doctor may manage their own row, but NOT self-promote: the trigger below
-- rejects client edits to status/verified_by/verified_at. Only the secret-key
-- path (service_role) may change those.
create or replace function public.pv_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.status      is distinct from old.status
    or new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at then
      raise exception 'verification status can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pv_guard_update on public.provider_verifications;
create trigger pv_guard_update
  before update on public.provider_verifications
  for each row execute function public.pv_guard();

-- ---------------------------------------------------------------------------
-- admin_actions — append-only audit of privileged admin operations.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_action_type') then
    create type public.admin_action_type as enum
      ('record_view','pdf_export','email_send','provider_approve','provider_reject');
  end if;
end $$;

create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles (id) on delete cascade,
  action_type public.admin_action_type not null,
  patient_id  uuid references public.medical_profiles (id) on delete set null,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_actions_admin_id_idx   on public.admin_actions (admin_id);
create index if not exists admin_actions_patient_id_idx on public.admin_actions (patient_id);
create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);

-- ---------------------------------------------------------------------------
-- medical_profiles — national-ID backup lookup.
--   national_id      : AES-256-GCM ciphertext (for display only)
--   national_id_hash : keyed HMAC-SHA256 of the normalized ID, for exact lookup
--                      (encrypted columns are not queryable).
-- ---------------------------------------------------------------------------
alter table public.medical_profiles
  add column if not exists national_id      text,
  add column if not exists national_id_hash text;

create unique index if not exists medical_profiles_national_id_hash_idx
  on public.medical_profiles (national_id_hash)
  where national_id_hash is not null;

-- ---------------------------------------------------------------------------
-- access_logs — a patient-visible note, used for admin reviews and national-ID
-- lookups (access_type is free text: 'emergency_view' | 'admin_review' |
-- 'national_id_lookup').
-- ---------------------------------------------------------------------------
alter table public.access_logs
  add column if not exists note text;

-- ---------------------------------------------------------------------------
-- RLS for the new tables.
-- ---------------------------------------------------------------------------
alter table public.provider_verifications enable row level security;

drop policy if exists "pv_select_own" on public.provider_verifications;
create policy "pv_select_own" on public.provider_verifications
  for select using (provider_id = auth.uid());

drop policy if exists "pv_insert_own" on public.provider_verifications;
create policy "pv_insert_own" on public.provider_verifications
  for insert with check (provider_id = auth.uid());

drop policy if exists "pv_update_own" on public.provider_verifications;
create policy "pv_update_own" on public.provider_verifications
  for update using (provider_id = auth.uid()) with check (provider_id = auth.uid());

-- admin_actions: RLS enabled with NO policies => deny-all to normal clients.
-- Only the secret-key (service_role) path, which bypasses RLS, reads/writes it.
alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------------------
-- Harden handle_new_user(): signup metadata may only request patient|provider,
-- never admin. Admin is provisioned out-of-band (mirrors the ADMIN_EMAILS
-- allowlist at runtime).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role public.user_role :=
    case when (new.raw_user_meta_data ->> 'role') = 'provider'
         then 'provider'::public.user_role
         else 'patient'::public.user_role end;
begin
  insert into public.profiles (id, role, provider_status, full_name)
  values (
    new.id,
    meta_role,
    case when meta_role = 'provider' then 'pending'::public.provider_status
         else 'none'::public.provider_status end,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

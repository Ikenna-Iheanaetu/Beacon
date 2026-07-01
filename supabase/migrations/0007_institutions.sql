-- Beacon — 0007_institutions.sql
-- Healthcare INSTITUTION verification (hospitals, clinics, diagnostic centres),
-- modelled on Nigerian facility registration. An institution account registers
-- the facility and submits its registry identifiers + a registration document;
-- an administrator reviews and verifies it. Runs AFTER 0006 has committed the
-- 'institution' enum value.
--
-- Identifiers captured (all Nigerian facility registries):
--   nhfr_code         National Health Facility Registry unique code (FMoH)
--   state_moh_reg_no  State Ministry of Health / HEFAMAA registration number
--   cac_rc_number     Corporate Affairs Commission RC number (the legal entity)
--   medical_director_mdcn  the facility's Medical Director's MDCN folio (the
--                          bridge to the individual-practitioner layer)

-- ---------------------------------------------------------------------------
-- institutions — a facility's verification record.
--   status is the facility review state, distinct from any practitioner status.
-- ---------------------------------------------------------------------------
create table if not exists public.institutions (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null unique references public.profiles (id) on delete cascade,
  name                     text not null,
  facility_type            text not null default 'hospital'
                             check (facility_type in
                               ('hospital','clinic','diagnostic','maternity','pharmacy','other')),
  nhfr_code                text,
  state_moh_reg_no         text,
  cac_rc_number            text,
  medical_director_name    text,
  medical_director_mdcn    text,
  registration_document_path text,                       -- object path in the private 'institution-docs' bucket
  status                   text not null default 'pending'
                             check (status in ('pending','verified','rejected')),
  verify_check_result      jsonb,                          -- output of verifyFacility() stub
  verified_by              uuid references public.profiles (id),
  verified_at              timestamptz,
  notes                    text,                           -- reviewer note / rejection reason
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists institutions_status_idx on public.institutions (status);

-- Mirror of pv_guard: an institution may manage its own row but NOT self-verify.
-- Only the secret-key (service_role) path may change status/verified_by/verified_at.
create or replace function public.inst_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.status      is distinct from old.status
    or new.verified_by is distinct from old.verified_by
    or new.verified_at is distinct from old.verified_at then
      raise exception 'institution status can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inst_guard_update on public.institutions;
create trigger inst_guard_update
  before update on public.institutions
  for each row execute function public.inst_guard();

-- ---------------------------------------------------------------------------
-- RLS — an institution account reads/writes only its own facility row.
-- ---------------------------------------------------------------------------
alter table public.institutions enable row level security;

drop policy if exists "inst_select_own" on public.institutions;
create policy "inst_select_own" on public.institutions
  for select using (owner_id = auth.uid());

drop policy if exists "inst_insert_own" on public.institutions;
create policy "inst_insert_own" on public.institutions
  for insert with check (owner_id = auth.uid());

drop policy if exists "inst_update_own" on public.institutions;
create policy "inst_update_own" on public.institutions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- handle_new_user(): allow signup metadata to request the 'institution' role
-- (alongside patient/provider). admin is still never self-assignable.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role public.user_role :=
    case new.raw_user_meta_data ->> 'role'
         when 'provider'    then 'provider'::public.user_role
         when 'institution' then 'institution'::public.user_role
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

-- ---------------------------------------------------------------------------
-- Private Storage bucket for facility registration documents, namespaced by
-- the institution account's uid (mirrors license-docs).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('institution-docs', 'institution-docs', false)
on conflict (id) do nothing;

drop policy if exists "institution_docs_insert_own" on storage.objects;
create policy "institution_docs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'institution-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "institution_docs_select_own" on storage.objects;
create policy "institution_docs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'institution-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

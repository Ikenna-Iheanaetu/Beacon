-- Beacon — 0008_institution_members.sql
-- Practitioner <-> institution affiliation (Increment 2), modelled on how a
-- Nigerian hospital employs/affiliates its clinical staff: a practitioner still
-- holds their own council license (MDCN/NMCN — verified independently via
-- provider_verifications), and separately can be affiliated with a verified
-- facility. Neither layer substitutes for the other ("layered: verify both").
--
-- The institution reviews and decides membership for its own roster — no
-- service-role escalation is needed here (unlike provider/institution
-- verification, there is no self-approval risk: the member and the reviewing
-- institution are different accounts).

create table if not exists public.institution_members (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  member_id      uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  role_title     text,                          -- e.g. "Doctor", "Nurse" (free text for now)
  notes          text,                          -- reviewer note on rejection
  requested_at   timestamptz not null default now(),
  decided_by     uuid references public.profiles (id),
  decided_at     timestamptz,
  unique (institution_id, member_id)
);
create index if not exists institution_members_institution_idx
  on public.institution_members (institution_id);
create index if not exists institution_members_member_idx
  on public.institution_members (member_id);

alter table public.institution_members enable row level security;

-- A practitioner sees their own affiliation rows (any institution).
drop policy if exists "im_select_own_member" on public.institution_members;
create policy "im_select_own_member" on public.institution_members
  for select using (member_id = auth.uid());

-- A practitioner can request affiliation with any facility, always starting
-- 'pending' — they cannot self-approve.
drop policy if exists "im_insert_own_member" on public.institution_members;
create policy "im_insert_own_member" on public.institution_members
  for insert with check (member_id = auth.uid() and status = 'pending');

-- The institution (its owner account) sees and decides on its own roster.
drop policy if exists "im_select_own_institution" on public.institution_members;
create policy "im_select_own_institution" on public.institution_members
  for select using (
    institution_id in (select id from public.institutions where owner_id = auth.uid())
  );

drop policy if exists "im_update_own_institution" on public.institution_members;
create policy "im_update_own_institution" on public.institution_members
  for update using (
    institution_id in (select id from public.institutions where owner_id = auth.uid())
  ) with check (
    institution_id in (select id from public.institutions where owner_id = auth.uid())
  );

-- Any authenticated user may browse verified facilities by name/type to choose
-- who to request affiliation with (no registry identifiers exposed here).
drop policy if exists "inst_select_verified_public" on public.institutions;
create policy "inst_select_verified_public" on public.institutions
  for select using (status = 'verified');

-- Beacon — 0011_care_access.sql
-- Doctor write-access to a patient's clinical fields is opt-in, not automatic.
-- Read access (the emergency scan) was deliberately opened to anyone with no
-- login — but WRITE access is a different risk: a bad or malicious edit
-- corrupts the exact safety data the app exists to keep accurate. So a doctor
-- must request access to a specific patient (found via the existing national
-- ID / email lookup), and the PATIENT decides whether to grant it — mirrors
-- the institution_members affiliation pattern.

create table if not exists public.care_access_requests (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id       uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','revoked')),
  requested_at    timestamptz not null default now(),
  decided_at      timestamptz,
  unique (patient_user_id, doctor_id)
);
create index if not exists care_access_requests_patient_idx
  on public.care_access_requests (patient_user_id);
create index if not exists care_access_requests_doctor_idx
  on public.care_access_requests (doctor_id);

alter table public.care_access_requests enable row level security;

-- Either party to a request can see it.
drop policy if exists "car_select_participant" on public.care_access_requests;
create policy "car_select_participant" on public.care_access_requests
  for select using (doctor_id = auth.uid() or patient_user_id = auth.uid());

-- A doctor can open a fresh request — always starting 'pending'.
drop policy if exists "car_insert_doctor" on public.care_access_requests;
create policy "car_insert_doctor" on public.care_access_requests
  for insert with check (doctor_id = auth.uid() and status = 'pending');

-- A doctor may reset THEIR OWN request back to 'pending' (e.g. ask again
-- after a rejection) — this policy's WITH CHECK never lets them set
-- 'approved' themselves.
drop policy if exists "car_update_doctor_repending" on public.care_access_requests;
create policy "car_update_doctor_repending" on public.care_access_requests
  for update using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid() and status = 'pending');

-- The patient decides: approve, reject, or revoke a previously approved grant.
drop policy if exists "car_update_patient_decide" on public.care_access_requests;
create policy "car_update_patient_decide" on public.care_access_requests
  for update using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

-- Beacon — 0010_public_emergency_access.sql
-- Emergency access no longer requires a signed-in provider: a bystander with
-- no account must be able to scan a patient's code and see the full record
-- immediately. Two schema changes support that:
--
--   1. access_logs.accessor_id becomes nullable — an anonymous scan has no
--      identity to attach, but is still logged (accessor_name is set to
--      'Anonymous scan' by the application) so the patient still sees that
--      their record was viewed.
--   2. medical_profiles gets a free-text current_hospital_name column, so a
--      patient can record which hospital/doctor is currently treating them —
--      this is shown on the (now-public) emergency view. It's independent of
--      who's viewing, since there's no longer a signed-in viewer to attribute
--      "attending doctor" to.

alter table public.access_logs
  alter column accessor_id drop not null;

alter table public.medical_profiles
  add column if not exists current_hospital_name text;

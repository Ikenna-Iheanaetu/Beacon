-- Beacon — 0009_practitioner_type.sql
-- Fold nurses into the practitioner-verification flow (Increment 3), modelled
-- on Nigerian council registration: doctors are MDCN-licensed, nurses/midwives
-- are NMCN-licensed. Rather than a second user_role (which would fork every
-- role-keyed route guard), a practitioner's TYPE and COUNCIL are recorded
-- alongside their existing license verification.

alter table public.provider_verifications
  add column if not exists practitioner_type text not null default 'doctor'
    check (practitioner_type in ('doctor','nurse')),
  add column if not exists council text not null default 'MDCN'
    check (council in ('MDCN','NMCN'));

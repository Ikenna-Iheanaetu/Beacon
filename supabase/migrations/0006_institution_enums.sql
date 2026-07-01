-- Beacon — 0006_institution_enums.sql
-- Adds the 'institution' role to user_role and two institution review actions to
-- admin_action_type, expanding provider verification from individual practitioners
-- to healthcare facilities (hospitals/clinics), as registered in Nigeria.
--
-- This MUST be its own migration: Postgres cannot use a newly added enum value in
-- the same transaction it is added in. 0007 (which references 'institution') runs
-- only after this file has committed. Idempotent via IF NOT EXISTS.

alter type public.user_role add value if not exists 'institution';

alter type public.admin_action_type add value if not exists 'institution_approve';
alter type public.admin_action_type add value if not exists 'institution_reject';

-- Beacon — 0003_add_admin_enum.sql
-- Adds the 'admin' role to the user_role enum.
--
-- This MUST be its own migration: Postgres cannot use a newly added enum value
-- in the same transaction it is added in. 0004 (which references 'admin') runs
-- only after this file has committed. Idempotent via IF NOT EXISTS.

alter type public.user_role add value if not exists 'admin';

-- Beacon — 0005_storage.sql
-- Private Storage buckets for doctor license documents and generated record
-- PDFs. Both are private; reads happen only via short-lived secret-key signed
-- URLs. Object paths are namespaced by the owner's uid so per-user RLS works.

insert into storage.buckets (id, name, public)
values ('license-docs', 'license-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('record-exports', 'record-exports', false)
on conflict (id) do nothing;

-- license-docs: a doctor may upload/read only objects under license-docs/<uid>/…
drop policy if exists "license_docs_insert_own" on storage.objects;
create policy "license_docs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'license-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "license_docs_select_own" on storage.objects;
create policy "license_docs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'license-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- record-exports has NO authenticated policies: it is written and read only via
-- the secret-key path (createSignedUrl), so admins/patients never touch it
-- directly through the normal client.

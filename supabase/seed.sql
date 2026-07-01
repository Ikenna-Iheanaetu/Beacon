-- Beacon — seed data (dev/demo only).
--
-- Creates THREE demo accounts you can sign in with:
--     Doctor:      provider@beacon.test      / BeaconDemo1!  (pre-approved)
--     Institution: institution@beacon.test   / BeaconDemo1!  (pre-verified,
--                  with the doctor above already an approved staff member)
--     Admin:       ijeoma@gmail.com          / Password
--
-- Idempotent: safe to run more than once. Run it either via the Supabase CLI
-- (`supabase db reset` runs this automatically on a local stack) or by pasting
-- it into the hosted project's SQL Editor.
--
-- Notes:
--  * The password is hashed with pgcrypto's crypt(). If your SQL Editor can't
--    find crypt()/gen_salt(), prefix them with `extensions.` (e.g.
--    extensions.crypt(...)) — Supabase installs pgcrypto in the extensions schema.
--  * email_confirmed_at is set so the account works even with "Confirm email" on.

do $$
declare
  demo_provider_id uuid;
begin
  -- 1) Auth user (create once).
  select id into demo_provider_id from auth.users where email = 'provider@beacon.test';

  if demo_provider_id is null then
    demo_provider_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      demo_provider_id,
      'authenticated',
      'authenticated',
      'provider@beacon.test',
      crypt('BeaconDemo1!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"provider","full_name":"Dr. Demo Provider"}',
      now(),
      now()
    );

    -- 2) Email identity so password sign-in works.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      demo_provider_id,
      demo_provider_id::text,
      json_build_object('sub', demo_provider_id::text, 'email', 'provider@beacon.test'),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  -- 3) Profile as an APPROVED provider (works whether or not the
  --    handle_new_user trigger already created a row).
  insert into public.profiles (id, role, provider_status, full_name)
  values (demo_provider_id, 'provider', 'approved', 'Dr. Demo Provider')
  on conflict (id)
  do update set role = 'provider', provider_status = 'approved';

  -- 4) Practitioner-verification row so the "Doctor" label/type shows correctly
  --    on /provider and in the admin queue.
  insert into public.provider_verifications (
    provider_id, license_number, status, practitioner_type, council,
    verified_at
  ) values (
    demo_provider_id, 'MDCN-100001', 'verified', 'doctor', 'MDCN', now()
  )
  on conflict (provider_id) do update set status = 'verified';
end $$;

-- ---------------------------------------------------------------------------
-- Institution account (demo) — a pre-VERIFIED facility, with the demo doctor
-- above already an APPROVED staff member, so you can see the institution
-- dashboard + staff roster without registering one yourself.
--   Email:    institution@beacon.test
--   Password: BeaconDemo1!
-- ---------------------------------------------------------------------------
do $$
declare
  institution_owner_id uuid;
  institution_row_id   uuid;
  demo_provider_id     uuid;
begin
  select id into institution_owner_id from auth.users where email = 'institution@beacon.test';

  if institution_owner_id is null then
    institution_owner_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      institution_owner_id,
      'authenticated',
      'authenticated',
      'institution@beacon.test',
      crypt('BeaconDemo1!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"institution","full_name":"Demo Facility Admin","institution_name":"Lagoon General Hospital"}',
      now(),
      now()
    );

    -- Email identity so password sign-in works.
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      institution_owner_id,
      institution_owner_id::text,
      json_build_object('sub', institution_owner_id::text, 'email', 'institution@beacon.test'),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  -- Profile as an institution-role account (works whether or not
  -- handle_new_user already created a row).
  insert into public.profiles (id, role, provider_status, full_name)
  values (institution_owner_id, 'institution', 'none', 'Demo Facility Admin')
  on conflict (id)
  do update set role = 'institution', full_name = 'Demo Facility Admin';

  -- Facility row, pre-verified. This is an INSERT, so inst_guard (which only
  -- fires on UPDATE) does not block setting status directly here.
  insert into public.institutions (
    owner_id, name, facility_type, nhfr_code, state_moh_reg_no, cac_rc_number,
    medical_director_name, medical_director_mdcn, status, verified_at
  ) values (
    institution_owner_id, 'Lagoon General Hospital', 'hospital',
    '24/01/3/1/0001', 'LSH/2287', 'RC1234567',
    'Dr. Demo Director', 'MDCN-000001', 'verified', now()
  )
  on conflict (owner_id) do update set
    status = 'verified',
    verified_at = now()
  returning id into institution_row_id;

  -- Affiliate the demo doctor (provider@beacon.test) with this facility,
  -- already approved, so the roster page has something to show.
  select id into demo_provider_id from auth.users where email = 'provider@beacon.test';

  if demo_provider_id is not null then
    insert into public.institution_members (
      institution_id, member_id, status, role_title, decided_by, decided_at
    ) values (
      institution_row_id, demo_provider_id, 'approved', 'Doctor',
      institution_owner_id, now()
    )
    on conflict (institution_id, member_id) do update set
      status = 'approved',
      decided_at = now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Admin account.
--   Email:    ijeoma@gmail.com
--   Password: Password
-- Admin powers come from the ADMIN_EMAILS allowlist in .env.local, so this is
-- just a normal (patient-role) account whose email is allowlisted for /admin.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'ijeoma@gmail.com';

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_id, 'authenticated', 'authenticated',
      'ijeoma@gmail.com',
      crypt('Password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"role":"patient","full_name":"Ijeoma"}',
      now(), now()
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), admin_id, admin_id::text,
      json_build_object('sub', admin_id::text, 'email', 'ijeoma@gmail.com'),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt('Password', gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = admin_id;
  end if;

  insert into public.profiles (id, role, provider_status, full_name)
  values (admin_id, 'patient', 'none', 'Ijeoma')
  on conflict (id) do update set full_name = 'Ijeoma';
end $$;

-- ---------------------------------------------------------------------------
-- IMPORTANT: GoTrue cannot scan NULL token columns and returns
-- "Database error querying schema" (HTTP 500) on sign-in / listUsers when a
-- hand-inserted auth.users row leaves them NULL. Normalise them to ''.
-- ---------------------------------------------------------------------------
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where email in ('provider@beacon.test', 'institution@beacon.test', 'ijeoma@gmail.com');

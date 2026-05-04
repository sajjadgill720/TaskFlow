-- =============================================================================
-- TicketFlow — Seed users for all roles (email + password)
-- Run in Supabase Dashboard → SQL Editor (after schema.sql is applied).
--
-- Default password for all three accounts:  TicketFlow123!
-- (set in pass_plain below)
--
-- Sign-in emails:
--   attendee@ticketflow.demo
--   organizer@ticketflow.demo
--   admin@ticketflow.demo
--
-- Tips:
-- - Authentication → Email: enable the Email provider.
-- - For quick testing, disable "Confirm email" in Auth settings, or confirm
--   each user under Authentication → Users.
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  instance_id uuid;
  pass_plain  text := 'TicketFlow123!';
  pass_enc    text := crypt(pass_plain, gen_salt('bf'));

  rec record;
begin
  -- Instance id: some projects have an empty auth.instances table (or it is not visible).
  select i.id into instance_id from auth.instances i limit 1;

  if instance_id is null then
    select u.instance_id into instance_id from auth.users u limit 1;
  end if;

  if instance_id is null then
    -- GoTrue default used when no rows exist yet (common for fresh projects).
    instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  for rec in
    select * from (
      values
        ('b1000001-0001-4001-8001-000000000001'::uuid, 'attendee@ticketflow.demo'::text, 'Demo Attendee'::text, 'attendee'::text),
        ('b1000002-0002-4002-8002-000000000002'::uuid, 'organizer@ticketflow.demo', 'Demo Organizer', 'organizer'),
        ('b1000003-0003-4003-8003-000000000003'::uuid, 'admin@ticketflow.demo', 'Demo Admin', 'admin')
    ) as t(uid, email, full_name, app_role)
  loop
    if exists (select 1 from auth.users u where u.id = rec.uid or lower(u.email) = lower(rec.email)) then
      continue;
    end if;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone_change,
      phone_change_token
    )
    values (
      instance_id,
      rec.uid,
      'authenticated',
      'authenticated',
      rec.email,
      pass_enc,
      timezone('utc', now()),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', rec.full_name, 'role', rec.app_role),
      false,
      timezone('utc', now()),
      timezone('utc', now()),
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      rec.uid,
      rec.uid::text,
      jsonb_build_object(
        'sub', rec.uid::text,
        'email', rec.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  end loop;

  -- Match profiles to these users (handles trigger-created rows or reruns).
  insert into public.profiles (id, full_name, role)
  values
    ('b1000001-0001-4001-8001-000000000001'::uuid, 'Demo Attendee', 'attendee'),
    ('b1000002-0002-4002-8002-000000000002'::uuid, 'Demo Organizer', 'organizer'),
    ('b1000003-0003-4003-8003-000000000003'::uuid, 'Demo Admin', 'admin')
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();
end $$;

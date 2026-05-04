-- TicketFlow — run this in Supabase SQL Editor (full script)
-- https://supabase.com/dashboard/project/_/sql

-- Extensions
create extension if not exists "pgcrypto";

-- Roles stored on profiles mirror app: attendee | organizer | admin
create type public.event_status as enum ('Active', 'Upcoming', 'Closed');
create type public.tier_listing_status as enum ('On Sale', 'Sold Out', 'Paused');

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'attendee' check (role in ('attendee', 'organizer', 'admin')),
  phone text,
  company text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  event_date date not null,
  location text not null default '',
  status public.event_status not null default 'Upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  tier_name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  sold integer not null default 0 check (sold >= 0),
  enabled boolean not null default true,
  listing_status public.tier_listing_status not null default 'On Sale',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issued_tickets (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.ticket_tiers (id) on delete restrict,
  booking_code text not null unique,
  buyer_name text not null,
  buyer_email text not null,
  qr_payload text not null,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_events_organizer on public.events (organizer_id);
create index idx_ticket_tiers_event on public.ticket_tiers (event_id);
create index idx_issued_tickets_tier on public.issued_tickets (tier_id);
create index idx_issued_tickets_booking on public.issued_tickets (booking_code);
create index idx_issued_tickets_buyer_email on public.issued_tickets (lower(buyer_email));

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger ticket_tiers_updated_at before update on public.ticket_tiers
  for each row execute function public.set_updated_at();

-- Sync listing_status with sold/quantity
create or replace function public.sync_tier_listing_status()
returns trigger as $$
begin
  if new.sold >= new.quantity and new.quantity > 0 then
    new.listing_status = 'Sold Out';
  elsif new.listing_status = 'Sold Out' and new.sold < new.quantity then
    new.listing_status = 'On Sale';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ticket_tiers_sold_status before insert or update of sold, quantity on public.ticket_tiers
  for each row execute function public.sync_tier_listing_status();

-- New auth user → profile
create or replace function public.handle_new_user()
returns trigger as $$
declare
  r text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'attendee');
  if r not in ('attendee', 'organizer', 'admin') then
    r := 'attendee';
  end if;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    r
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS helpers (security definer avoids recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_organizer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('organizer', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.issued_tickets enable row level security;

-- Profiles
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- Events: organizers see/manage own; admins all; attendees read all (browse)
create policy "events_select"
  on public.events for select
  using (
    public.is_admin()
    or organizer_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
  );

create policy "events_insert_organizer"
  on public.events for insert
  with check (organizer_id = auth.uid() or public.is_admin());

create policy "events_update_organizer"
  on public.events for update
  using (organizer_id = auth.uid() or public.is_admin());

create policy "events_delete_organizer"
  on public.events for delete
  using (organizer_id = auth.uid() or public.is_admin());

-- Ticket tiers
create policy "ticket_tiers_select"
  on public.ticket_tiers for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and (
          public.is_admin()
          or e.organizer_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
        )
    )
  );

create policy "ticket_tiers_write_organizer"
  on public.ticket_tiers for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

create policy "ticket_tiers_update_organizer"
  on public.ticket_tiers for update
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

create policy "ticket_tiers_delete_organizer"
  on public.ticket_tiers for delete
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

-- Issued tickets
create policy "issued_select"
  on public.issued_tickets for select
  using (
    lower(buyer_email) = lower(auth.jwt() ->> 'email')
    or exists (
      select 1
      from public.ticket_tiers tt
      join public.events e on e.id = tt.event_id
      where tt.id = tier_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

create policy "issued_insert_organizer"
  on public.issued_tickets for insert
  with check (
    exists (
      select 1 from public.ticket_tiers tt
      join public.events e on e.id = tt.event_id
      where tt.id = tier_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

create policy "issued_update_checkin"
  on public.issued_tickets for update
  using (
    exists (
      select 1 from public.ticket_tiers tt
      join public.events e on e.id = tt.event_id
      where tt.id = tier_id and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

-- Attendee-scoped events (subscribe + per-event invites): run after this file:
--   supabase/migrations/20260204130000_attendee_subscribe_invite.sql
-- It replaces the broad "attendees read all events" policies with subscription + invite grants.

-- Optional seed (comment out if not needed)
-- Sign up through the app first, then note your user id from auth.users and run:
-- insert into public.events (organizer_id, name, event_date, location, status)
-- values ('YOUR_USER_UUID', 'Demo Conference', current_date + 30, 'Demo City', 'Upcoming');

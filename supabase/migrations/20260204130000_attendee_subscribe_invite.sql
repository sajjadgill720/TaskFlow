-- Attendee: subscribe to organizers (see all their events) OR redeem event invite (see one event only).
-- Run after base schema. Replaces broad attendee read-all policies.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.organizer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint organizer_subscriptions_unique unique (subscriber_id, organizer_id),
  constraint organizer_subscriptions_no_self check (subscriber_id <> organizer_id)
);

create index if not exists idx_organizer_subscriptions_subscriber on public.organizer_subscriptions (subscriber_id);
create index if not exists idx_organizer_subscriptions_organizer on public.organizer_subscriptions (organizer_id);

create table if not exists public.attendee_event_grants (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  source text not null default 'invite' check (source = 'invite'),
  created_at timestamptz not null default now(),
  constraint attendee_event_grants_unique unique (subscriber_id, event_id)
);

create index if not exists idx_attendee_event_grants_subscriber on public.attendee_event_grants (subscriber_id);
create index if not exists idx_attendee_event_grants_event on public.attendee_event_grants (event_id);

create table if not exists public.event_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_event_invite_tokens_event on public.event_invite_tokens (event_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizer_subscriptions enable row level security;
alter table public.attendee_event_grants enable row level security;
alter table public.event_invite_tokens enable row level security;

-- Used by organizer_subscriptions INSERT: attendees cannot SELECT other profiles under RLS,
-- so plain EXISTS on profiles.organizer_id would always fail for subscribers.
create or replace function public.profile_is_organizer_or_admin(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_id and p.role in ('organizer', 'admin')
  );
$$;

revoke all on function public.profile_is_organizer_or_admin(uuid) from public;
grant execute on function public.profile_is_organizer_or_admin(uuid) to authenticated;

drop policy if exists "organizer_subscriptions_select" on public.organizer_subscriptions;
create policy "organizer_subscriptions_select"
  on public.organizer_subscriptions for select
  using (subscriber_id = auth.uid() or organizer_id = auth.uid() or public.is_admin());

drop policy if exists "organizer_subscriptions_insert" on public.organizer_subscriptions;
create policy "organizer_subscriptions_insert"
  on public.organizer_subscriptions for insert
  with check (
    subscriber_id = auth.uid()
    and organizer_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
    and public.profile_is_organizer_or_admin(organizer_id)
  );

drop policy if exists "organizer_subscriptions_delete_own" on public.organizer_subscriptions;
create policy "organizer_subscriptions_delete_own"
  on public.organizer_subscriptions for delete
  using (subscriber_id = auth.uid() or public.is_admin());

drop policy if exists "attendee_event_grants_select" on public.attendee_event_grants;
create policy "attendee_event_grants_select"
  on public.attendee_event_grants for select
  using (subscriber_id = auth.uid() or public.is_admin());

drop policy if exists "event_invite_tokens_select_organizer" on public.event_invite_tokens;
create policy "event_invite_tokens_select_organizer"
  on public.event_invite_tokens for select
  using (
    public.is_admin()
    or exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
  );

drop policy if exists "event_invite_tokens_insert_organizer" on public.event_invite_tokens;
create policy "event_invite_tokens_insert_organizer"
  on public.event_invite_tokens for insert
  with check (
    exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin()))
  );

drop policy if exists "event_invite_tokens_delete_organizer" on public.event_invite_tokens;
create policy "event_invite_tokens_delete_organizer"
  on public.event_invite_tokens for delete
  using (
    exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin()))
  );

-- Replace attendee-wide event/tier read with scoped access
drop policy if exists "events_select" on public.events;
create policy "events_select"
  on public.events for select
  using (
    public.is_admin()
    or organizer_id = auth.uid()
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
      and (
        exists (
          select 1 from public.organizer_subscriptions os
          where os.subscriber_id = auth.uid() and os.organizer_id = events.organizer_id
        )
        or exists (
          select 1 from public.attendee_event_grants g
          where g.subscriber_id = auth.uid() and g.event_id = events.id
        )
      )
    )
  );

drop policy if exists "ticket_tiers_select" on public.ticket_tiers;
create policy "ticket_tiers_select"
  on public.ticket_tiers for select
  using (
    exists (
      select 1 from public.events e
      where e.id = ticket_tiers.event_id
        and (
          public.is_admin()
          or e.organizer_id = auth.uid()
          or (
            exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
            and (
              exists (
                select 1 from public.organizer_subscriptions os
                where os.subscriber_id = auth.uid() and os.organizer_id = e.organizer_id
              )
              or exists (
                select 1 from public.attendee_event_grants g
                where g.subscriber_id = auth.uid() and g.event_id = e.id
              )
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: directory (avoid widening profiles RLS)
-- ---------------------------------------------------------------------------

create or replace function public.list_organizers_for_discovery()
returns table (id uuid, full_name text, company text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.company
  from public.profiles p
  where p.role in ('organizer', 'admin')
  order by p.full_name asc;
$$;

revoke all on function public.list_organizers_for_discovery() from public;
grant execute on function public.list_organizers_for_discovery() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: redeem invite → single-event grant
-- ---------------------------------------------------------------------------

create or replace function public.redeem_event_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'attendee') then
    raise exception 'Only attendee accounts can redeem event invites';
  end if;

  select t.event_id into v_event_id
  from public.event_invite_tokens t
  where t.token = trim(p_token)
    and (t.expires_at is null or t.expires_at > now())
  limit 1;

  if v_event_id is null then
    raise exception 'Invalid or expired invite';
  end if;

  insert into public.attendee_event_grants (subscriber_id, event_id, source)
  values (v_uid, v_event_id, 'invite')
  on conflict on constraint attendee_event_grants_unique do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.redeem_event_invite(text) from public;
grant execute on function public.redeem_event_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: attendee self-purchase (transactional)
-- ---------------------------------------------------------------------------

create or replace function public.purchase_tier_ticket(p_tier_id uuid, p_buyer_name text, p_buyer_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sold int;
  v_qty int;
  v_status public.tier_listing_status;
  v_event_id uuid;
  v_organizer_id uuid;
  v_tier_name text;
  v_booking text;
  v_payload text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if lower(trim(p_buyer_email)) is distinct from lower(trim(auth.jwt() ->> 'email')) then
    raise exception 'Buyer email must match signed-in account';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'attendee') then
    raise exception 'Only attendees can use self-purchase';
  end if;

  select tt.sold, tt.quantity, tt.listing_status, tt.event_id, tt.tier_name, e.organizer_id
  into v_sold, v_qty, v_status, v_event_id, v_tier_name, v_organizer_id
  from public.ticket_tiers tt
  inner join public.events e on e.id = tt.event_id
  where tt.id = p_tier_id
  for update of tt;

  if not found then
    raise exception 'Ticket type not found';
  end if;

  if v_status <> 'On Sale'::public.tier_listing_status or v_sold >= v_qty then
    raise exception 'Not available for purchase';
  end if;

  if not (
    exists (
      select 1 from public.organizer_subscriptions os
      where os.subscriber_id = v_uid and os.organizer_id = v_organizer_id
    )
    or exists (
      select 1 from public.attendee_event_grants g
      where g.subscriber_id = v_uid and g.event_id = v_event_id
    )
  ) then
    raise exception 'You do not have access to this event';
  end if;

  v_booking := 'BK-' || upper(replace(gen_random_uuid()::text, '-', ''));
  v_payload := v_booking || '|' || v_event_id::text || '|' || coalesce(v_tier_name, '') || '|' || lower(trim(p_buyer_email));

  insert into public.issued_tickets (tier_id, booking_code, buyer_name, buyer_email, qr_payload)
  values (p_tier_id, v_booking, trim(p_buyer_name), lower(trim(p_buyer_email)), v_payload);

  update public.ticket_tiers set sold = sold + 1 where id = p_tier_id;

  return jsonb_build_object('booking_code', v_booking, 'ok', true);
end;
$$;

revoke all on function public.purchase_tier_ticket(uuid, text, text) from public;
grant execute on function public.purchase_tier_ticket(uuid, text, text) to authenticated;

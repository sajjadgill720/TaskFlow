-- Fix: attendee INSERT on organizer_subscriptions failed because RLS blocked
-- reading other users' profiles inside the policy EXISTS check.

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

drop policy if exists "organizer_subscriptions_insert" on public.organizer_subscriptions;
create policy "organizer_subscriptions_insert"
  on public.organizer_subscriptions for insert
  with check (
    subscriber_id = auth.uid()
    and organizer_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'attendee')
    and public.profile_is_organizer_or_admin(organizer_id)
  );

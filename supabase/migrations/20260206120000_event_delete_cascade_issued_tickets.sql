-- Allow organizers/admins to delete events; cascades remove tiers and issued ticket rows.
-- Previously issued_tickets.tier_id used ON DELETE RESTRICT, blocking event deletion when sales existed.

alter table public.issued_tickets
  drop constraint if exists issued_tickets_tier_id_fkey;

alter table public.issued_tickets
  add constraint issued_tickets_tier_id_fkey
  foreign key (tier_id) references public.ticket_tiers (id) on delete cascade;

drop policy if exists "issued_delete_organizer" on public.issued_tickets;
create policy "issued_delete_organizer"
  on public.issued_tickets for delete
  using (
    exists (
      select 1 from public.ticket_tiers tt
      join public.events e on e.id = tt.event_id
      where tt.id = tier_id
        and (e.organizer_id = auth.uid() or public.is_admin())
    )
  );

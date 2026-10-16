-- Partner portal RLS: authenticated agents may SELECT only their own commerce
-- rows (bookings, folios, payments, allotments, credit ledger, MoU links).
-- Desk and server actions continue to use the service role (bypasses RLS).

create schema if not exists private;

create or replace function private.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select id
  from public.agents
  where auth_user_id = (select auth.uid())
    and can_login = true
    and status in ('approved', 'demo')
  limit 1
$$;

revoke all on function private.current_agent_id() from public, anon;
grant execute on function private.current_agent_id() to authenticated, service_role;

comment on function private.current_agent_id() is
  'Portal session agent id from agents.auth_user_id; null when not a logged-in partner.';

-- Own agent row (company + credit terms)
drop policy if exists "agent portal select self" on public.agents;
create policy "agent portal select self" on public.agents
  for select to authenticated
  using (id = (select private.current_agent_id()));

-- MoU hotel links
alter table public.agent_property_links enable row level security;
drop policy if exists "service_role full agent_property_links" on public.agent_property_links;
create policy "service_role full agent_property_links" on public.agent_property_links
  for all to service_role using (true) with check (true);
drop policy if exists "agent portal select own links" on public.agent_property_links;
create policy "agent portal select own links" on public.agent_property_links
  for select to authenticated
  using (agent_id = (select private.current_agent_id()));

-- Bookings owned by this agent (RLS may already be on via prior policies)
alter table public.bookings enable row level security;
drop policy if exists "service_role full bookings" on public.bookings;
create policy "service_role full bookings" on public.bookings
  for all to service_role using (true) with check (true);
drop policy if exists "agent portal select own bookings" on public.bookings;
create policy "agent portal select own bookings" on public.bookings
  for select to authenticated
  using (agent_id = (select private.current_agent_id()));

-- Room lines for those bookings
alter table public.booking_rooms enable row level security;
drop policy if exists "service_role full booking_rooms" on public.booking_rooms;
create policy "service_role full booking_rooms" on public.booking_rooms
  for all to service_role using (true) with check (true);
drop policy if exists "agent portal select own booking_rooms" on public.booking_rooms;
create policy "agent portal select own booking_rooms" on public.booking_rooms
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_rooms.booking_id
        and b.agent_id = (select private.current_agent_id())
    )
  );

-- Folios tied to agent bookings or agent_id
drop policy if exists "agent portal select own folios" on public.folios;
create policy "agent portal select own folios" on public.folios
  for select to authenticated
  using (
    agent_id = (select private.current_agent_id())
    or exists (
      select 1
      from public.bookings b
      where b.id = folios.booking_id
        and b.agent_id = (select private.current_agent_id())
    )
  );

-- Payments on those bookings/folios
drop policy if exists "agent portal select own payments" on public.payments;
create policy "agent portal select own payments" on public.payments
  for select to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = payments.booking_id
        and b.agent_id = (select private.current_agent_id())
    )
    or exists (
      select 1
      from public.folios f
      where f.id = payments.folio_id
        and (
          f.agent_id = (select private.current_agent_id())
          or exists (
            select 1
            from public.bookings b
            where b.id = f.booking_id
              and b.agent_id = (select private.current_agent_id())
          )
        )
    )
  );

-- Allotments + credit ledger
drop policy if exists "agent portal select own allotments" on public.agent_allotments;
create policy "agent portal select own allotments" on public.agent_allotments
  for select to authenticated
  using (agent_id = (select private.current_agent_id()));

drop policy if exists "agent portal select own credit ledger" on public.agent_credit_ledger;
create policy "agent portal select own credit ledger" on public.agent_credit_ledger
  for select to authenticated
  using (agent_id = (select private.current_agent_id()));

-- P4 follow-up: restore anon insert WITH CHECK to match public form statuses
-- (015 briefly set orders→pending and enquiries→pending, which breaks intake)

drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders" on orders
  for insert to anon, authenticated
  with check (status = 'received');

drop policy if exists "anon insert enquiries" on enquiries;
create policy "anon insert enquiries" on enquiries
  for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "anon insert pending agents" on agents;
create policy "anon insert pending agents" on agents
  for insert to anon, authenticated
  with check (status = 'pending' and credit_limit = 0 and credit_used = 0);

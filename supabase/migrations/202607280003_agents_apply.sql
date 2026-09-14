-- Agent public apply contact fields (Pelbu)
-- Applied remotely via Supabase MCP.

alter table agents
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists notes text,
  add column if not exists wants_mou boolean not null default false;

drop policy if exists "anon insert pending agents" on agents;
create policy "anon insert pending agents" on agents
  for insert to anon, authenticated
  with check (status = 'pending' and credit_limit = 0 and credit_used = 0);

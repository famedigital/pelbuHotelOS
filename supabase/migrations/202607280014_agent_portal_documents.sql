-- P3b: agent portal tokens + documents (hardened RLS)
-- Desk and portal pages use service_role / admin client — do not expose credit
-- or agent rows to anon via broad policies.

alter table agents
  add column if not exists portal_token text,
  add column if not exists portal_token_issued_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists demo_until date;

create unique index if not exists agents_portal_token_uidx
  on agents (portal_token)
  where portal_token is not null;

create table if not exists agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind = any (array[
    'license'::text,
    'mou_draft'::text,
    'mou_signed'::text,
    'gst_cert'::text,
    'other'::text
  ])),
  doc_url text not null,
  doc_name text,
  notes text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists agent_documents_agent_idx
  on agent_documents (agent_id, created_at desc);

alter table agent_documents enable row level security;

-- Drop insecure policies from earlier draft (if ever applied)
drop policy if exists "anon insert agent_documents license" on agent_documents;
drop policy if exists "anon update pending agent own fields" on agents;
drop policy if exists "public read approved agent by token" on agents;

-- Desk / server actions use service_role — full access
drop policy if exists "service_role full agent_documents" on agent_documents;
create policy "service_role full agent_documents" on agent_documents
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full agents" on agents;
create policy "service_role full agents" on agents
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full agent_credit_ledger" on agent_credit_ledger;
create policy "service_role full agent_credit_ledger" on agent_credit_ledger
  for all to service_role using (true) with check (true);

-- Keep existing public apply insert (pending only) if present; do not add anon update.
-- Portal lookups run through admin client with exact portal_token match.

create or replace function public.issue_agent_portal_token(p_agent_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := encode(gen_random_bytes(24), 'hex');
  update agents
    set portal_token = v_token,
        portal_token_issued_at = now()
    where id = p_agent_id;
  if not found then
    raise exception 'agent not found';
  end if;
  return v_token;
end;
$$;

revoke all on function public.issue_agent_portal_token(uuid) from public;
revoke execute on function public.issue_agent_portal_token(uuid) from anon;
revoke execute on function public.issue_agent_portal_token(uuid) from authenticated;
grant execute on function public.issue_agent_portal_token(uuid) to service_role;

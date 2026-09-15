-- Shared agent portal: per-hotel membership + commercial terms.
-- Identity (login_code, Auth) stays on agents; credit/tier/cap live on links.
-- Flagship slug for backfill + mirror: demo-hotel, else pelbu-suites-olakha, else first property.

create table if not exists public.agent_property_links (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'approved'
    check (status in ('invited', 'approved', 'suspended')),
  rate_tier text not null default 'agents',
  credit_limit numeric(12,2) not null default 0,
  credit_used numeric(12,2) not null default 0,
  open_room_cap integer,
  linked_by_staff_id uuid references public.staff_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, property_id)
);

create index if not exists agent_property_links_property_status_idx
  on public.agent_property_links (property_id, status);

create index if not exists agent_property_links_agent_status_idx
  on public.agent_property_links (agent_id, status);

comment on table public.agent_property_links is
  'Per-hotel agent membership and commercial terms. Portal requires status=approved. Global agents.credit_* are legacy mirrors for the flagship property only.';

-- Backfill approved/demo agents onto flagship property.
do $$
declare
  flagship_id uuid;
begin
  select id into flagship_id
  from public.properties
  where slug = 'demo-hotel'
  limit 1;

  if flagship_id is null then
    select id into flagship_id
    from public.properties
    where slug = 'pelbu-suites-olakha'
    limit 1;
  end if;

  if flagship_id is null then
    select id into flagship_id
    from public.properties
    order by created_at nulls last, slug
    limit 1;
  end if;

  if flagship_id is null then
    raise notice 'agent_property_links: no properties — skip backfill';
    return;
  end if;

  insert into public.agent_property_links (
    agent_id,
    property_id,
    status,
    rate_tier,
    credit_limit,
    credit_used,
    open_room_cap
  )
  select
    a.id,
    flagship_id,
    'approved',
    coalesce(nullif(trim(a.rate_tier), ''), 'agents'),
    coalesce(a.credit_limit, 0),
    coalesce(a.credit_used, 0),
    a.open_room_cap
  from public.agents a
  where a.status in ('approved', 'demo')
  on conflict (agent_id, property_id) do nothing;
end $$;

-- Mirror link commercial fields onto agents.* only for the flagship property.
create or replace function public.mirror_flagship_agent_link_to_agents()
returns trigger
language plpgsql
as $$
declare
  flagship_id uuid;
begin
  select id into flagship_id
  from public.properties
  where slug = 'demo-hotel'
  limit 1;

  if flagship_id is null then
    select id into flagship_id
    from public.properties
    where slug = 'pelbu-suites-olakha'
    limit 1;
  end if;

  if flagship_id is null then
    select id into flagship_id
    from public.properties
    order by created_at nulls last, slug
    limit 1;
  end if;

  if flagship_id is null or new.property_id is distinct from flagship_id then
    return new;
  end if;

  update public.agents
  set
    rate_tier = new.rate_tier,
    credit_limit = new.credit_limit,
    credit_used = new.credit_used,
    open_room_cap = coalesce(new.open_room_cap, open_room_cap)
  where id = new.agent_id;

  return new;
end;
$$;

drop trigger if exists trg_mirror_flagship_agent_link on public.agent_property_links;
create trigger trg_mirror_flagship_agent_link
  after insert or update of rate_tier, credit_limit, credit_used, open_room_cap, property_id
  on public.agent_property_links
  for each row
  execute function public.mirror_flagship_agent_link_to_agents();

alter table public.agent_property_links enable row level security;

drop policy if exists "service_role full agent_property_links" on public.agent_property_links;
create policy "service_role full agent_property_links"
  on public.agent_property_links
  for all
  using (true)
  with check (true);

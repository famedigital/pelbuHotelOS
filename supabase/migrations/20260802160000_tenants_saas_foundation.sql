-- Wave 4: white-label SaaS tenants foundation.
-- Keeps properties.public_host / desk_host as the Host → property map.
-- tenant_id is nullable so single-hotel Olakha remains valid without a row.

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  plan text not null default 'starter'
    check (
      plan = any (
        array[
          'starter'::text,
          'hotel'::text,
          'chain'::text,
          'flagship'::text
        ]
      )
    ),
  seat_limit integer not null default 10
    check (seat_limit > 0 and seat_limit <= 10000),
  billing_status text not null default 'invoice'
    check (
      billing_status = any (
        array[
          'trial'::text,
          'invoice'::text,
          'active'::text,
          'past_due'::text,
          'cancelled'::text
        ]
      )
    ),
  billing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenants_slug_uidx
  on tenants (lower(slug));

comment on table tenants is
  'SaaS org / chain. One tenant owns one or more properties. Billing is invoice-first stub (no Stripe required).';
comment on column tenants.plan is
  'Commercial plan stub: starter | hotel | chain | flagship.';
comment on column tenants.seat_limit is
  'Soft staff seat cap for desk-visible billing status. Not auto-enforced yet.';
comment on column tenants.billing_status is
  'Invoice-first billing stub: trial | invoice | active | past_due | cancelled.';

create table if not exists tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin'
    check (role = any (array['owner'::text, 'admin'::text])),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx
  on tenant_members (user_id);

comment on table tenant_members is
  'Auth users who admin a tenant org (owner/admin). Property desk staff stay on staff_members.';

alter table properties
  add column if not exists tenant_id uuid references tenants (id) on delete set null;

create index if not exists properties_tenant_id_idx
  on properties (tenant_id)
  where tenant_id is not null;

comment on column properties.tenant_id is
  'Owning SaaS tenant. Null is allowed for legacy / flagship-only rows; seed attaches Olakha.';

-- Default tenant for Pelbu Suites Olakha (idempotent).
insert into tenants (name, slug, plan, seat_limit, billing_status, billing_notes)
select
  'Pelbu Suites',
  'pelbu-suites',
  'flagship',
  25,
  'active',
  'Platform flagship — invoice/ops internal; not a paying SaaS tenant.'
where not exists (
  select 1 from tenants where lower(slug) = 'pelbu-suites'
);

update properties p
set tenant_id = t.id
from tenants t
where t.slug = 'pelbu-suites'
  and p.slug = 'pelbu-suites-olakha'
  and p.tenant_id is null;

alter table tenants enable row level security;
alter table tenant_members enable row level security;

drop policy if exists tenants_service_role on tenants;
create policy tenants_service_role
  on tenants
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists tenants_member_select on tenants;
create policy tenants_member_select
  on tenants
  for select
  to authenticated
  using (
    exists (
      select 1
      from tenant_members tm
      where tm.tenant_id = tenants.id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists tenant_members_service_role on tenant_members;
create policy tenant_members_service_role
  on tenant_members
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists tenant_members_self_select on tenant_members;
create policy tenant_members_self_select
  on tenant_members
  for select
  to authenticated
  using (user_id = auth.uid());

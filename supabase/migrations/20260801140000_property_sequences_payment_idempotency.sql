-- Phase B: property-scoped sequences + payment idempotency

create table if not exists property_sequences (
  property_id uuid not null references properties (id) on delete cascade,
  kind text not null,
  last_value bigint not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (property_id, kind)
);

alter table property_sequences enable row level security;

create policy property_sequences_service_role
  on property_sequences
  for all
  to service_role
  using (true)
  with check (true);

create or replace function next_property_sequence(
  p_property_id uuid,
  p_kind text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  if p_property_id is null or coalesce(trim(p_kind), '') = '' then
    raise exception 'property_id and kind are required';
  end if;

  insert into property_sequences (property_id, kind, last_value, updated_at)
  values (p_property_id, trim(p_kind), 1, now())
  on conflict (property_id, kind)
  do update
    set last_value = property_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return v_next;
end;
$$;

revoke all on function next_property_sequence(uuid, text) from public;
grant execute on function next_property_sequence(uuid, text) to service_role;

alter table payments
  add column if not exists idempotency_key text;

create unique index if not exists payments_property_idempotency_uidx
  on payments (property_id, idempotency_key)
  where idempotency_key is not null;

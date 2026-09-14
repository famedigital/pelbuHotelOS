-- Per-bag custody labels for laundry (Amazon-style stickers).
-- Billing remains on laundry_orders; bags are physical custody units only.

create table if not exists laundry_order_bags (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  order_id uuid not null references laundry_orders(id) on delete cascade,
  bag_seq smallint not null check (bag_seq between 1 and 50),
  public_code text not null,
  scan_token_hash text not null,
  status text not null default 'open' check (status = any (array[
    'open'::text,
    'in_process'::text,
    'ready'::text,
    'delivered'::text,
    'voided'::text
  ])),
  notes text,
  garment_count integer not null default 0 check (garment_count >= 0),
  label_printed_at timestamptz,
  last_scanned_at timestamptz,
  last_scanned_by uuid references staff_members(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references staff_members(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, bag_seq),
  unique (public_code),
  unique (scan_token_hash)
);

create table if not exists laundry_bag_items (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references laundry_order_bags(id) on delete cascade,
  order_item_id uuid not null references laundry_order_items(id) on delete cascade,
  qty integer not null check (qty between 1 and 200),
  created_at timestamptz not null default now(),
  unique (bag_id, order_item_id)
);

create table if not exists laundry_bag_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  bag_id uuid not null references laundry_order_bags(id) on delete cascade,
  order_id uuid not null references laundry_orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  notes text,
  actor_kind text not null check (actor_kind = any (array[
    'front_desk'::text, 'staff'::text, 'system'::text
  ])),
  actor_staff_id uuid references staff_members(id) on delete set null,
  client_event_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists laundry_bag_events_client_uidx
  on laundry_bag_events (bag_id, client_event_id)
  where client_event_id is not null;
create index if not exists laundry_bags_order_idx
  on laundry_order_bags (order_id, bag_seq);
create index if not exists laundry_bags_board_idx
  on laundry_order_bags (property_id, status, created_at desc);
create index if not exists laundry_bags_token_idx
  on laundry_order_bags (scan_token_hash)
  where voided_at is null;
create index if not exists laundry_bags_last_scanned_by_idx
  on laundry_order_bags (last_scanned_by)
  where last_scanned_by is not null;
create index if not exists laundry_bags_voided_by_idx
  on laundry_order_bags (voided_by)
  where voided_by is not null;
create index if not exists laundry_bag_items_order_item_idx
  on laundry_bag_items (order_item_id);
create index if not exists laundry_bag_events_bag_idx
  on laundry_bag_events (bag_id, created_at);
create index if not exists laundry_bag_events_order_idx
  on laundry_bag_events (order_id, created_at);
create index if not exists laundry_bag_events_staff_idx
  on laundry_bag_events (actor_staff_id)
  where actor_staff_id is not null;

alter table laundry_order_bags enable row level security;
alter table laundry_bag_items enable row level security;
alter table laundry_bag_events enable row level security;

create policy "service role laundry bags" on laundry_order_bags
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry bag items" on laundry_bag_items
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry bag events" on laundry_bag_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "laundry staff read bags" on laundry_order_bags
  for select to authenticated using (is_laundry_staff(property_id));
create policy "laundry staff read bag items" on laundry_bag_items
  for select to authenticated using (
    exists (
      select 1 from laundry_order_bags b
      where b.id = bag_id and is_laundry_staff(b.property_id)
    )
  );
create policy "laundry staff read bag events" on laundry_bag_events
  for select to authenticated using (is_laundry_staff(property_id));

-- Atomic prepare: create bags + allocate garments; reject over-allocation.
-- Each bag jsonb element may include optional "id" (pre-generated UUID for QR URL).
create or replace function laundry_prepare_bags(
  p_order_id uuid,
  p_staff_id uuid,
  p_bags jsonb,
  p_actor_kind text default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order laundry_orders%rowtype;
  v_staff staff_members%rowtype;
  v_bag jsonb;
  v_item jsonb;
  v_bag_id uuid;
  v_seq int;
  v_token_hash text;
  v_public_code text;
  v_garment_count int;
  v_created uuid[] := '{}';
  v_alloc record;
  v_cap int;
begin
  if p_actor_kind not in ('staff', 'front_desk') then
    raise exception 'Invalid actor kind';
  end if;
  select * into v_order from laundry_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Laundry order not found'; end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Cannot prepare bags for % laundry', v_order.status;
  end if;

  select * into v_staff from staff_members
  where id = p_staff_id and property_id = v_order.property_id
    and status in ('active', 'on_leave');
  if v_staff.id is null then raise exception 'Staff member is not valid'; end if;

  if jsonb_typeof(p_bags) <> 'array' or jsonb_array_length(p_bags) < 1 then
    raise exception 'Add at least one bag';
  end if;
  if jsonb_array_length(p_bags) > 50 then
    raise exception 'Maximum 50 bags per order';
  end if;

  -- Void any previous active bags when re-preparing (audit via void events).
  insert into laundry_bag_events (
    property_id, bag_id, order_id, event_type, from_status, to_status,
    notes, actor_kind, actor_staff_id
  )
  select
    property_id, id, order_id, 'voided', status, 'voided',
    'Replaced by new bag preparation', p_actor_kind, p_staff_id
  from laundry_order_bags
  where order_id = p_order_id
    and status <> 'voided'
    and voided_at is null;

  update laundry_order_bags
  set status = 'voided',
      voided_at = now(),
      voided_by = p_staff_id,
      void_reason = 'Replaced by new bag preparation',
      updated_at = now()
  where order_id = p_order_id
    and status <> 'voided'
    and voided_at is null;

  v_seq := 0;
  for v_bag in select * from jsonb_array_elements(p_bags)
  loop
    v_seq := v_seq + 1;
    v_token_hash := nullif(v_bag->>'token_hash', '');
    v_public_code := nullif(v_bag->>'public_code', '');
    v_bag_id := coalesce(nullif(v_bag->>'id', '')::uuid, gen_random_uuid());
    if v_token_hash is null or length(v_token_hash) < 32 then
      raise exception 'Bag % is missing a scan token hash', v_seq;
    end if;
    if v_public_code is null or length(v_public_code) < 4 then
      raise exception 'Bag % is missing a public code', v_seq;
    end if;
    if jsonb_typeof(v_bag->'items') <> 'array'
       or jsonb_array_length(v_bag->'items') < 1 then
      raise exception 'Bag % needs at least one garment', v_seq;
    end if;

    v_garment_count := 0;
    insert into laundry_order_bags (
      id, property_id, order_id, bag_seq, public_code, scan_token_hash,
      notes, garment_count, status
    ) values (
      v_bag_id, v_order.property_id, p_order_id, v_seq, v_public_code, v_token_hash,
      nullif(v_bag->>'notes', ''), 0, 'open'
    );

    for v_item in select * from jsonb_array_elements(v_bag->'items')
    loop
      if (v_item->>'order_item_id') is null
         or (v_item->>'qty')::int is null
         or (v_item->>'qty')::int < 1 then
        raise exception 'Bag % has an invalid garment line', v_seq;
      end if;
      if not exists (
        select 1 from laundry_order_items
        where id = (v_item->>'order_item_id')::uuid
          and order_id = p_order_id
      ) then
        raise exception 'Bag % references a garment outside this order', v_seq;
      end if;
      insert into laundry_bag_items (bag_id, order_item_id, qty)
      values (
        v_bag_id,
        (v_item->>'order_item_id')::uuid,
        (v_item->>'qty')::int
      );
      v_garment_count := v_garment_count + (v_item->>'qty')::int;
    end loop;

    update laundry_order_bags
    set garment_count = v_garment_count, updated_at = now()
    where id = v_bag_id;

    insert into laundry_bag_events (
      property_id, bag_id, order_id, event_type, to_status,
      notes, actor_kind, actor_staff_id
    ) values (
      v_order.property_id, v_bag_id, p_order_id, 'prepared', 'open',
      format('Bag %s of %s prepared', v_seq, jsonb_array_length(p_bags)),
      p_actor_kind, p_staff_id
    );

    v_created := array_append(v_created, v_bag_id);
  end loop;

  -- Allocation may not exceed confirmed (or requested) qty per order item.
  for v_alloc in
    select
      li.id as order_item_id,
      coalesce(li.confirmed_qty, li.requested_qty) as cap,
      coalesce((
        select sum(bi.qty)::int
        from laundry_bag_items bi
        join laundry_order_bags b on b.id = bi.bag_id
        where bi.order_item_id = li.id
          and b.order_id = p_order_id
          and b.status <> 'voided'
      ), 0) as allocated
    from laundry_order_items li
    where li.order_id = p_order_id
  loop
    v_cap := v_alloc.cap;
    if v_alloc.allocated > v_cap then
      raise exception
        'Allocated qty % exceeds available % for a garment line',
        v_alloc.allocated, v_cap;
    end if;
  end loop;

  update laundry_orders set updated_at = now() where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'bag_ids', to_jsonb(v_created),
    'bag_count', coalesce(array_length(v_created, 1), 0)
  );
end;
$$;

revoke all on function laundry_prepare_bags(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function laundry_prepare_bags(uuid, uuid, jsonb, text)
  to service_role;

create or replace function laundry_bags_fully_allocated(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_and(allocated = cap), false)
  from (
    select
      coalesce(li.confirmed_qty, li.requested_qty) as cap,
      coalesce((
        select sum(bi.qty)::int
        from laundry_bag_items bi
        join laundry_order_bags b on b.id = bi.bag_id
        where bi.order_item_id = li.id
          and b.order_id = li.order_id
          and b.status <> 'voided'
      ), 0) as allocated
    from laundry_order_items li
    where li.order_id = p_order_id
      and coalesce(li.confirmed_qty, li.requested_qty) > 0
  ) s;
$$;

revoke all on function laundry_bags_fully_allocated(uuid)
  from public, anon, authenticated;
grant execute on function laundry_bags_fully_allocated(uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'laundry_order_bags'
  ) then
    alter publication supabase_realtime add table laundry_order_bags;
  end if;
end $$;

comment on table laundry_order_bags is
  'Physical laundry bags with hashed scan tokens; billing stays on laundry_orders.';
comment on column laundry_order_bags.scan_token_hash is
  'SHA-256 of the raw QR token; raw token is never stored.';

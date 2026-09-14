-- Align Olakha physical room units to Seven Suites eZee room chart.
-- eZee chart (guest): 22 Twin + 4 King + 1 Suite = 27 units (same total as today).
-- Labels become physical room numbers so auto-assign can honor "eZee room: 201" notes.
-- Safe: only property slug pelbu-suites-olakha; no-op if already using digit labels.

do $$
declare
  v_property_id uuid;
  v_dt uuid;
  v_dq uuid;
  v_sr uuid;
  v_twin text[] := array[
    '201','202','203','204','205','206',
    '301','302','303','304','305','306',
    '401','402','403','404','405','406',
    '501','503','504','505'
  ];
  v_king text[] := array['207','307','407','506'];
  v_suite text := '502';
  r record;
  i int := 0;
  v_digit_labels int;
  v_guest_units int;
begin
  select id into v_property_id
  from properties
  where slug = 'pelbu-suites-olakha'
  limit 1;

  if v_property_id is null then
    raise notice 'pelbu-suites-olakha not found — skip room chart realign';
    return;
  end if;

  select id into v_dt from room_types
  where property_id = v_property_id and code = 'dt' and inventory_kind = 'sellable_guest'
  limit 1;
  select id into v_dq from room_types
  where property_id = v_property_id and code = 'dq' and inventory_kind = 'sellable_guest'
  limit 1;
  select id into v_sr from room_types
  where property_id = v_property_id and code = 'sr' and inventory_kind = 'sellable_guest'
  limit 1;

  if v_dt is null or v_dq is null or v_sr is null then
    raise notice 'Missing sellable room types dt/dq/sr — skip realign';
    return;
  end if;

  -- Already aligned (most labels are eZee room numbers) — never re-run destructive rename.
  select
    count(*) filter (where ru.label ~ '^[2-5][0-9]{2}$'),
    count(*)
  into v_digit_labels, v_guest_units
  from room_units ru
  join room_types rt on rt.id = ru.room_type_id
  where ru.property_id = v_property_id
    and rt.inventory_kind = 'sellable_guest';

  if v_guest_units > 0 and v_digit_labels >= greatest(20, (v_guest_units * 3) / 4) then
    raise notice 'Olakha room chart already eZee-aligned — skip realign';
    return;
  end if;

  -- Prefer re-homing existing sellable guest units only (do not touch D&G comps).
  -- Clear labels first (avoids unique collisions if label was unique per property).
  update room_units ru
  set label = 'tmp-' || ru.id::text
  from room_types rt
  where ru.room_type_id = rt.id
    and ru.property_id = v_property_id
    and rt.inventory_kind = 'sellable_guest';

  i := 0;
  for r in
    select ru.id
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
    where ru.property_id = v_property_id
      and rt.inventory_kind = 'sellable_guest'
    order by
      case when ru.room_type_id = v_dt then 0
           when ru.room_type_id = v_dq then 1
           when ru.room_type_id = v_sr then 2
           else 3 end,
      ru.sort_order,
      ru.label
  loop
    i := i + 1;
    if i <= array_length(v_twin, 1) then
      update room_units
      set room_type_id = v_dt,
          label = v_twin[i],
          floor_label = left(v_twin[i], 1),
          sort_order = i
      where id = r.id;
    elsif i <= array_length(v_twin, 1) + array_length(v_king, 1) then
      update room_units
      set room_type_id = v_dq,
          label = v_king[i - array_length(v_twin, 1)],
          floor_label = left(v_king[i - array_length(v_twin, 1)], 1),
          sort_order = i
      where id = r.id;
    elsif i = array_length(v_twin, 1) + array_length(v_king, 1) + 1 then
      update room_units
      set room_type_id = v_sr,
          label = v_suite,
          floor_label = left(v_suite, 1),
          sort_order = i
      where id = r.id;
    else
      -- Extra sellable units (if inventory grew): park as unnumbered double
      update room_units
      set room_type_id = v_dq,
          label = 'X' || (i - 27)::text,
          floor_label = null,
          sort_order = i
      where id = r.id;
    end if;
  end loop;

  -- Ensure count: if property has fewer than 27 guest units, insert missing.
  while (
    select count(*)
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
    where ru.property_id = v_property_id
      and rt.inventory_kind = 'sellable_guest'
  ) < 27
  loop
    insert into room_units (property_id, room_type_id, label, floor_label, hk_status, sort_order)
    values (
      v_property_id,
      v_dt,
      'tmp-new-' || gen_random_uuid()::text,
      null,
      'clean',
      999
    );
  end loop;

  -- Re-apply chart labels if we inserted new empties above
  i := 0;
  for r in
    select ru.id
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
    where ru.property_id = v_property_id
      and rt.inventory_kind = 'sellable_guest'
    order by
      case
        when ru.label ~ '^[2-5]0[1-7]$' then 0
        else 1
      end,
      ru.sort_order,
      ru.label
  loop
    i := i + 1;
    if i <= 22 then
      update room_units set room_type_id = v_dt, label = v_twin[i], floor_label = left(v_twin[i], 1), sort_order = i where id = r.id;
    elsif i <= 26 then
      update room_units set room_type_id = v_dq, label = v_king[i - 22], floor_label = left(v_king[i - 22], 1), sort_order = i where id = r.id;
    elsif i = 27 then
      update room_units set room_type_id = v_sr, label = v_suite, floor_label = left(v_suite, 1), sort_order = i where id = r.id;
    end if;
  end loop;

  update room_types set unit_count = 22 where id = v_dt;
  update room_types set unit_count = 4 where id = v_dq;
  update room_types set unit_count = 1 where id = v_sr;

  -- Help desk: King rooms display as King in type name without forcing code rename
  update room_types
  set name = 'King Room'
  where id = v_dq
    and name ilike '%queen%';
end $$;

-- Physical floor map for room units (POS-table pattern: percent canvas coords).
alter table public.room_units
  add column if not exists pos_x numeric(6,2)
    check (pos_x is null or (pos_x >= 0 and pos_x <= 100)),
  add column if not exists pos_y numeric(6,2)
    check (pos_y is null or (pos_y >= 0 and pos_y <= 100)),
  add column if not exists facade_side text
    check (
      facade_side is null
      or facade_side = any (array[
        'north'::text,
        'south'::text,
        'east'::text,
        'west'::text,
        'courtyard'::text,
        'internal'::text
      ])
    );

comment on column public.room_units.pos_x is
  'Floor-plan canvas X in percent (0–100), same model as dining_tables.pos_x.';
comment on column public.room_units.pos_y is
  'Floor-plan canvas Y in percent (0–100), same model as dining_tables.pos_y.';
comment on column public.room_units.facade_side is
  'Building face / wing for map coloring (north/south/east/west/courtyard/internal).';

-- Seed Olakha eZee physical numbers into a readable corridor layout per floor.
-- Y = floor band; X from unit numbers. Only fills rows still without coords.
do $$
declare
  v_property_id uuid;
  r record;
  v_floor int;
  v_num int;
  v_x numeric;
  v_y numeric;
  v_side text;
begin
  select id into v_property_id
  from properties
  where slug = 'pelbu-suites-olakha'
  limit 1;
  if v_property_id is null then
    return;
  end if;

  for r in
    select ru.id, ru.label, ru.floor_label, ru.view_label, ru.pos_x
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
    where ru.property_id = v_property_id
      and rt.inventory_kind = 'sellable_guest'
  loop
    if r.pos_x is not null then
      continue;
    end if;

    -- Prefer 3-digit eZee labels 2xx–5xx
    if r.label ~ '^[2-5][0-9]{2}$' then
      v_floor := left(r.label, 1)::int;
      v_num := right(r.label, 2)::int;
    elsif r.floor_label ~ '^[2-5]$' then
      v_floor := r.floor_label::int;
      v_num := 1;
    else
      continue;
    end if;

    -- Corridor: lower numbers on west (left), higher on east (right)
    v_x := least(92, greatest(6, 8 + (v_num - 1) * 11.5));
    -- Floors stacked bottom→top: floor 2 near bottom of canvas
    v_y := least(88, greatest(8, 92 - (v_floor - 1) * 18));

    if v_num <= 3 then
      v_side := 'west';
    elsif v_num >= 5 then
      v_side := 'east';
    else
      v_side := 'south';
    end if;

    -- Suite mid-floor: courtyard/internal cue
    if r.label = '502' then
      v_side := 'courtyard';
      v_x := 50;
    end if;

    update room_units
    set
      pos_x = v_x,
      pos_y = v_y,
      facade_side = coalesce(facade_side, v_side),
      floor_label = coalesce(nullif(floor_label, ''), v_floor::text),
      view_label = coalesce(
        nullif(view_label, ''),
        case v_side
          when 'west' then 'West face'
          when 'east' then 'East face'
          when 'south' then 'South face'
          when 'north' then 'North face'
          when 'courtyard' then 'Courtyard'
          else null
        end
      )
    where id = r.id;
  end loop;
end $$;

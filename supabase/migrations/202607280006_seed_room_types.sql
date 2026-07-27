-- Seed Pelbu room types (guest + guide/driver comps)
insert into room_types (property_id, code, name, inventory_kind)
select p.id, v.code, v.name, v.inventory_kind
from properties p
cross join (values
  ('deluxe','Deluxe Suite','sellable_guest'),
  ('superior','Superior Room','sellable_guest'),
  ('twin','Twin Room','sellable_guest'),
  ('guide','Guide bed (complimentary)','guide_comp'),
  ('driver','Driver bed (complimentary)','driver_comp')
) as v(code, name, inventory_kind)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from room_types r where r.property_id = p.id and r.code = v.code
);

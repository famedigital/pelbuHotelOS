-- Remap sellable guest room hero images onto high-resolution official photography.
update room_types
set image_public_id = case code
  when 'deluxe' then 'pelbu/seven-suites/official-img6149'
  when 'superior' then 'pelbu/seven-suites/official-img6194'
  when 'twin' then 'pelbu/seven-suites/official-img6256'
  when 'deluxe suite' then 'pelbu/seven-suites/official-dsc08154'
  else image_public_id
end
where property_id = (select id from properties where slug = 'pelbu-suites-olakha')
  and inventory_kind = 'sellable_guest';

-- Prefer official photography in the rooms gallery when legacy pelbu/rooms/* is present.
update cms_media
set public_id = case public_id
  when 'pelbu/rooms/deluxe' then 'pelbu/seven-suites/official-img6149'
  when 'pelbu/rooms/superior' then 'pelbu/seven-suites/official-img6194'
  when 'pelbu/rooms/twin' then 'pelbu/seven-suites/official-img6256'
  when 'pelbu/rooms/suite-view' then 'pelbu/seven-suites/official-room'
  when 'pelbu/rooms/deluxe-suite' then 'pelbu/seven-suites/official-dsc08154'
  when 'pelbu/rooms/superior-living' then 'pelbu/seven-suites/official-img6236'
  else public_id
end
where public_id like 'pelbu/rooms/%';

-- Link generated menu dish / product images for items that had null image_public_id.
-- Assets uploaded to Cloudinary under pelbu/menu/*.

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-milk-tea'
where name = 'Milk Tea' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-veg-fried-rice'
where name = 'Veg Fried Rice' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-ema-datsi'
where name = 'Ema datsi' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-chicken-chilli'
where name = 'Chicken chilli' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-roti'
where name = 'Roti' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/bar-old-monk'
where name = 'Old Monk' and outlet = 'bar' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/cafe-k5'
where name = 'K5' and outlet = 'cafe' and (image_public_id is null or image_public_id = '');

update public.menu_items set image_public_id = 'pelbu/menu/restaurant-mineral-water'
where name = 'Mineral water' and outlet = 'restaurant' and (image_public_id is null or image_public_id = '');

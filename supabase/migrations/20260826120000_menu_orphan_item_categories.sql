-- Map orphan singleton categories into existing multi-item sections.

update menu_items
set category = case name
  when 'Milk Tea' then 'Tea & specialty'
  when 'Veg Fried Rice' then 'Breads & rice'
  when 'Ema datsi' then 'Main course'
  when 'Chicken chilli' then 'Asian main course'
  when 'Roti' then 'Breads & rice'
  when 'Old Monk' then 'Classics'
  when 'Mineral water' then 'Cold drinks'
  else category
end
where name in (
  'Milk Tea',
  'Veg Fried Rice',
  'Ema datsi',
  'Chicken chilli',
  'Roti',
  'Old Monk',
  'Mineral water'
);

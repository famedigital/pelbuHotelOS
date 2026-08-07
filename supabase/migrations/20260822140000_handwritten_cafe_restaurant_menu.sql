-- Handwritten cafe + restaurant menu (notebook drafts Aug 2026)
-- Prices are menu base BTN as written; "++" → gst_applicable = true (desk / web show +GST).
-- Images: generated offline (Cursor image model) then uploaded to Cloudinary under pelbu/menu/*.

insert into menu_items (
  property_id,
  outlet,
  category,
  name,
  description,
  price_btn,
  gst_applicable,
  sort_order,
  image_public_id,
  is_available,
  is_popular,
  prep_station
)
select
  p.id,
  v.outlet,
  v.category,
  v.name,
  v.description,
  v.price_btn,
  true,
  v.sort_order,
  v.image_public_id,
  true,
  v.is_popular,
  v.prep_station
from properties p
cross join (
  values
  -- Cafe food menu
  ('cafe'::text, 'Cafe snacks'::text, 'Crispy chilli potato'::text, 'Crispy potato tossed with chilli'::text, 200::numeric, 100, 'pelbu/menu/cafe-crispy-chilli-potato'::text, true, 'kitchen'::text),
  ('cafe', 'Cafe snacks', 'French fries', 'Classic golden fries', 180, 110, 'pelbu/menu/cafe-french-fries', false, 'kitchen'),
  ('cafe', 'Cafe snacks', 'Salted cashewnut', 'Lightly salted cashews', 250, 120, 'pelbu/menu/cafe-salted-nuts', false, 'cold'),
  ('cafe', 'Cafe snacks', 'Salted almond', 'Lightly salted almonds', 250, 130, 'pelbu/menu/cafe-salted-nuts', false, 'cold'),
  ('cafe', 'Cafe snacks', 'Peanut masala', 'Spiced roasted peanuts', 200, 140, 'pelbu/menu/cafe-salted-nuts', false, 'cold'),
  ('cafe', 'Cafe snacks', 'Onion fritters', '6–7 pieces', 200, 150, 'pelbu/menu/cafe-onion-fritters', false, 'kitchen'),
  ('cafe', 'Cafe snacks', 'Chilli cheese nuggets', 'Crispy cheese & chilli nuggets', 250, 160, 'pelbu/menu/cafe-chilli-cheese-nuggets', true, 'kitchen'),
  ('cafe', 'Cafe snacks', 'Chicken lollipop', 'Spicy chicken lollipops', 300, 170, 'pelbu/menu/cafe-chicken-lollipop', true, 'kitchen'),
  ('cafe', 'Cafe snacks', 'Fried chicken', 'Drumstick, wings or breast', 300, 180, 'pelbu/menu/cafe-fried-chicken', true, 'kitchen'),
  ('cafe', 'Burgers', 'Beef burger', 'House beef burger', 350, 200, 'pelbu/menu/cafe-beef-burger', true, 'grill'),
  ('cafe', 'Burgers', 'Chicken burger', 'House chicken burger', 300, 210, 'pelbu/menu/cafe-chicken-burger', true, 'grill'),
  ('cafe', 'Burgers', 'Potato burger', 'Crispy potato burger', 300, 220, 'pelbu/menu/cafe-potato-burger', false, 'grill'),
  ('cafe', 'Sandwiches', 'Veg sandwich', 'Fresh vegetable sandwich', 200, 300, 'pelbu/menu/cafe-veg-sandwich', false, 'cold'),
  ('cafe', 'Sandwiches', 'Hotdog', 'House hotdog', 250, 310, 'pelbu/menu/cafe-hotdog', false, 'grill'),
  ('cafe', 'Sandwiches', 'Club sandwich', 'Classic club stack', 300, 320, 'pelbu/menu/cafe-olakha-club-sandwich', true, 'kitchen'),
  ('cafe', 'Sandwiches', 'Tuna sandwich', 'Tuna sandwich', 300, 330, 'pelbu/menu/cafe-tuna-sandwich', false, 'cold'),
  -- Restaurant soup
  ('restaurant', 'Soup', 'Lentil soup', null::text, 140, 400, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'Pumpkin soup', null, 140, 410, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'Italian soup', null, 150, 420, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'Potato leek soup', null, 140, 430, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'Minestrone soup', null, 160, 440, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'French onion soup', null, 140, 450, 'pelbu/menu/restaurant-french-onion-soup', true, 'kitchen'),
  ('restaurant', 'Soup', 'Mint and green peas soup', 'Season time', 160, 460, 'pelbu/menu/restaurant-soup-bowl', false, 'kitchen'),
  ('restaurant', 'Soup', 'Tom yum soup', 'Pre-order', 180, 470, 'pelbu/menu/restaurant-tom-yum', true, 'kitchen'),
  ('restaurant', 'Soup', 'Winter special Schezwan soup (chicken)', 'Pre-order · chicken', 200, 480, 'pelbu/menu/restaurant-szechuan-soup', false, 'kitchen'),
  -- Restaurant salad
  ('restaurant', 'Salad', 'Garden salad', null, 180, 500, 'pelbu/menu/restaurant-garden-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Greek salad', null, 180, 510, 'pelbu/menu/restaurant-greek-salad', true, 'cold'),
  ('restaurant', 'Salad', 'Chopped salad', null, 180, 520, 'pelbu/menu/restaurant-garden-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Waldorf salad', null, 200, 530, 'pelbu/menu/restaurant-waldorf-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Glass noodle salad', null, 180, 540, 'pelbu/menu/restaurant-glass-noodle-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Compound salad with lemon vinaigrette', null, 180, 550, 'pelbu/menu/restaurant-garden-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Red wine vinaigrette dressing salad', null, 180, 560, 'pelbu/menu/restaurant-garden-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Kimchi salad (Korean)', null, 180, 570, 'pelbu/menu/restaurant-kimchi-salad', false, 'cold'),
  ('restaurant', 'Salad', 'Russian salad', 'Pre-order', 180, 580, 'pelbu/menu/restaurant-russian-salad', false, 'cold'),
  -- Restaurant main course
  ('restaurant', 'Main course', 'Roasted potato', null, 180, 600, 'pelbu/menu/restaurant-roasted-veg', false, 'kitchen'),
  ('restaurant', 'Main course', 'Roasted eggplant', 'Chef special', 200, 610, 'pelbu/menu/restaurant-roasted-eggplant', true, 'kitchen'),
  ('restaurant', 'Main course', 'Skillet zucchini and mushroom', 'Season time', 220, 620, 'pelbu/menu/restaurant-skillet-veg', false, 'kitchen'),
  ('restaurant', 'Main course', 'Asparagus garlic butter fry', 'Season time', 250, 630, 'pelbu/menu/restaurant-asparagus', false, 'kitchen'),
  ('restaurant', 'Main course', 'Mixed veg medley', 'Pre-order', 220, 640, 'pelbu/menu/restaurant-mixed-veg', false, 'kitchen'),
  ('restaurant', 'Main course', 'Mixed veg creamy', null, 220, 650, 'pelbu/menu/restaurant-mixed-veg-creamy', false, 'kitchen'),
  ('restaurant', 'Main course', 'Grilled chicken or pork', 'Pre-order · choose chicken or pork', 450, 660, 'pelbu/menu/restaurant-grilled-protein', true, 'grill'),
  ('restaurant', 'Main course', 'Chicken schnitzel', null, 450, 670, 'pelbu/menu/restaurant-chicken-schnitzel', true, 'kitchen'),
  ('restaurant', 'Main course', 'Braised chicken with wine and mushroom sauce', null, 450, 680, 'pelbu/menu/restaurant-braised-chicken', true, 'kitchen'),
  ('restaurant', 'Main course', 'Chicken breast', null, 400, 690, 'pelbu/menu/restaurant-chicken-breast', false, 'grill'),
  ('restaurant', 'Main course', 'Chicken, pork or beef stew', 'Choose protein', 400, 700, 'pelbu/menu/restaurant-meat-stew', false, 'kitchen'),
  ('restaurant', 'Main course', 'Cowboy beef stew', 'Pre-order', 450, 710, 'pelbu/menu/restaurant-cowboy-stew', true, 'kitchen'),
  ('restaurant', 'Main course', 'Sesame chicken', null, 400, 720, 'pelbu/menu/restaurant-sesame-chicken', false, 'kitchen'),
  ('restaurant', 'Main course', 'Pork chops Italian', 'Pre-order', 450, 730, 'pelbu/menu/restaurant-pork-chops', false, 'grill'),
  ('restaurant', 'Main course', 'Ants climbing tree', 'Beef, pork or chicken', 400, 740, 'pelbu/menu/restaurant-ants-climbing', false, 'kitchen'),
  ('restaurant', 'Main course', 'Greek sweet and sour pork or chicken', 'Choose protein', 400, 750, 'pelbu/menu/restaurant-sweet-sour', false, 'kitchen'),
  ('restaurant', 'Main course', 'Sweet and sour pork or chicken', 'Choose protein', 400, 760, 'pelbu/menu/restaurant-sweet-sour', false, 'kitchen'),
  ('restaurant', 'Main course', 'Roasted chicken or pork', 'Chef special · dry or gravy', 450, 770, 'pelbu/menu/restaurant-roasted-protein', true, 'kitchen'),
  ('restaurant', 'Main course', 'Braised pork belly with egg', 'Pre-order', 450, 780, 'pelbu/menu/restaurant-pork-belly', true, 'kitchen'),
  ('restaurant', 'Main course', 'Steamed fish', 'Normal size · pre-order', 700, 790, 'pelbu/menu/restaurant-steamed-fish', true, 'kitchen'),
  ('restaurant', 'Main course', 'Fish fillet with red wine', null, 300, 800, 'pelbu/menu/restaurant-fish-red-wine', false, 'kitchen'),
  -- Restaurant Asian main course
  ('restaurant', 'Asian main course', 'Mixed veg tempura', null, 200, 900, 'pelbu/menu/restaurant-veg-tempura', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Eggplant tempura', null, 180, 910, 'pelbu/menu/restaurant-veg-tempura', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Spring veg stir fry', null, 200, 920, 'pelbu/menu/restaurant-stir-fry-veg', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Shanghai steam veg', 'Season time', 200, 930, 'pelbu/menu/restaurant-steam-veg', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Baguio beans', null, 220, 940, 'pelbu/menu/restaurant-stir-fry-veg', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Stir fry cauliflower', null, 220, 950, 'pelbu/menu/restaurant-stir-fry-veg', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Stir fry cabbage with egg', null, 280, 960, 'pelbu/menu/restaurant-stir-fry-veg', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Stir fry asparagus with mushroom', 'Season time', 270, 970, 'pelbu/menu/restaurant-asparagus', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Three treasures', 'Chef special', 250, 980, 'pelbu/menu/restaurant-three-treasures', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Kung pao chicken', null, 400, 990, 'pelbu/menu/restaurant-kung-pao', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Thai curry chicken, pork or beef', 'Green or red · choose protein', 450, 1000, 'pelbu/menu/restaurant-thai-curry', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Stir fried beef with green chilli', null, 450, 1010, 'pelbu/menu/restaurant-beef-chilli', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Stir fried chicken, pork or beef with green pepper', 'Choose protein', 480, 1020, 'pelbu/menu/restaurant-pepper-stir-fry', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Chicken or pork oyster sauce', 'Choose protein', 400, 1030, 'pelbu/menu/restaurant-oyster-sauce', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Tonkatsu chicken or pork', 'Choose protein', 450, 1040, 'pelbu/menu/restaurant-tonkatsu', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Teriyaki chicken or pork', 'Choose protein', 400, 1050, 'pelbu/menu/restaurant-teriyaki', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Nikujaga', 'Japanese meat & potato stew', 400, 1060, 'pelbu/menu/restaurant-nikujaga', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Omurice', 'Omelette rice', 400, 1070, 'pelbu/menu/restaurant-omurice', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Gyudon', 'Japanese beef and rice', 450, 1080, 'pelbu/menu/restaurant-gyudon', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Katsu don', 'Japanese chicken and rice bowl', 450, 1090, 'pelbu/menu/restaurant-katsu-don', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Tsukune', 'Japanese chicken meatballs', 450, 1100, 'pelbu/menu/restaurant-tsukune', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Chilli chicken, pork, beef or fish', 'Choose protein', 400, 1110, 'pelbu/menu/restaurant-chilli-protein', false, 'kitchen'),
  ('restaurant', 'Asian main course', 'Sweet and sour whole fish', 'Chef special · whole fish', 750, 1120, 'pelbu/menu/restaurant-sweet-sour-fish', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Prawn tempura', null, 600, 1130, 'pelbu/menu/restaurant-prawn-tempura', true, 'kitchen'),
  ('restaurant', 'Asian main course', 'Ramen', null, 200, 1140, 'pelbu/menu/restaurant-ramen', true, 'kitchen')
) as v(
  outlet,
  category,
  name,
  description,
  price_btn,
  sort_order,
  image_public_id,
  is_popular,
  prep_station
)
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1
    from menu_items m
    where m.property_id = p.id
      and m.outlet = v.outlet
      and m.name = v.name
  );

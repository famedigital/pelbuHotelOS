-- Remap F&B menu + gallery public_ids that were never uploaded to Cloudinary
-- onto known-good assets already on the CDN (cafe dishes + brand photography).
-- Without this, /restaurant, /cafe, /menu?outlet=pastry and the outlet galleries
-- render broken image URLs.

update menu_items
set image_public_id = case image_public_id
  -- Restaurant dishes → closest existing cafe / brand photography
  when 'pelbu/menu/restaurant-butter-chicken-naan'
    then 'pelbu/menu/cafe-grilled-chicken-plate'
  when 'pelbu/menu/restaurant-chicken-thukpa'
    then 'pelbu/menu/cafe-thukpa-cup'
  when 'pelbu/menu/restaurant-mutton-curry-thali'
    then 'pelbu/restaurant/signature-plate'
  when 'pelbu/menu/restaurant-paneer-lababdar'
    then 'pelbu/menu/cafe-ema-datshi-rice-bowl'
  when 'pelbu/menu/restaurant-paratha-platter'
    then 'pelbu/menu/cafe-egg-cheese-paratha'
  when 'pelbu/menu/restaurant-red-rice-ema-datshi'
    then 'pelbu/menu/cafe-ema-datshi-rice-bowl'
  when 'pelbu/menu/restaurant-river-trout'
    then 'pelbu/restaurant/signature-plate'
  when 'pelbu/menu/restaurant-shakam-ema-datshi'
    then 'pelbu/menu/cafe-ema-datshi-rice-bowl'
  -- Pastry dishes → cafe bakery / brand photography
  when 'pelbu/menu/pastry-apple-crumble-slice'
    then 'pelbu/cafe/morning-pastry'
  when 'pelbu/menu/pastry-butter-croissant'
    then 'pelbu/cafe/morning-pastry'
  when 'pelbu/menu/pastry-cardamom-bun'
    then 'pelbu/menu/cafe-suja-khabzay'
  when 'pelbu/menu/pastry-dark-chocolate-brownie'
    then 'pelbu/restaurant/signature-plate'
  else image_public_id
end
where image_public_id in (
  'pelbu/menu/restaurant-butter-chicken-naan',
  'pelbu/menu/restaurant-chicken-thukpa',
  'pelbu/menu/restaurant-mutton-curry-thali',
  'pelbu/menu/restaurant-paneer-lababdar',
  'pelbu/menu/restaurant-paratha-platter',
  'pelbu/menu/restaurant-red-rice-ema-datshi',
  'pelbu/menu/restaurant-river-trout',
  'pelbu/menu/restaurant-shakam-ema-datshi',
  'pelbu/menu/pastry-apple-crumble-slice',
  'pelbu/menu/pastry-butter-croissant',
  'pelbu/menu/pastry-cardamom-bun',
  'pelbu/menu/pastry-dark-chocolate-brownie'
);

update cms_media
set public_id = case public_id
  when 'pelbu/menu/restaurant-butter-chicken-naan'
    then 'pelbu/menu/cafe-grilled-chicken-plate'
  when 'pelbu/menu/restaurant-river-trout'
    then 'pelbu/restaurant/signature-plate'
  when 'pelbu/menu/restaurant-red-rice-ema-datshi'
    then 'pelbu/menu/cafe-ema-datshi-rice-bowl'
  when 'pelbu/menu/pastry-butter-croissant'
    then 'pelbu/cafe/morning-pastry'
  when 'pelbu/menu/pastry-cardamom-bun'
    then 'pelbu/menu/cafe-suja-khabzay'
  else public_id
end
where public_id in (
  'pelbu/menu/restaurant-butter-chicken-naan',
  'pelbu/menu/restaurant-river-trout',
  'pelbu/menu/restaurant-red-rice-ema-datshi',
  'pelbu/menu/pastry-butter-croissant',
  'pelbu/menu/pastry-cardamom-bun'
);

-- Cafe CMS still pointed at legacy /order and /dine redirects.
update cms_pages
set
  primary_cta_href = '/menu?outlet=cafe',
  secondary_cta_href = '/menu',
  secondary_cta_label = 'Full menu',
  updated_at = now()
where slug = 'cafe'
  and (
    primary_cta_href = '/order'
    or secondary_cta_href = '/dine'
  );

-- Restaurant primary CTA had drifted to the old /order path in some seeds.
update cms_pages
set
  primary_cta_href = '/menu?outlet=restaurant',
  primary_cta_label = coalesce(nullif(primary_cta_label, ''), 'Browse restaurant menu'),
  updated_at = now()
where slug = 'restaurant'
  and (primary_cta_href is null or primary_cta_href = '/order');

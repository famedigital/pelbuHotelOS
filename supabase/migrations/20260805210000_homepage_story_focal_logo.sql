-- Homepage story CMS, media focal points, hero_mobile kind, logo horizontal shift.

-- 1) Logo horizontal shift (rem)
alter table public.properties
  add column if not exists logo_nav_shift_x_rem numeric(4, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'properties_logo_nav_shift_x_rem_check'
  ) then
    alter table public.properties
      add constraint properties_logo_nav_shift_x_rem_check
      check (logo_nav_shift_x_rem >= -1.5 and logo_nav_shift_x_rem <= 3);
  end if;
end $$;

comment on column public.properties.logo_nav_shift_x_rem is
  'Public header logo horizontal nudge in rem (negative left, positive right).';

-- 2) CMS media focal + hero_mobile
alter table public.cms_media
  add column if not exists focal_x numeric(5, 4) not null default 0.5,
  add column if not exists focal_y numeric(5, 4) not null default 0.5;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_media_focal_x_check'
  ) then
    alter table public.cms_media
      add constraint cms_media_focal_x_check
      check (focal_x >= 0 and focal_x <= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_media_focal_y_check'
  ) then
    alter table public.cms_media
      add constraint cms_media_focal_y_check
      check (focal_y >= 0 and focal_y <= 1);
  end if;
end $$;

comment on column public.cms_media.focal_x is
  'Crop anchor 0-1 (left-right) for Cloudinary fill gravity.';
comment on column public.cms_media.focal_y is
  'Crop anchor 0-1 (top-bottom) for Cloudinary fill gravity.';

-- Expand kind check to include hero_mobile
alter table public.cms_media drop constraint if exists cms_media_kind_check;
alter table public.cms_media
  add constraint cms_media_kind_check
  check (kind = any (array[
    'hero'::text,
    'hero_mobile'::text,
    'gallery'::text,
    'thumb'::text
  ]));

-- 3) Seed homepage.story site setting
insert into public.cms_site_settings (property_id, key, content)
select
  p.id,
  'homepage.story',
  jsonb_build_object(
    'about', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'The name',
      'title', 'Pelbu - one of the eight lucky signs',
      'body', 'Pelbu is one of Bhutan''s eight auspicious symbols (lucky signs). We rebranded from Seven Suites to Pelbu Suites so the hotel carries that blessing into every stay in Olakha - new management, same welcome.',
      'public_id', 'pelbu/hotel/exterior',
      'gallery_public_ids', jsonb_build_array(),
      'primary_href', '/contact',
      'primary_label', 'About & contact',
      'secondary_href', '/rooms',
      'secondary_label', 'Check rooms',
      'accent', 'citrus',
      'focal_x', 0.5,
      'focal_y', 0.45
    ),
    'rooms', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'Rooms',
      'title', 'Suites built for the Thimphu road',
      'body', 'Quiet rooms in Olakha with live availability and direct rack rates. Guide and driver beds are complimentary on agent groups.',
      'public_id', 'pelbu/rooms/deluxe',
      'gallery_public_ids', jsonb_build_array(),
      'primary_href', '/rooms',
      'primary_label', 'All rooms',
      'secondary_href', '/book',
      'secondary_label', 'Book dates',
      'accent', 'sky',
      'focal_x', 0.5,
      'focal_y', 0.5
    ),
    'restaurant', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'In-house restaurant',
      'title', 'Kitchen led by two seasoned chefs',
      'body', 'Chief chef Jigme Chaeda - 15 years as a chef - alongside a seasoned Indian chef. Indian, Bhutanese and multicuisine for regional and international guests. The dining room seats up to 50.',
      'public_id', 'pelbu/restaurant/uuy1ycprinlbhm7lvkli',
      'gallery_public_ids', jsonb_build_array(
        'pelbu/restaurant/dining-room',
        'pelbu/restaurant/signature-plate'
      ),
      'primary_href', '/restaurant',
      'primary_label', 'Restaurant',
      'secondary_href', '/menu?outlet=restaurant',
      'secondary_label', 'Full menu',
      'accent', 'espresso',
      'focal_x', 0.5,
      'focal_y', 0.4
    ),
    'lunch', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'Day visitors welcome',
      'title', 'Lunch package for tourists',
      'body', 'Perfect for tour groups even if they are not staying with us. Capacity up to 50 guests - please schedule in advance.',
      'public_id', 'pelbu/restaurant/dining-room',
      'gallery_public_ids', jsonb_build_array(),
      'primary_href', '/contact',
      'primary_label', 'Schedule lunch',
      'secondary_href', '/restaurant',
      'secondary_label', 'Restaurant details',
      'accent', 'citrus',
      'amount_btn', 400,
      'amount_note', 'Inclusive of taxes · lunch package',
      'focal_x', 0.5,
      'focal_y', 0.5
    ),
    'cafe', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'New on property',
      'title', 'PELBU ZONE',
      'body', 'Our all-day cafe - where Thimphu mornings meet Filipino-inspired flavours, craft coffee, and oven-fresh pastry. Perfect pit-stop for guests, guides, and friends of the house.',
      'public_id', 'pelbu/cafe/v7d8ba1cszstrkfosyax',
      'gallery_public_ids', jsonb_build_array(
        'pelbu/menu/cafe-suja-khabzay',
        'pelbu/menu/cafe-olakha-club-sandwich',
        'pelbu/menu/cafe-himalayan-oats-bowl',
        'pelbu/menu/cafe-egg-cheese-paratha'
      ),
      'primary_href', '/cafe',
      'primary_label', 'Cafe',
      'secondary_href', '/menu',
      'secondary_label', 'Order online',
      'accent', 'mint',
      'focal_x', 0.5,
      'focal_y', 0.45
    ),
    'spa', jsonb_build_object(
      'enabled', true,
      'eyebrow', 'Wellness on site',
      'title', 'Spa & Steam',
      'body', 'Unwind after a day of sightseeing with a warming steam experience. The jacuzzi is exclusive to our one Suite room only - not available with Double or Twin.',
      'public_id', 'pelbu/marketing/agent-email-steam',
      'gallery_public_ids', jsonb_build_array(
        'pelbu/spa/steam',
        'pelbu/spa/jacuzzi'
      ),
      'primary_href', '/spa',
      'primary_label', 'Spa & steam',
      'secondary_href', '/rooms',
      'secondary_label', 'Suite room',
      'accent', 'spa',
      'focal_x', 0.5,
      'focal_y', 0.4
    )
  )
from public.properties p
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, key) do update
  set content = excluded.content,
      revision = public.cms_site_settings.revision + 1,
      updated_at = now();

insert into public.cms_site_setting_drafts (
  setting_id,
  property_id,
  content,
  base_revision
)
select s.id, s.property_id, s.content, s.revision
from public.cms_site_settings s
where s.key = 'homepage.story'
on conflict (setting_id) do update
  set content = excluded.content,
      base_revision = excluded.base_revision,
      updated_at = now();

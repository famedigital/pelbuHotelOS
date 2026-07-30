-- Seed former Seven Suites website copy into the Pelbu public CMS.
-- Ownership and brand name changed; marketing copy is adapted under Pelbu.
-- Operational rates and contacts stay in room_rates / properties.

with prop as (
  select id from public.properties where slug = 'pelbu-suites-olakha'
), source(slug, eyebrow, title, body, sections_json, seo_title, meta_description, canonical_path, summary, primary_href, primary_label, secondary_href, secondary_label) as (
  values
    (
      'home',
      'Olakha · Thimphu · Bhutan',
      'Stay close to the city. Come home to calm.',
      'Pelbu Suites is a peaceful base in Thimphu with comfortable rooms, dining, a cafe and bar, spa and steam facilities, and meeting space under one roof.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'About Pelbu Suites',
          'paragraphs', jsonb_build_array(
            'Pelbu Suites is a comfortable hotel in Thimphu, the capital city of Bhutan. It is a practical destination for travellers seeking a peaceful and relaxing stay in a serene environment, with a spa, steam bath, cafe and bar, restaurant, and comfortable rooms in one property.',
            'The spa is a place to slow down and recover. Guests can ask the desk about available massages, facials, body treatments, and other sessions designed to soothe and refresh the mind and body.',
            'The steam bath offers a warm, comfortable setting for relaxation. Ask the desk about the facilities and available session times during your stay.',
            'The cafe and bar serve drinks and snacks in a relaxed setting, while the restaurant brings together local and international dishes prepared with fresh ingredients.',
            'Guest rooms are spacious and well appointed, with modern essentials such as television, Wi-Fi, and private bathrooms, balanced with Bhutanese-inspired details.'
          ),
          'items', '[]'::jsonb
        ),
        jsonb_build_object(
          'heading', 'Relax at the hotel',
          'paragraphs', jsonb_build_array(
            'Take a break from the pace of everyday life. Pelbu Suites brings restful rooms, a calm atmosphere, attentive service, dining, and restorative facilities together for an easy Thimphu stay.',
            'Pamper yourself at the spa, enjoy a meal at the restaurant, meet over coffee, or simply settle into a comfortable room. Book your stay and let the team take care of the practical details.'
          ),
          'items', '[]'::jsonb
        ),
        jsonb_build_object(
          'heading', 'Hotel facilities',
          'paragraphs', jsonb_build_array(
            'Facilities are designed around comfort, useful service, and an uncomplicated stay. Availability can vary, so contact the desk before travelling when a particular facility is essential.'
          ),
          'items', jsonb_build_array(
            'Spa and steam bath',
            'Spacious parking',
            'In-room minibar',
            'Board room and meeting space',
            'Car hire assistance',
            'Guest laundry',
            'Money exchange assistance',
            'High-speed Wi-Fi',
            'Doctor on call on request',
            'Multi-cuisine restaurant',
            'Business services',
            'Daily housekeeping'
          )
        )
      ),
      'Pelbu Suites Olakha | Hotel in Thimphu',
      'Pelbu Suites in Olakha, Thimphu offers comfortable rooms, a restaurant, cafe and bar, spa and steam, meeting space, and practical hotel services.',
      '/',
      'A peaceful Thimphu hotel bringing rooms, food, recovery, and useful gathering space together in Olakha.',
      '/book',
      'Check rooms & rates',
      '/menu',
      'Order food online'
    ),
    (
      'contact',
      'About & contact',
      'A peaceful hotel base in Thimphu.',
      'Pelbu Suites offers comfortable accommodation and practical hospitality in Olakha, with rooms, dining, a cafe and bar, spa and steam facilities, and meeting space under one roof.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Our story',
          'paragraphs', jsonb_build_array(
            'Formerly known as Seven Suites, the hotel is now Pelbu Suites. The new name carries the property forward while keeping the comfortable rooms, welcoming spaces, and useful services guests know.',
            'Our aim is simple: give business travellers, holidaymakers, couples, groups, and Bhutan travel partners a calm and dependable base in Thimphu.',
            'The restaurant serves local and international dishes, the cafe and bar offer an easy place to meet, and the spa and steam facilities give guests space to recover after the road or a long day.'
          ),
          'items', '[]'::jsonb
        )
      ),
      'About & Contact | Pelbu Suites',
      'Learn about Pelbu Suites, formerly Seven Suites, and contact the hotel desk in Olakha, Thimphu.',
      '/contact',
      'Pelbu Suites is the new name of the former Seven Suites hotel in Thimphu.',
      '/book',
      'Check rooms',
      '/menu',
      'See the menu'
    ),
    (
      'rooms',
      'Rooms',
      'Comfort, space, and a quiet night in Thimphu.',
      'Our rooms combine generous space, comfortable bedding, useful work areas, modern bathrooms, and the everyday amenities needed for business or leisure stays.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Designed for a comfortable stay',
          'paragraphs', jsonb_build_array(
            'Step into a modern, well-lit room with large windows, comfortable seating, and quality finishes. Room views vary between the city and surrounding landscape.',
            'Beds are prepared with supportive mattresses, fresh linen, and comfortable pillows for a restful night. Seating and work areas make it easy to unwind or catch up on the day.',
            'Private bathrooms include hot water, an enclosed rain shower, towels, and practical toiletries. Storage includes a closet, drawers, and space for luggage.'
          ),
          'items', '[]'::jsonb
        ),
        jsonb_build_object(
          'heading', 'Room amenities',
          'paragraphs', jsonb_build_array(
            'Amenities vary by room category. Confirm any essential requirement with the desk before booking.'
          ),
          'items', jsonb_build_array(
            'High-speed Wi-Fi and LAN connection',
            'Temperature control',
            'Pocket-spring mattress with memory-foam comforter',
            'Microgel pillows, extra blanket, and pillows on request',
            'In-room safe',
            'Slippers and cotton bathrobe',
            'Rain shower and 24-hour hot water',
            'Hair dryer and cosmetic mirror',
            'Tea and coffee facilities',
            '43-inch television',
            'USB charger and bedside reading lamp',
            'Intercom and wake-up call',
            'Writing desk, chair, armchair, and coffee table',
            'Closet and luggage storage',
            'Emergency torch'
          )
        ),
        jsonb_build_object(
          'heading', 'Room categories',
          'paragraphs', jsonb_build_array(
            'Choose from comfortable rooms for solo travellers and couples, twin-ready rooms for colleagues or friends, and spacious suites with separate seating. Current room names, live availability, and rates are shown in the booking engine.'
          ),
          'items', jsonb_build_array('Deluxe room', 'Deluxe double or king room', 'Twin room', 'Suite')
        )
      ),
      'Rooms at Pelbu Suites | Thimphu',
      'Spacious rooms and suites at Pelbu Suites in Olakha, Thimphu, with modern amenities, comfortable bedding, Wi-Fi, and private bathrooms.',
      '/rooms',
      'Comfortable rooms and suites for business and leisure stays in Thimphu.',
      '/book',
      'Check live rates',
      '/contact',
      'Ask the desk'
    ),
    (
      'restaurant',
      'Restaurant',
      'Fresh ingredients, generous plates, and a warm table.',
      'Our restaurant brings people together over Bhutanese, Indian, and international dishes prepared with care in a relaxed dining room.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Pelbu Suites Restaurant',
          'paragraphs', jsonb_build_array(
            'Our menu is inspired by fresh ingredients and familiar flavours, with dishes designed to be satisfying, colourful, and well presented.',
            'From starters through main courses and desserts, the menu includes meat, seafood, and vegetarian choices for different tastes.',
            'We work with quality ingredients and local suppliers wherever practical. Ask the team for current recommendations and available specials.',
            'The dining room is warm and welcoming, whether you are planning dinner for two, a family meal, or an easy evening with friends and colleagues.'
          ),
          'items', '[]'::jsonb
        ),
        jsonb_build_object(
          'heading', 'Restaurant dining',
          'paragraphs', jsonb_build_array(
            'Join us for a relaxed hotel dining experience, from the inviting room to food prepared with attention to taste, aroma, consistency, and time.',
            'Breakfast, lunch, and dinner availability follows the current service schedule shown by the hotel. Browse the live menu for dishes and prices.'
          ),
          'items', '[]'::jsonb
        )
      ),
      'Restaurant | Pelbu Suites',
      'Bhutanese, Indian, and international dining at Pelbu Suites in Olakha, Thimphu.',
      '/restaurant',
      'A warm hotel restaurant for breakfast, lunch, dinner, and time together.',
      '/menu?outlet=restaurant',
      'Browse restaurant menu',
      '/contact',
      'Ask about a table'
    ),
    (
      'bar',
      'Cafe & bar',
      'A comfortable place to meet, pause, and unwind.',
      'Settle into a relaxed cafe and bar with coffee, drinks, snacks, and comfortable seating for guests, neighbours, friends, and colleagues.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Pelbu Cafe & Bar',
          'paragraphs', jsonb_build_array(
            'Our cafe and bar balance a relaxed atmosphere with a polished setting — an easy place to unwind after travel, work, or a day in Thimphu.',
            'Choose from the drinks currently listed by the hotel, including coffee, soft drinks, and available bar selections. The team can help with recommendations.',
            'Small plates and snacks are available from the current menu and are well suited to sharing.',
            'Friendly service and comfortable seating make the space useful for an informal meeting, an evening with friends, or a quiet drink.'
          ),
          'items', '[]'::jsonb
        )
      ),
      'Cafe & Bar | Pelbu Suites',
      'Coffee, drinks, snacks, and a relaxed cafe and bar at Pelbu Suites in Olakha, Thimphu.',
      '/bar',
      'A relaxed cafe and bar for hotel guests and the neighbourhood.',
      '/menu',
      'Browse the menu',
      '/contact',
      'Ask the desk'
    ),
    (
      'meeting',
      'Board room & meetings',
      'A professional room for useful work.',
      'Host board discussions, workshops, briefings, and small conferences with practical layouts, connectivity, audiovisual support, and catering on request.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Plan your meeting',
          'paragraphs', jsonb_build_array(
            'Our meeting space combines comfortable seating and modern facilities for conferences, workshops, and team sessions. Share your date, group size, layout, and technology needs so the team can prepare the room.',
            'High-speed internet, audiovisual equipment, and flexible seating can be arranged according to the confirmed package. Event staff and catering support are available on request.',
            'From an intimate board discussion to a larger working session, the team will help coordinate the practical details from arrival to the final break.'
          ),
          'items', jsonb_build_array(
            'Flexible seating layouts',
            'High-speed internet',
            'Audiovisual equipment on request',
            'Cafe and meal catering',
            'Delegate rooms at the hotel',
            'Event coordination'
          )
        )
      ),
      'Meeting & Board Room | Pelbu Suites',
      'Meeting and board room space at Pelbu Suites in Thimphu with flexible seating, internet, audiovisual support, and catering on request.',
      '/meeting',
      'A practical Thimphu meeting venue with rooms and catering under one roof.',
      '/contact',
      'Plan an event',
      '/book',
      'Rooms for delegates'
    ),
    (
      'spa',
      'Spa & steam',
      'Slow down, recover, and leave refreshed.',
      'Ask the desk about available spa treatments, steam sessions, and restorative facilities for hotel guests and day visitors.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Spa and steam bath',
          'paragraphs', jsonb_build_array(
            'Take time to unwind with the spa treatments currently available at Pelbu Suites. The team can confirm massages, facials, body treatments, therapist availability, and session times.',
            'The steam bath uses warm, moist heat to create a deeply relaxing environment. Ask about session guidance and available aromatherapy options.',
            'Additional recovery facilities may be available alongside the steam room. Confirm sauna, Jacuzzi, lounge, and package availability with the desk before your visit.',
            'Choose a focused session or ask the team to combine available treatments into a longer recovery experience.'
          ),
          'items', '[]'::jsonb
        )
      ),
      'Spa & Steam Bath | Pelbu Suites',
      'Spa treatments and steam sessions at Pelbu Suites in Olakha, Thimphu. Contact the desk to confirm facilities and availability.',
      '/spa',
      'Restorative spa and steam experiences in Olakha, Thimphu.',
      '/contact',
      'Ask about availability',
      '/book',
      'Add a stay'
    ),
    (
      'services',
      'Hotel services',
      'The useful parts of a Thimphu stay, together.',
      'From a welcoming lobby to rooms, food, recovery, meeting space, and practical guest assistance, Pelbu Suites is designed to make a visit comfortable and uncomplicated.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Everything under one roof',
          'paragraphs', jsonb_build_array(
            'The lobby offers comfortable seating, Wi-Fi, and a team ready to help with your stay.',
            'The restaurant serves freshly prepared meals, the cafe is an easy stop for coffee or a quick bite, and the bar provides a relaxed place to unwind.',
            'Business travellers can ask about meeting space and practical services, while the spa and steam facilities offer room to recover.',
            'Every guest is welcomed with care and attention. Contact the desk to confirm any service that matters to your visit.'
          ),
          'items', jsonb_build_array(
            'Rooms and suites',
            'Restaurant',
            'Cafe and bar',
            'Spa and steam bath',
            'Board room and meetings',
            'Salon',
            'Parking and guest assistance'
          )
        )
      ),
      'Hotel Services | Pelbu Suites',
      'Explore rooms, dining, cafe and bar, spa and steam, meetings, salon, and practical hotel services at Pelbu Suites in Thimphu.',
      '/services',
      'Rooms, dining, recovery, meetings, and practical guest services in one Thimphu hotel.',
      '/book',
      'Book a room',
      '/contact',
      'Contact the desk'
    ),
    (
      'salon',
      'Salon',
      'Personal care in a comfortable hotel setting.',
      'Ask the Pelbu Suites desk about currently available hair, nail, beauty, and personal-care appointments.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Salon services',
          'paragraphs', jsonb_build_array(
            'The salon is designed around personal care and attention, whether you are looking for a haircut, colour service, nail care, or time to refresh.',
            'Available hair services may include cuts, colour, highlights, and styling. Nail and beauty services depend on the current team and appointment schedule.',
            'Packages and group appointments can be discussed directly with the hotel. Contact the desk to confirm the exact service, price, and appointment time before travelling.'
          ),
          'items', jsonb_build_array(
            'Haircuts and styling',
            'Hair colour and highlights',
            'Manicure and pedicure',
            'Beauty and personal-care appointments',
            'Bridal and group enquiries'
          )
        )
      ),
      'Salon | Pelbu Suites',
      'Ask about hair, nail, beauty, and personal-care appointments at Pelbu Suites in Thimphu.',
      '/salon',
      'Salon and personal-care appointments at Pelbu Suites.',
      '/contact',
      'Ask about an appointment',
      '/book',
      'Add a stay'
    ),
    (
      'gallery',
      'Photo gallery',
      'See Pelbu Suites before you arrive.',
      'Browse rooms, suites, interiors, and shared spaces from the hotel formerly known as Seven Suites.',
      jsonb_build_array(
        jsonb_build_object(
          'heading', 'Pelbu Suites in pictures',
          'paragraphs', jsonb_build_array(
            'The gallery brings together official high-resolution photography of the property. Room appearance and furnishings can vary slightly by category.'
          ),
          'items', '[]'::jsonb
        )
      ),
      'Photo Gallery | Pelbu Suites',
      'View official photographs of rooms, suites, and shared spaces at Pelbu Suites in Olakha, Thimphu.',
      '/gallery',
      'Official hotel photography from Pelbu Suites in Thimphu.',
      '/rooms',
      'Explore rooms',
      '/book',
      'Check availability'
    )
)
insert into public.cms_pages (
  property_id, slug, eyebrow, title, body, sections_json, seo_title,
  meta_description, canonical_path, summary, primary_cta_href,
  primary_cta_label, secondary_cta_href, secondary_cta_label, is_published,
  source_note, last_verified_at, published_at
)
select
  prop.id, source.slug, source.eyebrow, source.title, source.body,
  source.sections_json, source.seo_title, source.meta_description,
  source.canonical_path, source.summary, source.primary_href,
  source.primary_label, source.secondary_href, source.secondary_label, true,
  'Adapted from sevensuitesthimphu.com after the property changed ownership and was renamed Pelbu Suites. Operational rates and contacts use Pelbu source records.',
  now(), now()
from prop
cross join source
on conflict (property_id, slug) do update set
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  body = excluded.body,
  sections_json = excluded.sections_json,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  canonical_path = excluded.canonical_path,
  summary = excluded.summary,
  primary_cta_href = excluded.primary_cta_href,
  primary_cta_label = excluded.primary_cta_label,
  secondary_cta_href = excluded.secondary_cta_href,
  secondary_cta_label = excluded.secondary_cta_label,
  is_published = true,
  source_note = excluded.source_note,
  last_verified_at = excluded.last_verified_at,
  published_at = excluded.published_at,
  revision = public.cms_pages.revision + 1,
  updated_at = now();

with prop as (
  select id from public.properties where slug = 'pelbu-suites-olakha'
), photos(public_id, alt, sort_order) as (
  values
    ('pelbu/seven-suites/official-img19', 'Pelbu Suites hotel exterior', 10),
    ('pelbu/seven-suites/official-room', 'Suite seating area', 20),
    ('pelbu/seven-suites/official-img6149', 'Deluxe suite interior', 30),
    ('pelbu/seven-suites/official-img6194', 'Superior room interior', 40),
    ('pelbu/seven-suites/official-img6256', 'Twin room interior', 50),
    ('pelbu/seven-suites/official-img6236', 'Guest room seating', 60),
    ('pelbu/seven-suites/official-img6254', 'Guest room details', 70),
    ('pelbu/seven-suites/official-img6170', 'Hotel room interior', 80),
    ('pelbu/seven-suites/official-img2', 'Pelbu Suites interior', 90),
    ('pelbu/seven-suites/official-img14', 'Hotel shared space', 100),
    ('pelbu/seven-suites/official-dsc08154', 'Suite lounge and rug', 110),
    ('pelbu/seven-suites/ta-2b0c2558', 'Pelbu Suites guest area', 120),
    ('pelbu/seven-suites/ta-2b0c2559', 'Pelbu Suites interior detail', 130),
    ('pelbu/seven-suites/ta-2b0c255a', 'Pelbu Suites shared space', 140)
)
insert into public.cms_media (
  property_id, page_slug, public_id, alt, kind, sort_order, is_published
)
select prop.id, 'gallery', photos.public_id, photos.alt, 'gallery',
       photos.sort_order, true
from prop
cross join photos
where not exists (
  select 1
  from public.cms_media existing
  where existing.property_id = prop.id
    and existing.page_slug = 'gallery'
    and existing.public_id = photos.public_id
);

insert into public.cms_page_drafts (
  page_id, property_id, content, base_revision, updated_at, updated_by
)
select
  p.id,
  p.property_id,
  jsonb_strip_nulls(jsonb_build_object(
    'eyebrow', p.eyebrow,
    'title', p.title,
    'body', p.body,
    'sections_json', p.sections_json,
    'hours_note', p.hours_note,
    'primary_cta_href', p.primary_cta_href,
    'primary_cta_label', p.primary_cta_label,
    'secondary_cta_href', p.secondary_cta_href,
    'secondary_cta_label', p.secondary_cta_label,
    'seo_title', p.seo_title,
    'meta_description', p.meta_description,
    'canonical_path', p.canonical_path,
    'og_public_id', p.og_public_id,
    'summary', p.summary,
    'faq_json', p.faq_json,
    'author_name', p.author_name,
    'source_note', p.source_note,
    'last_verified_at', p.last_verified_at,
    'is_published', p.is_published
  )),
  p.revision,
  now(),
  'migration'
from public.cms_pages p
where p.property_id = (select id from public.properties where slug = 'pelbu-suites-olakha')
  and p.slug in ('home','contact','rooms','restaurant','bar','meeting','spa','services','salon','gallery')
on conflict (page_id) do update set
  content = excluded.content,
  base_revision = excluded.base_revision,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

insert into public.cms_page_revisions (
  page_id, property_id, revision, content, created_at, created_by
)
select p.id, p.property_id, p.revision, d.content, now(), 'migration'
from public.cms_pages p
join public.cms_page_drafts d on d.page_id = p.id
where p.property_id = (select id from public.properties where slug = 'pelbu-suites-olakha')
  and p.slug in ('home','contact','rooms','restaurant','bar','meeting','spa','services','salon','gallery')
on conflict (page_id, revision) do nothing;

with prop as (
  select id from public.properties where slug = 'pelbu-suites-olakha'
), blurbs(code, blurb) as (
  values
    (
      'deluxe',
      'Around 27 m². A comfortable room for solo travellers or intimate stays, with a plush bed, seating area, stylish décor, television, Wi-Fi, and a private bathroom with rain shower.'
    ),
    (
      'deluxe suite',
      'Around 27–60 m² depending on allotment. Spacious and elegantly appointed for couples or friends travelling together, with a generous bed, seating, television, and a private bathroom.'
    ),
    (
      'superior',
      'A quiet superior room with lounge seating, soft daylight, modern furnishings, television, Wi-Fi, and a private bathroom for a restful Thimphu stay.'
    ),
    (
      'twin',
      'Twin-ready guest room for friends or colleagues travelling together, with modern amenities, comfortable bedding, seating, television, and a private bathroom.'
    )
)
update public.room_types rt
set blurb = blurbs.blurb
from prop, blurbs
where rt.property_id = prop.id
  and rt.code = blurbs.code;

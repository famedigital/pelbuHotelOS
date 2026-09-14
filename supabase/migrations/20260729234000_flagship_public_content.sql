-- Flagship public copy and answer-engine content. Operational values such as
-- prices and opening hours remain in their dedicated CMS/data tables.

insert into cms_pages (
  property_id,
  slug,
  eyebrow,
  title,
  body,
  primary_cta_href,
  primary_cta_label,
  secondary_cta_href,
  secondary_cta_label,
  meta_description,
  seo_title,
  canonical_path,
  summary,
  faq_json,
  author_name,
  source_note,
  last_verified_at,
  is_published
)
select
  p.id,
  seed.slug,
  seed.eyebrow,
  seed.title,
  seed.body,
  seed.primary_cta_href,
  seed.primary_cta_label,
  seed.secondary_cta_href,
  seed.secondary_cta_label,
  seed.meta_description,
  seed.seo_title,
  seed.canonical_path,
  seed.summary,
  seed.faq_json::jsonb,
  'Pelbu Suites',
  'Flagship owned content; operational claims require desk verification.',
  now(),
  true
from properties p
cross join (
  values
    (
      'home',
      'Olakha · Thimphu',
      'Stay close to the city. Come home to calm.',
      'Pelbu brings rooms, fresh food, restorative steam, and useful gathering space together in Olakha. Book the part of your Thimphu day you need, without the hotel theatre.',
      '/book',
      'Check rooms',
      '/dine',
      'See food and drink',
      'Stay, dine, meet, and recover at Pelbu Suites in Olakha, Thimphu. Check rooms and book direct.',
      'Pelbu Suites Olakha | Hotel in Thimphu, Bhutan',
      '/',
      'A practical, warm base in Olakha for stays, meals, meetings, and recovery.',
      '[]',
      10
    ),
    (
      'spa',
      'Spa & steam',
      'Make room to recover.',
      'Choose a focused treatment or steam session after the road, a trek, or a long working day. Send the time that suits you; the team confirms the therapist, room, and rate before your visit.',
      '/spa',
      'Request a slot',
      '/book',
      'Add a stay',
      'Request a massage or steam session at Pelbu Suites in Olakha, Thimphu. Open to hotel guests and day visitors, subject to confirmation.',
      'Spa and Steam in Thimphu | Pelbu Suites Olakha',
      '/spa',
      'Massage and steam requests for hotel guests and day visitors in Olakha.',
      '[]',
      20
    ),
    (
      'meeting',
      'Meet at Pelbu',
      'A room that gets out of the way.',
      'Set the room for a board discussion, workshop, or team briefing. Share the date, group size, duration, catering needs, and delegate rooms in one enquiry; the team confirms the complete setup.',
      '/meeting',
      'Plan a meeting',
      '/book',
      'Rooms for delegates',
      'Plan a meeting, workshop, or team briefing at Pelbu Suites in Olakha, Thimphu, with layouts and cafe catering on request.',
      'Meeting Room in Thimphu | Pelbu Suites Olakha',
      '/meeting',
      'A configurable meeting room in Olakha with catering and delegate stays on request.',
      '[]',
      30
    ),
    (
      'faq',
      'Useful answers',
      'Before you arrive.',
      'Clear answers for booking, staying, eating, meeting, and getting help at Pelbu Suites. If an operational detail is not listed, ask the desk before you travel.',
      '/book',
      'Check rooms',
      '/contact',
      'Ask the desk',
      'Answers about booking, location, meals, cafe delivery, spa, meetings, and stays at Pelbu Suites Olakha, Thimphu.',
      'Pelbu Suites FAQ | Booking and Stay Answers',
      '/faq',
      'Practical answers for guests and visitors planning time at Pelbu Suites.',
      '[{"question":"Where is Pelbu Suites?","answer":"Pelbu Suites is in Olakha, Thimphu, Bhutan. Use the contact page for the current map pin and arrival help."},{"question":"Can I book directly online?","answer":"Yes. Choose dates, rooms, and an available meal plan on the booking page. The system places a timed hold and the desk confirms the booking after the required payment or credit arrangement."},{"question":"Can I order food without staying at the hotel?","answer":"Yes. The public order page shows the currently available cafe and pastry menu for counter pickup or taxi delivery within listed Thimphu areas."},{"question":"Can day visitors request the spa or steam room?","answer":"Yes. Hotel guests and day visitors can request a slot. Therapist, room availability, and the current rate are confirmed before the visit."},{"question":"Can Pelbu host a meeting and arrange food?","answer":"Yes. Select a published room layout, date, duration, and group size on the meeting page. Add catering and delegate-room needs in the same enquiry."},{"question":"Do travel agents see other bookings?","answer":"No. Approved partners see their own bookings and anonymous room availability only; guest and other partner details remain private."}]',
      40
    ),
    (
      'olakha-thimphu',
      'Stay in Olakha',
      'A quieter base for Thimphu days.',
      'Olakha gives travellers a practical base away from the busiest centre while keeping Thimphu within reach. Pelbu combines the essentials under one roof, so an early coffee, a working session, dinner, and recovery do not require another transfer.',
      '/book',
      'Check rooms',
      '/contact',
      'Plan your arrival',
      'Plan a stay in Olakha, Thimphu, with rooms, dining, spa, and meeting facilities together at Pelbu Suites.',
      'Stay in Olakha, Thimphu | Pelbu Suites',
      '/stay/olakha-thimphu',
      'A practical guide to choosing Olakha as a base for a Thimphu stay.',
      '[{"question":"Why stay in Olakha?","answer":"Olakha can suit travellers who want a calmer base with road access and hotel services together, rather than staying in the busiest part of central Thimphu."},{"question":"What can I do at Pelbu without another transfer?","answer":"Pelbu combines rooms, cafe and restaurant service, spa and steam requests, and meeting space at one property."}]',
      50
    )
) as seed(
  slug,
  eyebrow,
  title,
  body,
  primary_cta_href,
  primary_cta_label,
  secondary_cta_href,
  secondary_cta_label,
  meta_description,
  seo_title,
  canonical_path,
  summary,
  faq_json,
  sort_order
)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, slug) do update
set
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  body = excluded.body,
  primary_cta_href = excluded.primary_cta_href,
  primary_cta_label = excluded.primary_cta_label,
  secondary_cta_href = excluded.secondary_cta_href,
  secondary_cta_label = excluded.secondary_cta_label,
  meta_description = excluded.meta_description,
  seo_title = excluded.seo_title,
  canonical_path = excluded.canonical_path,
  summary = excluded.summary,
  faq_json = excluded.faq_json,
  author_name = excluded.author_name,
  source_note = excluded.source_note,
  last_verified_at = excluded.last_verified_at,
  is_published = true,
  updated_at = now();

-- Correct the legacy restaurant secondary action: /book is room booking, not
-- table reservation.
update cms_pages
set
  primary_cta_href = '/contact',
  primary_cta_label = 'Ask about a table',
  secondary_cta_href = '/order',
  secondary_cta_label = 'Order cafe',
  updated_at = now()
where slug = 'restaurant'
  and property_id in (
    select id from properties where slug = 'pelbu-suites-olakha'
  );

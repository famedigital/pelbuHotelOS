-- Public conversion excellence: stay-first CMS CTAs, verified property facts,
-- and denser FAQ answers for search / answer engines.
-- Does not invent phone, star rating, or prices.

-- ---------------------------------------------------------------------------
-- Home page: never pitch food as the hero secondary CTA
-- ---------------------------------------------------------------------------
update cms_pages c
set
  secondary_cta_href = '/rates',
  secondary_cta_label = 'See room rates',
  meta_description = coalesce(
    nullif(trim(c.meta_description), ''),
    'Book rooms direct at Pelbu Suites in Olakha, Thimphu — public rack rates, live availability, cafe restaurant and spa under one roof.'
  ),
  seo_title = coalesce(
    nullif(trim(c.seo_title), ''),
    'Pelbu Suites Olakha | Hotel in Thimphu, Bhutan'
  ),
  updated_at = now()
from properties p
where c.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and c.slug = 'home'
  and (
    c.secondary_cta_href is null
    or c.secondary_cta_href in ('/dine', '/menu', '/order', '/cafe', '/restaurant')
  );

-- ---------------------------------------------------------------------------
-- Property facts: ops defaults + Olakha geo (area, not door pin)
-- Map pin still preferred via properties.maps_url when desk sets it.
-- ---------------------------------------------------------------------------
update property_facts f
set
  check_in_time = coalesce(f.check_in_time, time '14:00'),
  check_out_time = coalesce(f.check_out_time, time '12:00'),
  latitude = coalesce(f.latitude, 27.4495),
  longitude = coalesce(f.longitude, 89.6572),
  amenities_json = case
    when f.amenities_json is null
      or f.amenities_json = '[]'::jsonb
      or jsonb_array_length(f.amenities_json) = 0
    then '[
      "On-site parking",
      "Restaurant",
      "Cafe & pastry",
      "Spa & steam",
      "Meeting room",
      "Free Wi-Fi",
      "Guide & driver beds (agent groups)"
    ]'::jsonb
    else f.amenities_json
  end,
  source_note = coalesce(
    f.source_note,
    'Check-in/out standard hotel practice; Geo = Olakha area centroid until maps_url pin; amenities from live outlets.'
  ),
  last_verified_at = coalesce(f.last_verified_at, now()),
  updated_at = now()
from properties p
where f.property_id = p.id
  and p.slug = 'pelbu-suites-olakha';

insert into property_facts (
  property_id,
  check_in_time,
  check_out_time,
  latitude,
  longitude,
  amenities_json,
  source_note,
  last_verified_at
)
select
  p.id,
  time '14:00',
  time '12:00',
  27.4495,
  89.6572,
  '[
    "On-site parking",
    "Restaurant",
    "Cafe & pastry",
    "Spa & steam",
    "Meeting room",
    "Free Wi-Fi",
    "Guide & driver beds (agent groups)"
  ]'::jsonb,
  'Initial public facts seed for Pelbu Olakha.',
  now()
from properties p
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1 from property_facts f where f.property_id = p.id
  );

-- ---------------------------------------------------------------------------
-- FAQ density for AEO (owned flagship content — full practical set)
-- ---------------------------------------------------------------------------
update cms_pages c
set
  faq_json = '[
    {
      "question": "Where is Pelbu Suites?",
      "answer": "Pelbu Suites is in Olakha, Thimphu, Bhutan. Use the contact page for the current map pin and arrival help."
    },
    {
      "question": "Can I book directly online?",
      "answer": "Yes. Choose dates, rooms, and an available meal plan on the booking page. The system places a timed hold and the desk confirms the booking after the required payment or credit arrangement."
    },
    {
      "question": "What does a direct booking include?",
      "answer": "Direct bookings on this site use public rack rates for the selected season, live room availability, and a timed hold while the desk confirms payment or approved credit. You avoid OTA markups."
    },
    {
      "question": "Where can I see current room rates?",
      "answer": "Open the public rate card for room-only and meal package totals by season. Figures shown are for public BAR; travel-agent tiers require a verified agent session."
    },
    {
      "question": "What is the usual check-in and check-out time?",
      "answer": "Standard check-in is from 14:00 and check-out by 12:00 Bhutan time unless the desk confirms another arrangement for your booking."
    },
    {
      "question": "Are guide and driver beds available?",
      "answer": "Complimentary guide and driver beds apply on qualifying agent group stays. Leisure guests book sellable guest rooms only."
    },
    {
      "question": "Is tax included in published rates?",
      "answer": "Public rate cards and package quotes follow the property tax setting. When marked inclusive, GST and service charge are already in the displayed total for that package."
    },
    {
      "question": "Can I order food without staying at the hotel?",
      "answer": "Yes. The public menu page shows the currently available cafe, pastry and restaurant dishes for counter pickup or taxi delivery within listed Thimphu areas."
    },
    {
      "question": "Can day visitors request the spa or steam room?",
      "answer": "Yes. Hotel guests and day visitors can request a slot. Therapist, room availability, and the current rate are confirmed before the visit."
    },
    {
      "question": "Can Pelbu host a meeting and arrange food?",
      "answer": "Yes. Select a published room layout, date, duration, and group size on the meeting page. Add catering and delegate-room needs in the same enquiry."
    },
    {
      "question": "Do travel agents see other bookings?",
      "answer": "No. Approved partners see their own bookings and anonymous room availability only; guest and other partner details remain private."
    },
    {
      "question": "How do I reach the desk quickly?",
      "answer": "Use the contact page for phone, WhatsApp when published, email, and map link. For a stay, book first so your dates are held."
    }
  ]'::jsonb,
  updated_at = now()
from properties p
where c.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and c.slug = 'faq';

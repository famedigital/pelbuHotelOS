-- Owned, practical guide content. No prices, exact travel times, or unverified
-- attraction distances are asserted here.

insert into cms_posts (
  property_id,
  slug,
  title,
  excerpt,
  body_md,
  cover_public_id,
  content_type,
  primary_query,
  seo_title,
  meta_description,
  author_name,
  source_note,
  published_at,
  updated_at,
  last_verified_at,
  is_published
)
select
  p.id,
  seed.slug,
  seed.title,
  seed.excerpt,
  seed.body_md,
  seed.cover_public_id,
  'guide',
  seed.primary_query,
  seed.seo_title,
  seed.meta_description,
  'Pelbu Suites',
  'Owned property guidance. Time-sensitive transport and operating details must be confirmed by the desk.',
  now(),
  now(),
  now(),
  true
from properties p
cross join (
  values
    (
      'choosing-olakha-for-a-thimphu-stay',
      'Choosing Olakha for a Thimphu stay',
      'How to decide whether a calmer Olakha base fits your work, family, or Bhutan itinerary.',
      '## Who Olakha suits

Olakha can work well when you want a practical base outside the busiest central streets, particularly when your day includes road travel, meetings, or an early departure.

## Keep essential stops together

At Pelbu, rooms, cafe and restaurant service, meeting space, and recovery requests sit at one property. That can reduce extra transfers during a short Thimphu stay.

## Questions to settle before booking

- Confirm the room type and meal plan available for your exact dates.
- Tell the desk if you are travelling with a guide or driver.
- Share meeting, airport transfer, or late-arrival needs before travel.
- Use the current map link from the hotel rather than relying on an old listing.

## Book from live information

Use the booking engine for the current room quote. Opening hours, transport timing, and service slots can change, so confirm those directly with the desk.',
      'pelbu/rooms/deluxe',
      'stay in Olakha Thimphu',
      'Why Stay in Olakha, Thimphu | Pelbu Suites Guide',
      'A practical guide to choosing Olakha as a base for a Thimphu hotel stay.',
      10
    ),
    (
      'thimphu-arrival-checklist',
      'A practical Thimphu arrival checklist',
      'The small details worth sharing before you reach the hotel, especially on a guided Bhutan itinerary.',
      '## Before the travel day

Send the hotel the name used on the booking, a working Bhutan or roaming phone number, and your expected arrival window.

## If you are travelling with a tour

- Share the guide number used for the booking.
- Confirm whether guide or driver accommodation was included by the agent.
- Keep passport or CID details and any documents required for check-in accessible.
- Tell the desk about changes to the group size before arrival.

## If payment is still pending

Use only the payment instructions attached to your booking. A room hold is not the same as a confirmed stay; check the hold deadline and ask the desk if a transfer may arrive late.

## On the way

Use the current map link or ask the desk to send a location pin. Public directory listings can become outdated.',
      'pelbu/rooms/superior',
      'Thimphu hotel arrival checklist',
      'Thimphu Hotel Arrival Checklist | Pelbu Suites',
      'A useful arrival checklist for hotel guests, agents, guides, and drivers travelling to Thimphu.',
      20
    ),
    (
      'plan-a-small-meeting-in-thimphu',
      'Planning a focused small meeting in Thimphu',
      'A simple brief that helps the hotel confirm the room, layout, food, and delegate stays in one reply.',
      '## Start with the outcome

Tell the hotel whether the session is a board discussion, training, briefing, interview, or workshop. The purpose matters more than a generic request for a hall.

## Send one complete brief

- Preferred date and start time.
- Expected attendee count.
- Room layout.
- Session duration.
- Tea, coffee, pastry, or meal requirements.
- Screen, power, or connectivity needs.
- Number of delegate rooms, if any.

## Leave room for confirmation

Submitting the meeting form is an enquiry, not an automatic reservation. The team confirms the room setup, service availability, and current rate before the event is final.

## Keep delegates together

When overnight rooms and the meeting are at one property, the organiser has fewer transfers and fewer separate suppliers to coordinate.',
      'pelbu/restaurant/dining-room',
      'small meeting room Thimphu',
      'How to Plan a Small Meeting in Thimphu | Pelbu Suites',
      'Plan a focused small meeting in Thimphu with a complete room, catering, and delegate-stay brief.',
      30
    )
) as seed(
  slug,
  title,
  excerpt,
  body_md,
  cover_public_id,
  primary_query,
  seo_title,
  meta_description,
  sort_order
)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, slug) do update
set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body_md = excluded.body_md,
  cover_public_id = excluded.cover_public_id,
  primary_query = excluded.primary_query,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  author_name = excluded.author_name,
  source_note = excluded.source_note,
  updated_at = now(),
  last_verified_at = now(),
  is_published = true;

-- FO sheet tier chosen at book / StayHub rate pickup.
-- Prefer this over agent/source inference when posting room nights
-- (unless agreed_nightly_rate_btn is set for a true exception).

alter table public.bookings
  add column if not exists sheet_rate_tier text
    check (
      sheet_rate_tier is null
      or sheet_rate_tier = any (
        array[
          'public'::text,
          'friends'::text,
          'family'::text,
          'mutual_friends'::text,
          'agents'::text,
          'mou_agents'::text
        ]
      )
    );

comment on column public.bookings.sheet_rate_tier is
  'FO rate-sheet tier for live quotes and room-night posts when agreed_nightly_rate_btn is null.';

create index if not exists bookings_sheet_rate_tier_idx
  on public.bookings (property_id, sheet_rate_tier)
  where sheet_rate_tier is not null;

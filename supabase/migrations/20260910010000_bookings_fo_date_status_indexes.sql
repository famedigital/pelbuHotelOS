-- Hot FO / public filters: arrivals, departures, Today, front-desk-version.
-- Non-concurrent so standard migration runners can apply in a transaction.

CREATE INDEX IF NOT EXISTS bookings_property_check_in_status_idx
  ON public.bookings (property_id, check_in, status);

CREATE INDEX IF NOT EXISTS bookings_property_check_out_status_idx
  ON public.bookings (property_id, check_out, status);

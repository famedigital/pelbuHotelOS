-- A short-lived processing state lets a signed gateway webhook atomically
-- claim a payment link before posting money. This prevents duplicate deposits
-- when a provider retries or delivers two events concurrently.
alter table public.payment_links
  drop constraint if exists payment_links_status_check;

alter table public.payment_links
  add constraint payment_links_status_check
  check (status = any (array[
    'open'::text,
    'processing'::text,
    'paid'::text,
    'expired'::text,
    'cancelled'::text
  ]));

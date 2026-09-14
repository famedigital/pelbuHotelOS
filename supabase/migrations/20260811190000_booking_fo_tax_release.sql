-- FO reservation commercial fields (eZee-parity lite): tax mode/exempt + release/deposit due.

alter table public.bookings
  add column if not exists rate_tax_mode text
    not null default 'exclusive'
    check (rate_tax_mode in ('inclusive', 'exclusive'));

alter table public.bookings
  add column if not exists tax_exempt_gst boolean not null default false;

alter table public.bookings
  add column if not exists tax_exempt_service boolean not null default false;

alter table public.bookings
  add column if not exists tax_exempt_bst boolean not null default false;

alter table public.bookings
  add column if not exists release_days_before_arrival integer
    check (release_days_before_arrival is null or release_days_before_arrival >= 0);

alter table public.bookings
  add column if not exists release_percent numeric(5, 2)
    check (
      release_percent is null
      or (release_percent >= 0 and release_percent <= 100)
    );

alter table public.bookings
  add column if not exists deposit_due_on date;

comment on column public.bookings.rate_tax_mode is
  'Quoted room rates treated as tax-inclusive or exclusive for this stay (FO book).';
comment on column public.bookings.tax_exempt_gst is
  'FO book-time GST exemption (e.g. diplomatic); folio lines may still follow gst_applicable.';
comment on column public.bookings.tax_exempt_service is
  'FO book-time service charge exemption.';
comment on column public.bookings.tax_exempt_bst is
  'FO book-time Bhutan sales / BST exemption flag.';
comment on column public.bookings.release_days_before_arrival is
  'Optional release window: free rooms this many days before arrival if unpaid.';
comment on column public.bookings.release_percent is
  'Optional minimum payment % of stay to avoid release.';
comment on column public.bookings.deposit_due_on is
  'Date by which deposit / token should be collected (deposit-due worklist).';

create index if not exists bookings_deposit_due_on_idx
  on public.bookings (property_id, deposit_due_on)
  where deposit_due_on is not null
    and status in ('held', 'pending', 'confirmed');

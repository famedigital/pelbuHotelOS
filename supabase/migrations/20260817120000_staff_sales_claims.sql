-- Staff sales claims: who sold/sourced a guest or agent reservation,
-- with owner/GM approval. Commission % is property-level reporting only.

alter table public.bookings
  add column if not exists sold_by_staff_id uuid
    references public.staff_members (id) on delete set null;

alter table public.bookings
  add column if not exists sales_claim_status text;

alter table public.bookings
  add column if not exists sales_verified_by_staff_id uuid
    references public.staff_members (id) on delete set null;

alter table public.bookings
  add column if not exists sales_verified_at timestamptz;

alter table public.bookings
  add column if not exists sales_claim_note text;

-- Drop and re-add check so re-runs are safe
alter table public.bookings
  drop constraint if exists bookings_sales_claim_status_check;

alter table public.bookings
  add constraint bookings_sales_claim_status_check
  check (
    sales_claim_status is null
    or sales_claim_status in ('claimed', 'approved', 'rejected')
  );

create index if not exists bookings_sales_claim_queue_idx
  on public.bookings (property_id, sales_claim_status)
  where sales_claim_status is not null;

create index if not exists bookings_sold_by_staff_idx
  on public.bookings (sold_by_staff_id)
  where sold_by_staff_id is not null;

comment on column public.bookings.sold_by_staff_id is
  'Staff who brought the guest/agent for incentive credit.';
comment on column public.bookings.sales_claim_status is
  'null none · claimed pending GM · approved · rejected';

alter table public.property_policies
  add column if not exists staff_sales_commission_pct numeric;

comment on column public.property_policies.staff_sales_commission_pct is
  'Suggested staff commission % of quoted_total_btn for reports (0–100).';

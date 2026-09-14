-- Track which gateway a payment link is settled through.
-- `manual`   = desk staff clicks confirm after manual bank transfer (today's behaviour)
-- `pay_bt`   = Pay.bt hosted checkout webhook
-- `bank_qr`  = bank QR code scan-to-pay webhook
--
-- Optional column; default 'manual' keeps every existing link working.
alter table public.payment_links
  add column if not exists payment_gateway text not null default 'manual';

-- Backfill any NULLs created by the ALTER above on existing rows.
update public.payment_links
   set payment_gateway = 'manual'
 where payment_gateway is null;

-- Check constraint to keep the field honest.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payment_links_payment_gateway_check'
  ) then
    alter table public.payment_links
      add constraint payment_links_payment_gateway_check
      check (payment_gateway in ('manual', 'pay_bt', 'bank_qr'));
  end if;
end $$;

comment on column public.payment_links.payment_gateway is
  'How this link is settled: manual (desk-confirmed bank transfer), pay_bt (Pay.bt webhook), bank_qr (bank QR webhook).';

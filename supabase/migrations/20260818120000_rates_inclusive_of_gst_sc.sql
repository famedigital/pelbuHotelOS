-- Property policy: room_rates amounts may be stored inclusive of GST + SC.
-- Default false preserves exclusive-add behaviour (folio adds SC then GST on net).

alter table public.property_policies
  add column if not exists rates_inclusive_of_gst_sc boolean not null default false;

comment on column public.property_policies.rates_inclusive_of_gst_sc is
  'When true, room_rates amount_btn is the guest all-in price (incl GST & SC when SC default is on). Folio posting reverse-outs net / SC / GST. When false (default), amounts are exclusive and SC + GST are added.';

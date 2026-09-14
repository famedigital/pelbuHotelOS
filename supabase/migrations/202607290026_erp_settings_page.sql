-- ERP settings page foundation:
-- per-property identity/tax/document settings + service charge snapshots.

alter table properties
  add column if not exists logo_public_id text,
  add column if not exists legal_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists tax_id text,
  add column if not exists gst_rate numeric(5,4) not null default 0.07
    check (gst_rate >= 0 and gst_rate <= 1),
  add column if not exists service_charge_rate numeric(5,4) not null default 0
    check (service_charge_rate >= 0 and service_charge_rate <= 1),
  add column if not exists service_charge_default_on boolean not null default false,
  add column if not exists doc_invoice jsonb not null default '{
    "preset": "classic",
    "brand_color": "#7b1e3a",
    "accent_color": "#d46f92",
    "header_text": "Direct billing summary.",
    "footer_text": "All amounts in Ngultrum (Nu).",
    "show_phone": true,
    "show_email": true,
    "show_tax_id": true,
    "show_address": true,
    "paper_size": "a4"
  }'::jsonb,
  add column if not exists doc_receipt jsonb not null default '{
    "preset": "compact",
    "brand_color": "#7b1e3a",
    "accent_color": "#d46f92",
    "header_text": "Thank you for staying with us.",
    "footer_text": "Please keep this receipt for your records.",
    "show_phone": true,
    "show_email": true,
    "show_tax_id": true,
    "show_address": true,
    "paper_size": "thermal"
  }'::jsonb,
  add column if not exists doc_voucher jsonb not null default '{
    "preset": "branded",
    "brand_color": "#7b1e3a",
    "accent_color": "#d46f92",
    "header_text": "Present at check-in.",
    "footer_text": "Rates and taxes settle on the guest folio.",
    "show_phone": true,
    "show_email": true,
    "show_tax_id": false,
    "show_address": true,
    "paper_size": "a4"
  }'::jsonb;

update properties
set legal_name = coalesce(nullif(legal_name, ''), name)
where legal_name is null or legal_name = '';

alter table orders
  add column if not exists service_charge_rate numeric(5,4) not null default 0
    check (service_charge_rate >= 0 and service_charge_rate <= 1),
  add column if not exists service_charge_btn numeric(12,2) not null default 0,
  add column if not exists service_charge_applied boolean not null default false,
  add column if not exists service_charge_reason text;

alter table folio_lines
  add column if not exists service_charge_rate numeric(5,4) not null default 0
    check (service_charge_rate >= 0 and service_charge_rate <= 1),
  add column if not exists service_charge_btn numeric(12,2) not null default 0,
  add column if not exists service_charge_applied boolean not null default false,
  add column if not exists service_charge_reason text;

comment on column properties.logo_public_id is
  'Cloudinary public_id used for desk and document branding.';

comment on column properties.gst_rate is
  'Property default GST percentage stored as a decimal fraction, e.g. 0.07 for 7%.';

comment on column properties.service_charge_rate is
  'Property default service charge percentage stored as a decimal fraction.';

comment on column orders.service_charge_applied is
  'True when a service charge was added to the order total.';

comment on column folio_lines.service_charge_applied is
  'True when the posted folio line total includes a service charge.';

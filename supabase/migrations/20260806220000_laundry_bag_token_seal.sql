-- Sealable raw scan tokens so bag labels can be reprinted without
-- invalidating stickers already stuck on laundry bags.
alter table laundry_order_bags
  add column if not exists scan_token_sealed text;

comment on column laundry_order_bags.scan_token_sealed is
  'AES-GCM sealed raw QR token (server-only). Hash remains for verify; sealed allows same-label reprint.';

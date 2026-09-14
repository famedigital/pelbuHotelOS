-- Guest arrival registration card: store signed scan/photo after FO print + guest ink.

alter table public.bookings
  add column if not exists reg_card_photo_public_id text,
  add column if not exists reg_card_signed_at timestamptz;

comment on column public.bookings.reg_card_photo_public_id is
  'Cloudinary public_id of signed guest registration card (camera or file after check-in).';
comment on column public.bookings.reg_card_signed_at is
  'When FO attached the signed registration scan/photo.';

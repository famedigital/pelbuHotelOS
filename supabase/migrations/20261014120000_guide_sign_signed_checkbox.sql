-- Staff can confirm the guide signed the settlement without uploading the scan.
-- 'signed' lets guests leave; the scan stays outstanding until status becomes 'photo'.

alter table public.bookings drop constraint if exists bookings_guide_sign_status_check;

alter table public.bookings
  add constraint bookings_guide_sign_status_check
  check (
    guide_sign_status is null
    or guide_sign_status in ('photo', 'waived', 'signed')
  );

comment on column public.bookings.guide_sign_status is
  'Agent stays: signed = staff confirmed the paper is signed, scan still due; photo = scan on file; waived = FO override; null = not confirmed.';

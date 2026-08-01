-- Private storage for nightly hotel backup Excel packs (night audit continuity).
-- Path: {property_id}/{YYYY-MM-DD}.xlsx — overwritten per business date.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'night-audit-packs',
  'night-audit-packs',
  false,
  52428800, -- 50 MB
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "service_role night-audit-packs" on storage.objects;
create policy "service_role night-audit-packs" on storage.objects
  for all to service_role
  using (bucket_id = 'night-audit-packs')
  with check (bucket_id = 'night-audit-packs');

-- Seed empty nav.mega_menu setting for each property (ERP creates on open if missing).
insert into public.cms_site_settings (property_id, key, content)
select
  p.id,
  'nav.mega_menu',
  jsonb_build_object(
    'features', jsonb_build_object(),
    'items', jsonb_build_object()
  )
from public.properties p
on conflict (property_id, key) do nothing;

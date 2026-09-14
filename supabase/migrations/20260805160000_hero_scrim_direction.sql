-- Default gradient direction on existing home hero_theme when missing.
update cms_pages c
set
  hero_theme = coalesce(c.hero_theme, '{}'::jsonb)
    || jsonb_build_object('scrimDirection', 'top-bottom'),
  updated_at = now()
from properties p
where c.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and c.slug = 'home'
  and (
    c.hero_theme is null
    or not (c.hero_theme ? 'scrimDirection')
  );

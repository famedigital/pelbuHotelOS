-- Himalayan Champagne Dusk: seed published home hero_theme for Pelbu flagship.
-- Code defaults match; this keeps CMS (empty {}) from looking “unset.”

update cms_pages c
set
  hero_theme = '{
    "scrimTop": "#0a1628",
    "scrimBottom": "#1a120e",
    "eyebrow": "#e8c97a",
    "title": "#faf6ef",
    "body": "#e6dece",
    "accent": "#c9a227",
    "button": "#f0e4c8"
  }'::jsonb,
  updated_at = now()
from properties p
where c.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and c.slug = 'home'
  and (
    c.hero_theme is null
    or c.hero_theme = '{}'::jsonb
    or c.hero_theme = 'null'::jsonb
    or (
      c.hero_theme ->> 'scrimTop' in ('#0b1020', '#0B1020')
      and c.hero_theme ->> 'scrimBottom' in ('#0b1f33', '#0B1F33')
    )
  );

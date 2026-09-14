-- Homepage hero color theme (edited in Front Public → home page).
alter table cms_pages
  add column if not exists hero_theme jsonb not null default '{}'::jsonb;

comment on column cms_pages.hero_theme is
  'Homepage hero color overrides: scrimTop, scrimBottom, eyebrow, title, body, accent, button (hex). Empty object = design defaults.';

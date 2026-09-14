-- Explicit service-role policies document the intended private-table access
-- model and keep the database advisor clean. The server-side admin client is
-- still gated by the ERP desk session before it reaches these tables.

drop policy if exists "service role full cms page drafts"
  on public.cms_page_drafts;
create policy "service role full cms page drafts"
  on public.cms_page_drafts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full cms page revisions"
  on public.cms_page_revisions;
create policy "service role full cms page revisions"
  on public.cms_page_revisions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full cms site setting drafts"
  on public.cms_site_setting_drafts;
create policy "service role full cms site setting drafts"
  on public.cms_site_setting_drafts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role full cms site settings"
  on public.cms_site_settings;
create policy "service role full cms site settings"
  on public.cms_site_settings
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists cms_page_revisions_property_idx
  on public.cms_page_revisions(property_id, created_at desc);

create index if not exists cms_site_setting_drafts_property_idx
  on public.cms_site_setting_drafts(property_id, updated_at desc);

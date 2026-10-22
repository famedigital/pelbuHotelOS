-- Desk SSE listens for stay and folio changes on the droplet.
-- Idempotent: skip tables already in the publication.

do $$
declare
  t text;
begin
  foreach t in array array['bookings', 'room_assignments', 'folios', 'folio_lines']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
    execute format('alter table %I replica identity full', t);
  end loop;
end $$;

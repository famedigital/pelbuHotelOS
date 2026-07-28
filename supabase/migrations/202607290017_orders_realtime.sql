-- Enable Realtime publication for orders (desk board).
-- Browser clients still cannot SELECT (no anon SELECT policy by design —
-- desk uses /api/erp/kot-version + router.refresh). Publication is ready
-- for a future desk JWT path.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

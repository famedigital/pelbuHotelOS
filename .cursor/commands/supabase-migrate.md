# Apply Supabase migration safely

1. Use **plugin-supabase-supabase** MCP (not user-supabase)
2. `list_tables` / `list_migrations` on project `umrpibwhxpzsfdyypiuf` (PelbuOS)
3. Prefer `apply_migration` for DDL from `supabase/migrations/`
4. Confirm RLS on every new table
5. Never put secrets in migration SQL

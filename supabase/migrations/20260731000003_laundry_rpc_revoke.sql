-- is_laundry_staff is only needed inside RLS expressions evaluated as
-- service_role / policy owners. App traffic uses the admin client.
-- Revoke PUBLIC API exposure flagged by Supabase advisor 0028/0029.
revoke all on function public.is_laundry_staff(uuid) from public, anon, authenticated;
grant execute on function public.is_laundry_staff(uuid) to service_role;

-- Public forms write through validated Next.js server actions using the service
-- role. Direct anonymous child-row inserts bypass server-side pricing and guest
-- validation, so remove those legacy policies.

drop policy if exists "anon insert order_items" on order_items;
drop policy if exists "anon insert booking_guests" on booking_guests;

-- This event-trigger helper is an administrative function and must never be
-- callable through PostgREST by public or signed-in users.
revoke all on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
grant execute on function public.rls_auto_enable() to service_role;

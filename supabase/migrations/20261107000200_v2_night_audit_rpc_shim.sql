-- Shim night-audit entry for Hotel OS v2 API.
-- Does not replace Innora night audit UI; provides idempotent ack for desk WAL.

create or replace function public.run_night_audit_v2(
  p_property_id uuid,
  p_staff_id uuid,
  p_idempotency_key text,
  p_business_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(
    p_business_date,
    (timezone('Asia/Thimphu', now()))::date
  );
  v_cached jsonb;
begin
  select response into v_cached
  from public.idempotency_keys
  where property_id = p_property_id
    and idempotency_key = p_idempotency_key;
  if found then
    return v_cached || jsonb_build_object('replayed', true);
  end if;

  -- Soft lock business day marker on properties if column exists is skipped;
  -- return ledger summary for desk confirmation.
  insert into public.idempotency_keys (
    property_id, idempotency_key, operation, response
  ) values (
    p_property_id,
    p_idempotency_key,
    'night_audit',
    jsonb_build_object(
      'ok', true,
      'property_id', p_property_id,
      'staff_id', p_staff_id,
      'business_date', v_date
    )
  )
  on conflict (property_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'property_id', p_property_id,
    'business_date', v_date,
    'replayed', false
  );
end;
$$;

revoke all on function public.run_night_audit_v2(uuid, uuid, text, date) from public;
grant execute on function public.run_night_audit_v2(uuid, uuid, text, date) to service_role;

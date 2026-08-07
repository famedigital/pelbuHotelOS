-- Guest agreed-rate promos: benefit is a negotiated nightly room rate (BTN),
-- same tax basis as room_rates / bookings.agreed_nightly_rate_btn.
-- Public /book redeem sets agreed_nightly_rate_btn on the booking (app layer).

alter table public.promo_codes
  drop constraint if exists promo_codes_benefit_type_check;

alter table public.promo_codes
  add constraint promo_codes_benefit_type_check
  check (
    benefit_type = any (
      array['pct'::text, 'fixed_btn'::text, 'nightly_rate_btn'::text]
    )
  );

comment on column public.promo_codes.benefit_type is
  'pct = percent off stay; fixed_btn = Nu off stay; nightly_rate_btn = manager-agreed room Nu/night (rate-sheet tax basis).';

-- Redeem: nightly_rate records zero cash discount (rate is re-quoted in app).
create or replace function public.redeem_promo_code(
  p_property_id uuid,
  p_code text,
  p_channel text,
  p_domain text,
  p_pre_discount_btn numeric,
  p_guest_key text default null,
  p_booking_id uuid default null,
  p_order_id uuid default null,
  p_folio_id uuid default null,
  p_min_nights int default 0,
  p_created_by text default 'desk',
  p_stack_partner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row promo_codes%rowtype;
  v_now timestamptz := now();
  v_discount numeric(12, 2);
  v_post numeric(12, 2);
  v_redemption_id uuid;
  v_guest_count int;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Promo code is required.');
  end if;
  if p_pre_discount_btn is null or p_pre_discount_btn < 0 then
    return jsonb_build_object('ok', false, 'error', 'Invalid amount.');
  end if;

  select * into v_row
  from promo_codes
  where property_id = p_property_id
    and code = v_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Promo code not found.');
  end if;
  if not v_row.active then
    return jsonb_build_object('ok', false, 'error', 'Promo code is inactive.');
  end if;
  if v_row.starts_at is not null and v_now < v_row.starts_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code is not active yet.');
  end if;
  if v_row.ends_at is not null and v_now > v_row.ends_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code has expired.');
  end if;
  if v_row.max_redemptions is not null
     and v_row.redeemed_count >= v_row.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'Promo code redemption limit reached.');
  end if;
  if not (p_channel = any (v_row.channels)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid on this channel.');
  end if;
  if not (p_domain = any (v_row.applies_to)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid for this product.');
  end if;
  if p_pre_discount_btn < coalesce(v_row.min_spend_btn, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum spend not met.');
  end if;
  if coalesce(p_min_nights, 0) < coalesce(v_row.min_nights, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum nights not met.');
  end if;
  if p_stack_partner and not v_row.stackable_with_partner then
    return jsonb_build_object('ok', false, 'error', 'Promo cannot stack with partner discount.');
  end if;

  if p_guest_key is not null and v_row.max_per_guest is not null then
    select count(*)::int into v_guest_count
    from promo_redemptions
    where promo_code_id = v_row.id
      and guest_key = p_guest_key;
    if v_guest_count >= v_row.max_per_guest then
      return jsonb_build_object('ok', false, 'error', 'Guest already used this promo.');
    end if;
  end if;

  if v_row.benefit_type = 'pct' then
    v_discount := round(p_pre_discount_btn * (least(100, v_row.benefit_value) / 100.0), 2);
  elsif v_row.benefit_type = 'nightly_rate_btn' then
    -- Negotiated room/night applied by booking layer (agreed_nightly_rate_btn).
    if p_domain is distinct from 'rooms' then
      return jsonb_build_object(
        'ok', false,
        'error', 'This code is a room rate and only applies to room stays.'
      );
    end if;
    v_discount := 0;
  else
    v_discount := least(p_pre_discount_btn, v_row.benefit_value);
  end if;
  if v_row.max_discount_btn is not null and v_row.benefit_type <> 'nightly_rate_btn' then
    v_discount := least(v_discount, v_row.max_discount_btn);
  end if;
  v_discount := greatest(0, v_discount);
  v_post := greatest(0, round(p_pre_discount_btn - v_discount, 2));

  update promo_codes
  set redeemed_count = redeemed_count + 1,
      updated_at = v_now
  where id = v_row.id;

  insert into promo_redemptions (
    property_id,
    promo_code_id,
    booking_id,
    order_id,
    folio_id,
    guest_key,
    channel,
    applies_domain,
    pre_discount_btn,
    discount_btn,
    post_discount_btn,
    created_by,
    meta
  ) values (
    p_property_id,
    v_row.id,
    p_booking_id,
    p_order_id,
    p_folio_id,
    p_guest_key,
    p_channel,
    p_domain,
    p_pre_discount_btn,
    v_discount,
    v_post,
    coalesce(nullif(trim(p_created_by), ''), 'desk'),
    case
      when v_row.benefit_type = 'nightly_rate_btn' then
        jsonb_build_object('nightly_rate_btn', v_row.benefit_value)
      else '{}'::jsonb
    end
  )
  returning id into v_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'promo_code_id', v_row.id,
    'code', v_row.code,
    'redemption_id', v_redemption_id,
    'discount_btn', v_discount,
    'post_discount_btn', v_post,
    'benefit_type', v_row.benefit_type,
    'benefit_value', v_row.benefit_value,
    'redeemed_count', v_row.redeemed_count + 1,
    'max_redemptions', v_row.max_redemptions,
    'stackable_with_partner', v_row.stackable_with_partner
  );
end;
$$;

revoke all on function public.redeem_promo_code(
  uuid, text, text, text, numeric, text, uuid, uuid, uuid, int, text, boolean
) from public;
grant execute on function public.redeem_promo_code(
  uuid, text, text, text, numeric, text, uuid, uuid, uuid, int, text, boolean
) to service_role;

create or replace function public.preview_promo_code(
  p_property_id uuid,
  p_code text,
  p_channel text,
  p_domain text,
  p_pre_discount_btn numeric,
  p_guest_key text default null,
  p_min_nights int default 0,
  p_stack_partner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row promo_codes%rowtype;
  v_now timestamptz := now();
  v_discount numeric(12, 2);
  v_post numeric(12, 2);
  v_guest_count int;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Promo code is required.');
  end if;

  select * into v_row
  from promo_codes
  where property_id = p_property_id
    and code = v_code;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Promo code not found.');
  end if;
  if not v_row.active then
    return jsonb_build_object('ok', false, 'error', 'Promo code is inactive.');
  end if;
  if v_row.starts_at is not null and v_now < v_row.starts_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code is not active yet.');
  end if;
  if v_row.ends_at is not null and v_now > v_row.ends_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code has expired.');
  end if;
  if v_row.max_redemptions is not null
     and v_row.redeemed_count >= v_row.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'Promo code redemption limit reached.');
  end if;
  if not (p_channel = any (v_row.channels)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid on this channel.');
  end if;
  if not (p_domain = any (v_row.applies_to)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid for this product.');
  end if;
  if p_pre_discount_btn < coalesce(v_row.min_spend_btn, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum spend not met.');
  end if;
  if coalesce(p_min_nights, 0) < coalesce(v_row.min_nights, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum nights not met.');
  end if;
  if p_stack_partner and not v_row.stackable_with_partner then
    return jsonb_build_object('ok', false, 'error', 'Promo cannot stack with partner discount.');
  end if;

  if p_guest_key is not null and v_row.max_per_guest is not null then
    select count(*)::int into v_guest_count
    from promo_redemptions
    where promo_code_id = v_row.id
      and guest_key = p_guest_key;
    if v_guest_count >= v_row.max_per_guest then
      return jsonb_build_object('ok', false, 'error', 'Guest already used this promo.');
    end if;
  end if;

  if v_row.benefit_type = 'pct' then
    v_discount := round(p_pre_discount_btn * (least(100, v_row.benefit_value) / 100.0), 2);
  elsif v_row.benefit_type = 'nightly_rate_btn' then
    if p_domain is distinct from 'rooms' then
      return jsonb_build_object(
        'ok', false,
        'error', 'This code is a room rate and only applies to room stays.'
      );
    end if;
    v_discount := 0;
  else
    v_discount := least(p_pre_discount_btn, v_row.benefit_value);
  end if;
  if v_row.max_discount_btn is not null and v_row.benefit_type <> 'nightly_rate_btn' then
    v_discount := least(v_discount, v_row.max_discount_btn);
  end if;
  v_discount := greatest(0, v_discount);
  v_post := greatest(0, round(p_pre_discount_btn - v_discount, 2));

  return jsonb_build_object(
    'ok', true,
    'promo_code_id', v_row.id,
    'code', v_row.code,
    'discount_btn', v_discount,
    'post_discount_btn', v_post,
    'benefit_type', v_row.benefit_type,
    'benefit_value', v_row.benefit_value,
    'redeemed_count', v_row.redeemed_count,
    'max_redemptions', v_row.max_redemptions,
    'stackable_with_partner', v_row.stackable_with_partner,
    'campaign_id', v_row.campaign_id
  );
end;
$$;

revoke all on function public.preview_promo_code(
  uuid, text, text, text, numeric, text, int, boolean
) from public;
grant execute on function public.preview_promo_code(
  uuid, text, text, text, numeric, text, int, boolean
) to service_role;

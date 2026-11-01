-- Atomic money paths: idempotency + FOR UPDATE folio/booking locks.
-- Real tables: bookings, folios, folio_lines, room_units, room_assignments.

CREATE TABLE IF NOT EXISTS public.money_idempotency (
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  action text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS money_idempotency_created_idx
  ON public.money_idempotency (created_at);

ALTER TABLE public.money_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_idempotency_service_role ON public.money_idempotency;
CREATE POLICY money_idempotency_service_role
  ON public.money_idempotency
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.money_idempotency IS
  'Replay cache for charge / check-in / checkout money RPCs (property_id, idempotency_key).';

-- ---------------------------------------------------------------------------
-- post_folio_charge_atomic: lock folio, insert posted line, cache result
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_folio_charge_atomic(
  p_property_id uuid,
  p_folio_id uuid,
  p_idempotency_key uuid,
  p_booking_id uuid DEFAULT NULL,
  p_source_type text DEFAULT 'service',
  p_source_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_qty numeric DEFAULT 1,
  p_unit_price_btn numeric DEFAULT 0,
  p_amount_btn numeric DEFAULT 0,
  p_gst_applicable boolean DEFAULT false,
  p_gst_btn numeric DEFAULT 0,
  p_total_btn numeric DEFAULT 0,
  p_is_comp boolean DEFAULT false,
  p_business_date date DEFAULT NULL,
  p_room_unit_id uuid DEFAULT NULL,
  p_bill_to text DEFAULT 'guest',
  p_tax_treatment text DEFAULT NULL,
  p_service_charge_rate numeric DEFAULT 0,
  p_service_charge_btn numeric DEFAULT 0,
  p_service_charge_applied boolean DEFAULT false,
  p_service_charge_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_folio public.folios%ROWTYPE;
  v_line_id uuid;
  v_created timestamptz;
  v_result jsonb;
BEGIN
  IF p_property_id IS NULL OR p_folio_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id, folio_id, and idempotency_key are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;

  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_folio
  FROM public.folios
  WHERE id = p_folio_id AND property_id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio not found for property';
  END IF;

  IF v_folio.status IS NOT NULL AND v_folio.status IN ('settled', 'closed') THEN
    RAISE EXCEPTION 'Cannot post charge to a closed or settled folio';
  END IF;

  INSERT INTO public.folio_lines (
    folio_id,
    booking_id,
    source_type,
    source_id,
    description,
    qty,
    unit_price_btn,
    amount_btn,
    service_charge_rate,
    service_charge_btn,
    service_charge_applied,
    service_charge_reason,
    gst_applicable,
    gst_btn,
    total_btn,
    status,
    is_comp,
    business_date,
    room_unit_id,
    bill_to,
    tax_treatment
  ) VALUES (
    p_folio_id,
    p_booking_id,
    coalesce(nullif(trim(p_source_type), ''), 'service'),
    p_source_id,
    coalesce(nullif(trim(p_description), ''), 'Charge'),
    coalesce(p_qty, 1),
    coalesce(p_unit_price_btn, 0),
    coalesce(p_amount_btn, 0),
    coalesce(p_service_charge_rate, 0),
    coalesce(p_service_charge_btn, 0),
    coalesce(p_service_charge_applied, false),
    p_service_charge_reason,
    coalesce(p_gst_applicable, false),
    coalesce(p_gst_btn, 0),
    coalesce(p_total_btn, 0),
    'posted',
    coalesce(p_is_comp, false),
    p_business_date,
    p_room_unit_id,
    coalesce(nullif(trim(p_bill_to), ''), 'guest'),
    p_tax_treatment
  )
  RETURNING id, created_at INTO v_line_id, v_created;

  v_result := jsonb_build_object(
    'ok', true,
    'line_id', v_line_id,
    'folio_id', p_folio_id,
    'source_type', coalesce(nullif(trim(p_source_type), ''), 'service'),
    'description', coalesce(nullif(trim(p_description), ''), 'Charge'),
    'total_btn', coalesce(p_total_btn, 0),
    'gst_btn', coalesce(p_gst_btn, 0),
    'created_at', v_created,
    'already_exists', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'post_folio_charge', v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_folio_charge_atomic(
  uuid, uuid, uuid, uuid, text, uuid, text, numeric, numeric, numeric,
  boolean, numeric, numeric, boolean, date, uuid, text, text, numeric, numeric, boolean, text
) FROM public;
GRANT EXECUTE ON FUNCTION public.post_folio_charge_atomic(
  uuid, uuid, uuid, uuid, text, uuid, text, numeric, numeric, numeric,
  boolean, numeric, numeric, boolean, date, uuid, text, text, numeric, numeric, boolean, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- check_in_guest_atomic: lock booking (+ optional room), mark checked_in
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in_guest_atomic(
  p_property_id uuid,
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_room_unit_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_booking public.bookings%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_property_id IS NULL OR p_booking_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id, booking_id, and idempotency_key are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND property_id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for property';
  END IF;

  IF v_booking.status = 'checked_out' THEN
    RAISE EXCEPTION 'Cannot check in a checked-out booking';
  END IF;

  IF p_room_unit_id IS NOT NULL THEN
    PERFORM 1
    FROM public.room_units
    WHERE id = p_room_unit_id AND property_id = p_property_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room unit not found for property';
    END IF;

    UPDATE public.room_units
       SET hk_status = CASE WHEN hk_status = 'ooo' THEN hk_status ELSE 'occupied' END,
           updated_at = now()
     WHERE id = p_room_unit_id AND property_id = p_property_id;
  END IF;

  UPDATE public.bookings
     SET status = 'checked_in'
   WHERE id = p_booking_id AND property_id = p_property_id;

  v_result := jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'status', 'checked_in',
    'room_unit_id', p_room_unit_id,
    'already_exists', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'check_in_guest', v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_guest_atomic(uuid, uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.check_in_guest_atomic(uuid, uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- settle_checkout_atomic: lock booking+folio, checkout, dirty rooms
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_checkout_atomic(
  p_property_id uuid,
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_allow_balance boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text := p_idempotency_key::text;
  v_cached jsonb;
  v_booking public.bookings%ROWTYPE;
  v_folio_id uuid;
  v_balance numeric := 0;
  v_dirty jsonb;
  v_result jsonb;
BEGIN
  IF p_property_id IS NULL OR p_booking_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id, booking_id, and idempotency_key are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND property_id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for property';
  END IF;

  IF v_booking.status IS DISTINCT FROM 'checked_in' THEN
    RAISE EXCEPTION 'Booking must be checked_in to checkout';
  END IF;

  IF v_booking.checked_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Booking already checked out';
  END IF;

  SELECT f.id INTO v_folio_id
  FROM public.folios f
  WHERE f.booking_id = p_booking_id AND f.property_id = p_property_id
  ORDER BY f.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_folio_id IS NOT NULL THEN
    SELECT coalesce(sum(
      CASE
        WHEN fl.status = 'voided' THEN 0
        WHEN lower(coalesce(fl.source_type, '')) IN ('payment', 'deposit') THEN fl.total_btn
        ELSE fl.total_btn
      END
    ), 0)
    INTO v_balance
    FROM public.folio_lines fl
    WHERE fl.folio_id = v_folio_id
      AND fl.status IS DISTINCT FROM 'voided';

    IF abs(v_balance) > 0.009 AND NOT coalesce(p_allow_balance, false) THEN
      RAISE EXCEPTION 'Folio balance is Nu % — settle or allow balance to checkout',
        round(v_balance::numeric, 2);
    END IF;
  END IF;

  v_dirty := public.desk_release_check_out_rooms(p_property_id, p_booking_id);

  UPDATE public.bookings
     SET status = 'checked_out',
         checked_out_at = now()
   WHERE id = p_booking_id AND property_id = p_property_id;

  v_result := jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'folio_id', v_folio_id,
    'balance', v_balance,
    'allow_balance', coalesce(p_allow_balance, false),
    'rooms', v_dirty,
    'already_exists', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'settle_checkout', v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_checkout_atomic(uuid, uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.settle_checkout_atomic(uuid, uuid, uuid, boolean) TO service_role;

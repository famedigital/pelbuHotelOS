-- Atomic folio payment: lock folio, insert payment + credit folio line, money_idempotency.
-- Additive for Hotel OS v2 adapters (service_role only).

CREATE OR REPLACE FUNCTION public.post_folio_payment_atomic(
  p_property_id uuid,
  p_folio_id uuid,
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_amount_btn numeric,
  p_method text,
  p_staff_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_kind text DEFAULT 'settlement'
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
  v_payment_id uuid;
  v_line_id uuid;
  v_method text;
  v_amount numeric;
  v_existing_pay uuid;
  v_result jsonb;
BEGIN
  IF p_property_id IS NULL OR p_folio_id IS NULL OR p_booking_id IS NULL
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id, folio_id, booking_id, and idempotency_key are required';
  END IF;

  v_amount := round(coalesce(p_amount_btn, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'amount_btn must be > 0';
  END IF;

  -- Normalize desk tender labels onto payments_method_check values
  v_method := lower(trim(coalesce(p_method, 'cash')));
  v_method := CASE v_method
    WHEN 'transfer' THEN 'bank'
    WHEN 'mbob' THEN 'bank_qr'
    WHEN 'other' THEN 'bank'
    WHEN 'bank_transfer' THEN 'bank'
    ELSE v_method
  END;
  IF v_method NOT IN (
    'cash', 'bank', 'card', 'agent_credit', 'bank_qr', 'pay_bt', 'deposit'
  ) THEN
    RAISE EXCEPTION 'unsupported payment method: %', p_method;
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('already_exists', true);
  END IF;

  -- Unique payments.idempotency_key replay
  SELECT id INTO v_existing_pay
  FROM public.payments
  WHERE property_id = p_property_id
    AND idempotency_key = v_key
  LIMIT 1;
  IF v_existing_pay IS NOT NULL THEN
    v_result := jsonb_build_object(
      'ok', true,
      'payment_id', v_existing_pay,
      'folio_id', p_folio_id,
      'amount_btn', v_amount,
      'already_exists', true
    );
    INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
    VALUES (p_property_id, v_key, 'post_folio_payment', v_result)
    ON CONFLICT (property_id, idempotency_key) DO NOTHING;
    RETURN v_result;
  END IF;

  SELECT * INTO v_folio
  FROM public.folios
  WHERE id = p_folio_id AND property_id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folio not found for property';
  END IF;

  IF v_folio.booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'Folio does not belong to booking';
  END IF;

  IF v_folio.status IS NOT NULL AND v_folio.status IN ('settled', 'closed') THEN
    RAISE EXCEPTION 'Cannot post payment to a closed or settled folio';
  END IF;

  INSERT INTO public.payments (
    property_id,
    folio_id,
    booking_id,
    method,
    amount_btn,
    kind,
    notes,
    idempotency_key,
    confirmation_status,
    confirmed_at,
    confirmed_by
  ) VALUES (
    p_property_id,
    p_folio_id,
    p_booking_id,
    v_method,
    v_amount,
    coalesce(nullif(trim(p_kind), ''), 'settlement'),
    p_notes,
    v_key,
    'confirmed',
    now(),
    CASE WHEN p_staff_id IS NULL THEN NULL ELSE p_staff_id::text END
  )
  RETURNING id INTO v_payment_id;

  INSERT INTO public.folio_lines (
    folio_id,
    booking_id,
    source_type,
    source_id,
    description,
    qty,
    unit_price_btn,
    amount_btn,
    gst_applicable,
    gst_btn,
    total_btn,
    status,
    bill_to
  ) VALUES (
    p_folio_id,
    p_booking_id,
    'payment',
    v_payment_id,
    'Payment · ' || v_method,
    1,
    -v_amount,
    -v_amount,
    false,
    0,
    -v_amount,
    'posted',
    'guest'
  )
  RETURNING id INTO v_line_id;

  v_result := jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'folio_line_id', v_line_id,
    'folio_id', p_folio_id,
    'booking_id', p_booking_id,
    'amount_btn', v_amount,
    'method', v_method,
    'already_exists', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'post_folio_payment', v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.post_folio_payment_atomic(
  uuid, uuid, uuid, uuid, numeric, text, uuid, text, text
) FROM public;
GRANT EXECUTE ON FUNCTION public.post_folio_payment_atomic(
  uuid, uuid, uuid, uuid, numeric, text, uuid, text, text
) TO service_role;

COMMENT ON FUNCTION public.post_folio_payment_atomic(
  uuid, uuid, uuid, uuid, numeric, text, uuid, text, text
) IS
  'Atomic payment + credit folio line with FOR UPDATE folio lock and money_idempotency.';

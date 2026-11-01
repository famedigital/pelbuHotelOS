-- StayHub atomic fiscal checkout (real schema: bookings / folio_lines / money_idempotency).
-- Spec docs/architecture/STAYHUB-FOLIO-REDESIGN.md — maps stays→bookings, folio_charges→folio_lines.

CREATE OR REPLACE FUNCTION public.stayhub_checkout_atomic(
  p_property_id uuid,
  p_booking_id uuid,
  p_idempotency_key uuid,
  p_cashier_id uuid DEFAULT NULL,
  p_allow_balance boolean DEFAULT false,
  p_issue_invoice boolean DEFAULT true
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
  v_guest_balance numeric := 0;
  v_year text;
  v_seq bigint;
  v_doc_no text;
  v_fiscal_id uuid;
  v_dirty jsonb;
  v_result jsonb;
  v_existing_inv text;
BEGIN
  IF p_property_id IS NULL OR p_booking_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'property_id, booking_id, and idempotency_key are required';
  END IF;

  SELECT result INTO v_cached
  FROM public.money_idempotency
  WHERE property_id = p_property_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('already_exists', true, 'success', true);
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND property_id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stay record not found');
  END IF;

  IF v_booking.status IS DISTINCT FROM 'checked_in' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Booking must be checked_in to checkout'
    );
  END IF;

  IF v_booking.checked_out_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking already checked out');
  END IF;

  SELECT f.id INTO v_folio_id
  FROM public.folios f
  WHERE f.booking_id = p_booking_id AND f.property_id = p_property_id
  ORDER BY f.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_folio_id IS NOT NULL THEN
    -- Guest-visible stream: guest bill_to charges + all payments/deposits
    SELECT coalesce(sum(
      CASE
        WHEN fl.status = 'voided' THEN 0
        WHEN lower(coalesce(fl.source_type, '')) IN ('payment', 'deposit') THEN fl.total_btn
        WHEN coalesce(fl.bill_to, 'guest') = 'agent' THEN 0
        ELSE fl.total_btn
      END
    ), 0)
    INTO v_guest_balance
    FROM public.folio_lines fl
    WHERE fl.folio_id = v_folio_id;

    IF abs(v_guest_balance) > 0.01 AND NOT coalesce(p_allow_balance, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',
        'Cannot checkout: Outstanding guest folio balance of BTN ' ||
          round(v_guest_balance::numeric, 2)::text
      );
    END IF;

    SELECT fd.doc_no INTO v_existing_inv
    FROM public.fiscal_documents fd
    WHERE fd.property_id = p_property_id
      AND fd.folio_id = v_folio_id
      AND fd.doc_kind = 'invoice'
      AND fd.status = 'issued'
    LIMIT 1;
  END IF;

  IF coalesce(p_issue_invoice, true) AND v_folio_id IS NOT NULL AND v_existing_inv IS NULL THEN
    v_year := to_char(timezone('Asia/Thimphu', now()), 'YYYY');
    v_seq := public.next_property_sequence(p_property_id, 'invoice:' || v_year);
    v_doc_no := 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO public.fiscal_documents (
      property_id,
      doc_kind,
      doc_no,
      fiscal_year,
      sequence_no,
      folio_id,
      booking_id,
      issued_by,
      status,
      meta
    ) VALUES (
      p_property_id,
      'invoice',
      v_doc_no,
      v_year::smallint,
      v_seq,
      v_folio_id,
      p_booking_id,
      coalesce(p_cashier_id::text, 'stayhub'),
      'issued',
      jsonb_build_object('source', 'stayhub_checkout_atomic')
    )
    RETURNING id INTO v_fiscal_id;
  ELSE
    v_doc_no := v_existing_inv;
  END IF;

  IF v_folio_id IS NOT NULL THEN
    UPDATE public.folios
       SET status = CASE
             WHEN abs(v_guest_balance) <= 0.01 THEN 'settled'
             ELSE 'closed'
           END,
           closed_at = now()
     WHERE id = v_folio_id
       AND status = 'open';
  END IF;

  v_dirty := public.desk_release_check_out_rooms(p_property_id, p_booking_id);

  UPDATE public.bookings
     SET status = 'checked_out',
         checked_out_at = now()
   WHERE id = p_booking_id AND property_id = p_property_id;

  v_result := jsonb_build_object(
    'success', true,
    'ok', true,
    'booking_id', p_booking_id,
    'folio_id', v_folio_id,
    'guest_balance', v_guest_balance,
    'invoice_number', v_doc_no,
    'fiscal_document_id', v_fiscal_id,
    'rooms', v_dirty,
    'checked_out_at', now(),
    'already_exists', false
  );

  INSERT INTO public.money_idempotency (property_id, idempotency_key, action, result)
  VALUES (p_property_id, v_key, 'stayhub_checkout', v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.stayhub_checkout_atomic(uuid, uuid, uuid, uuid, boolean, boolean)
  FROM public;
GRANT EXECUTE ON FUNCTION public.stayhub_checkout_atomic(uuid, uuid, uuid, uuid, boolean, boolean)
  TO service_role;

COMMENT ON FUNCTION public.stayhub_checkout_atomic(uuid, uuid, uuid, uuid, boolean, boolean) IS
  'StayHub settle & checkout: lock booking/folio, guest-stream balance gate, gapless INV, dirty rooms, checked_out.';

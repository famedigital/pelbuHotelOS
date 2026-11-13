-- Soultrips reservation SOA v3 + mBOb → Innora Pelbu Olakha (desk + agent portal)
-- Source: Downloads/soultrips/reservation (12 Nov 2026)
-- Idempotent: safe to re-run. Voids prior SOA-cutover lines/fiscals tagged in meta/reason.

BEGIN;

DO $$
DECLARE
  v_property uuid := 'd06e89f8-86e6-4201-bbd2-5e115d422357';
  v_agent uuid := '4a072010-577e-4fe4-8974-d09bc4fe0cc5';
  r record;
  v_folio uuid;
  v_line uuid;
  v_pay uuid;
  v_seq bigint;
  v_agent_sum numeric;
  v_pay_sum numeric;
BEGIN
  CREATE TEMP TABLE soa_bills (
    ref text PRIMARY KEY,
    doc_no text NOT NULL,
    amount numeric NOT NULL,
    paid boolean NOT NULL,
    booking_id uuid NOT NULL,
    guest_label text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO soa_bills (ref, doc_no, amount, paid, booking_id, guest_label) VALUES
    ('02097', 'SSFN3922-3923', 9333.33, true,  'e07ff64f-4501-4282-91b2-8989a6d07a45', 'Damyanti'),
    ('02089', 'SSFN40020',     10666.67, true,  '118bf807-fdff-47a7-9bfd-34e0c9e562dc', 'Ref 02089'),
    ('02070', 'SSFN40093',     16000.00, true,  '472d00e4-c33b-4016-8833-610d493ca78c', 'Tony'),
    ('02100', 'SSFN4420-4421', 16000.00, false, 'b1722a85-4743-46c2-9968-c15e23ff3c39', 'Karen Meyers'),
    ('LAST-MOMENT', 'SSFN40095-40098', 40000.00, false, 'c810bc31-8046-4e86-a08f-1f58bdd0d9f3', 'Last Moment Booking'),
    ('02131', 'SSFN40071', 8000.00, false, 'abf0e447-16e2-4948-aa1f-52a304c7734e', 'Mr. Thanh Quan Philips'),
    ('01929', 'SSFN4405', 10667.00, false, 'e63f7213-abf3-47a1-af9d-25da2ba41033', 'Ref 01929'),
    ('STEPHANIE', 'SSFN4093', 7048.00, false, '9cdb4e29-cbf7-4fb2-9d98-5c3afc24139c', 'Ms. Stephanie Yu'),
    ('02118', 'SSFN4415', 12000.00, false, '599597f3-6f1c-4d0d-8b28-93247e59cebc', 'Ref 02118'),
    ('01984', 'SSFN4417', 10667.00, false, '62335219-4daa-4474-9146-6775ee541b8c', 'Ref 01984'),
    ('02020', 'SSFN4423', 10286.00, false, 'b3a3db6d-1ed8-48ae-943c-94a57a8282f6', 'Ref 02020'),
    ('01963', 'SSFN4424', 8000.00, false, 'f3af4319-d29f-4883-9316-8ccbf943e61e', 'Ref 01963'),
    ('02120', 'SSFN4445-4446', 7429.00, false, '26f27f8c-9a7c-4ba1-bf2b-4ac02fc0a7cf', 'Ref 02120'),
    ('02041', 'SSFN4447-4448', 18667.00, false, 'fe5f0034-b6c5-470a-8bc5-498702e77edd', 'Ref 02041'),
    ('02153', 'SSFN4444', 10667.00, false, 'd9e14f95-35d4-415d-a274-c51e1b9852d0', 'Lisa Higgins'),
    ('01749', 'SSFN4460', 10667.00, false, '0a7db426-0984-449a-9159-837c42798ddc', 'Ref 01749'),
    ('01895', 'SSFN4805-4808', 39200.00, false, 'bca593e0-4bed-446c-a4fd-0e0f1b45f0eb', 'Ref 01895'),
    ('01668', 'SSFN44106', 10667.00, false, 'a512d5cf-f2d2-48d1-a4f2-d8d265e91270', 'Jeanni Soh Xuan Ci'),
    ('01983', 'SSFN4511', 8000.00, false, '9babb0d4-ac06-44b2-8b3d-efb85f064f3a', 'Ref 01983'),
    ('02130', 'SSFN4801', 8400.00, false, '9edd5615-de66-4df4-b267-d3d112477bca', 'Ref 02130'),
    ('02160', 'SSFN4802', 8400.00, false, 'db9349a9-b82f-4ad4-b1c2-974cee14a197', 'Ref 02160'),
    ('02016', 'SSFN4601-4602', 22400.00, false, 'b0623bf8-da9f-4b91-921b-20123f1815ee', 'Ref 02016');

  -- Sanity: amounts
  SELECT coalesce(sum(amount) FILTER (WHERE NOT paid),0), coalesce(sum(amount) FILTER (WHERE paid),0)
    INTO v_agent_sum, v_pay_sum FROM soa_bills;
  IF v_agent_sum <> 267165.00 THEN
    RAISE EXCEPTION 'Open SOA sum % <> 267165', v_agent_sum;
  END IF;
  IF v_pay_sum <> 36000.00 THEN
    RAISE EXCEPTION 'Paid SOA sum % <> 36000', v_pay_sum;
  END IF;

  -- Link all primary bookings to SOULTRIPS
  UPDATE public.bookings b
  SET agent_id = v_agent
  FROM soa_bills s
  WHERE b.id = s.booking_id AND b.property_id = v_property
    AND (b.agent_id IS DISTINCT FROM v_agent);

  -- Zero agent AR on sibling bookings that share a voucher but are not the primary SOA folio
  -- (void their non-payment posted lines)
  UPDATE public.folio_lines fl
  SET status = 'voided',
      voided_at = now(),
      voided_by = 'cutover-soa-v3',
      void_reason = 'Soultrips SOA v3: sibling stay; bill consolidated on primary folio'
  FROM public.folios f
  JOIN public.bookings b ON b.id = f.booking_id
  WHERE fl.folio_id = f.id
    AND fl.status = 'posted'
    AND fl.source_type IS DISTINCT FROM 'payment'
    AND b.property_id = v_property
    AND b.id NOT IN (SELECT booking_id FROM soa_bills)
    AND (
      (b.notes ~ '02100' AND EXISTS (SELECT 1 FROM soa_bills WHERE ref='02100'))
      OR (b.notes ~ '01895' AND EXISTS (SELECT 1 FROM soa_bills WHERE ref='01895'))
      OR (b.notes ~ '01749' AND EXISTS (SELECT 1 FROM soa_bills WHERE ref='01749'))
      OR (b.notes ~ '01963' AND EXISTS (SELECT 1 FROM soa_bills WHERE ref='01963'))
      OR (b.notes ~ '02120' AND EXISTS (SELECT 1 FROM soa_bills WHERE ref='02120'))
      OR (
        b.check_in = DATE '2026-10-21' AND b.check_out = DATE '2026-10-23'
        AND b.notes ILIKE '%Soul Trip%'
        AND b.id <> 'c810bc31-8046-4e86-a08f-1f58bdd0d9f3'::uuid
      )
    );

  FOR r IN SELECT * FROM soa_bills ORDER BY ref LOOP
    -- Ensure folio
    SELECT f.id INTO v_folio
    FROM public.folios f
    WHERE f.booking_id = r.booking_id
    ORDER BY CASE WHEN f.status = 'open' THEN 0 WHEN f.status = 'closed' THEN 1 ELSE 2 END,
             f.created_at
    LIMIT 1;

    IF v_folio IS NULL THEN
      INSERT INTO public.folios (property_id, booking_id, folio_type, label, status, agent_id)
      VALUES (v_property, r.booking_id, 'guest', 'Agency · ' || r.guest_label, 'open', v_agent)
      RETURNING id INTO v_folio;
    ELSE
      UPDATE public.folios
      SET agent_id = v_agent,
          status = 'open',
          closed_at = NULL,
          label = coalesce(nullif(label,''), 'Agency · ' || r.guest_label)
      WHERE id = v_folio;
    END IF;

    -- Void existing non-payment charge lines on primary folio (realign to SOA amount)
    UPDATE public.folio_lines
    SET status = 'voided',
        voided_at = now(),
        voided_by = 'cutover-soa-v3',
        void_reason = 'Soultrips SOA v3 realign to reservation PDF amount'
    WHERE folio_id = v_folio
      AND status = 'posted'
      AND source_type IS DISTINCT FROM 'payment';

    -- Void prior SOA payment credit lines on this folio (we recreate for paid)
    UPDATE public.folio_lines
    SET status = 'voided',
        voided_at = now(),
        voided_by = 'cutover-soa-v3',
        void_reason = 'Soultrips SOA v3 payment realign'
    WHERE folio_id = v_folio
      AND status = 'posted'
      AND source_type = 'payment'
      AND (description ILIKE '%SOA v3%' OR description ILIKE '%mBOb%' OR description ILIKE 'Payment%');

    -- Also void any remaining payment credits so paid bills can be reset cleanly
    UPDATE public.folio_lines
    SET status = 'voided',
        voided_at = now(),
        voided_by = 'cutover-soa-v3',
        void_reason = 'Soultrips SOA v3 clear payment credits before rebuild'
    WHERE folio_id = v_folio
      AND status = 'posted'
      AND source_type = 'payment';

    -- Post SOA agency charge
    INSERT INTO public.folio_lines (
      folio_id, booking_id, source_type, description,
      qty, unit_price_btn, amount_btn, gst_applicable, gst_btn, total_btn,
      status, bill_to, bill_to_set_by, bill_to_reason,
      service_charge_applied, tax_treatment
    ) VALUES (
      v_folio, r.booking_id, 'adjustment',
      'SOULTRIPS SOA v3 · ' || r.doc_no || ' · ' || r.guest_label || ' · ref ' || r.ref,
      1, r.amount, r.amount, false, 0, r.amount,
      'posted', 'agent', 'cutover-soa-v3', 'Reservation folder Statement of Account 12 Nov 2026',
      true, 'inclusive'
    ) RETURNING id INTO v_line;

    -- Void conflicting issued fiscal invoices on this folio
    UPDATE public.fiscal_documents
    SET status = 'void',
        void_reason = 'Replaced by Soultrips SOA folio no ' || r.doc_no,
        voided_at = now()
    WHERE folio_id = v_folio
      AND status = 'issued'
      AND doc_kind IN ('invoice', 'receipt')
      AND doc_no IS DISTINCT FROM r.doc_no;

    -- Also void master bills that would confuse agent portal if any
    UPDATE public.fiscal_documents
    SET status = 'void',
        void_reason = 'Replaced by Soultrips SOA folio no ' || r.doc_no,
        voided_at = now()
    WHERE folio_id = v_folio
      AND status = 'issued'
      AND doc_no LIKE 'PSBN-%';

    -- Upsert SSFN fiscal document
    v_seq := NULLIF(regexp_replace(r.doc_no, '\D', '', 'g'), '')::bigint;
    IF v_seq IS NULL OR v_seq <= 0 THEN
      v_seq := 900000 + (random()*1000)::int;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.fiscal_documents
      WHERE property_id = v_property AND doc_no = r.doc_no
    ) THEN
      UPDATE public.fiscal_documents
      SET status = 'issued',
          void_reason = NULL,
          voided_at = NULL,
          folio_id = v_folio,
          booking_id = r.booking_id,
          doc_kind = 'invoice',
          fiscal_year = 2026,
          sequence_no = v_seq,
          issued_at = timestamptz '2026-11-12 12:00:00+06',
          issued_by = 'cutover-soa-v3',
          meta = jsonb_build_object(
            'source', 'soultrips_reservation_soa_v3',
            'soa_ref', r.ref,
            'amount_btn', r.amount,
            'paid', r.paid,
            'guest', r.guest_label
          )
      WHERE property_id = v_property AND doc_no = r.doc_no;
    ELSE
      INSERT INTO public.fiscal_documents (
        property_id, doc_kind, doc_no, fiscal_year, sequence_no,
        folio_id, booking_id, issued_at, issued_by, status, meta
      ) VALUES (
        v_property, 'invoice', r.doc_no, 2026, v_seq,
        v_folio, r.booking_id, timestamptz '2026-11-12 12:00:00+06', 'cutover-soa-v3', 'issued',
        jsonb_build_object(
          'source', 'soultrips_reservation_soa_v3',
          'soa_ref', r.ref,
          'amount_btn', r.amount,
          'paid', r.paid,
          'guest', r.guest_label
        )
      );
    END IF;

    -- Payments for mBOb settled bills
    IF r.paid THEN
      -- Mark older payments on this folio as noted (keep rows; avoid double AR by matching credit lines)
      UPDATE public.payments
      SET notes = coalesce(notes,'') || ' [superseded by SOA v3 mBOb ' || r.doc_no || ']',
          confirmation_status = 'rejected'
      WHERE folio_id = v_folio
        AND confirmation_status = 'confirmed'
        AND (idempotency_key IS NULL OR idempotency_key NOT LIKE 'soa-v3-mbob-%');

      IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE property_id = v_property
          AND idempotency_key = 'soa-v3-mbob-' || r.ref
      ) THEN
        UPDATE public.payments
        SET amount_btn = r.amount,
            method = 'bank',
            reference = 'mBOb',
            notes = 'Soultrips mBOb payment statement 12 Nov 2026 · ' || r.doc_no,
            kind = 'settlement',
            confirmation_status = 'confirmed',
            confirmed_at = timestamptz '2026-11-12 12:00:00+06',
            folio_id = v_folio,
            booking_id = r.booking_id
        WHERE property_id = v_property
          AND idempotency_key = 'soa-v3-mbob-' || r.ref
        RETURNING id INTO v_pay;
      ELSE
        INSERT INTO public.payments (
          property_id, folio_id, booking_id, method, amount_btn, reference, notes,
          kind, idempotency_key, confirmation_status, confirmed_at, confirmed_by
        ) VALUES (
          v_property, v_folio, r.booking_id, 'bank', r.amount, 'mBOb',
          'Soultrips mBOb payment statement 12 Nov 2026 · ' || r.doc_no,
          'settlement', 'soa-v3-mbob-' || r.ref, 'confirmed',
          timestamptz '2026-11-12 12:00:00+06', 'cutover-soa-v3'
        ) RETURNING id INTO v_pay;
      END IF;

      INSERT INTO public.folio_lines (
        folio_id, booking_id, source_type, source_id, description,
        qty, unit_price_btn, amount_btn, gst_applicable, gst_btn, total_btn,
        status, bill_to
      ) VALUES (
        v_folio, r.booking_id, 'payment', v_pay,
        'Payment · mBOb · SOA v3 · ' || r.doc_no,
        1, -r.amount, -r.amount, false, 0, -r.amount,
        'posted', 'agent'
      );
    END IF;

    -- Close settled paid folios; leave unpaid open/closed as closed for history
    IF r.paid THEN
      UPDATE public.folios SET status = 'settled', closed_at = timestamptz '2026-11-12 12:00:00+06' WHERE id = v_folio;
    ELSE
      UPDATE public.folios SET status = 'closed', closed_at = timestamptz '2026-11-12 12:00:00+06' WHERE id = v_folio;
    END IF;
  END LOOP;

  -- credit_used = SOA outstanding only (reservation folder collection truth)
  UPDATE public.agent_property_links
  SET credit_used = 267165.00
  WHERE agent_id = v_agent AND property_id = v_property;

  UPDATE public.agents
  SET credit_used = 267165.00
  WHERE id = v_agent;

END $$;

COMMIT;

-- Verification
\echo === VERIFY open SSFN invoices ===
SELECT fd.doc_no, fd.meta->>'soa_ref' AS ref, (fd.meta->>'amount_btn')::numeric AS amount,
       fd.meta->>'paid' AS paid, fd.status,
       (SELECT sum(fl.total_btn) FROM folio_lines fl
         WHERE fl.folio_id=fd.folio_id AND fl.status='posted' AND fl.bill_to='agent') AS agent_net
FROM fiscal_documents fd
WHERE fd.property_id='d06e89f8-86e6-4201-bbd2-5e115d422357'
  AND fd.meta->>'source'='soultrips_reservation_soa_v3'
  AND fd.status='issued'
ORDER BY fd.doc_no;

\echo === totals ===
SELECT
  count(*) FILTER (WHERE (meta->>'paid')::boolean IS NOT TRUE) AS open_count,
  coalesce(sum((meta->>'amount_btn')::numeric) FILTER (WHERE (meta->>'paid')::boolean IS NOT TRUE),0) AS open_amount,
  count(*) FILTER (WHERE (meta->>'paid')::boolean IS TRUE) AS paid_count,
  coalesce(sum((meta->>'amount_btn')::numeric) FILTER (WHERE (meta->>'paid')::boolean IS TRUE),0) AS paid_amount
FROM fiscal_documents
WHERE property_id='d06e89f8-86e6-4201-bbd2-5e115d422357'
  AND meta->>'source'='soultrips_reservation_soa_v3'
  AND status='issued';

\echo === SOULTRIPS credit_used ===
SELECT a.login_code, apl.credit_limit, apl.credit_used
FROM agent_property_links apl
JOIN agents a ON a.id=apl.agent_id
JOIN properties p ON p.id=apl.property_id
WHERE a.login_code='SOULTRIPS' AND p.slug='pelbu-olakha';

---
name: atomic-ledger-safety
description: >-
  Rules and patterns for atomic transactions, financial ledger integrity,
  concurrency protection, idempotency, and tax sequence safety in Hotel OS.
  Use when editing Server Actions, database queries, checkout, payments, or folio postings.
---

# Atomic Ledger Safety & Financial Concurrency

In a hotel PMS/ERP, non-atomic database mutations cause orphan ledger entries, overbooking, and financial drift. Follow these patterns whenever writing backend or data-mutation logic.

**Schema map (examples below are patterns — use live Hotel OS tables):** `stays` → `bookings`; `folio_charges` → `folio_lines`; sequences → `property_sequences` / `next_property_sequence`; payments idempotency → `payments.idempotency_key` + `money_idempotency`.

---

## 1. The Atomic Transaction Rule

**Banned Pattern (Vibe-coded race hazard):**
```ts
// ❌ WRONG: Non-atomic multi-step server action
await supabase.from("folios").insert({ booking_id, amount });
// If connection drops here, inventory is never reserved but folio is charged!
await supabase.from("stays").update({ status: "checked_in" }).eq("id", stayId);
await supabase.from("room_inventory").update({ is_occupied: true }).eq("room_id", roomId);
```

**Required Pattern (Postgres Atomic RPC / PL/pgSQL):**
Enclose multi-step transactions in a PostgreSQL stored procedure with row locks (`FOR UPDATE`):
```sql
CREATE OR REPLACE FUNCTION check_in_guest_atomic(
  p_property_id UUID,
  p_stay_id UUID,
  p_room_id UUID,
  p_idempotency_key UUID
) RETURNS JSONB AS $$
DECLARE
  v_stay RECORD;
BEGIN
  -- 1. Check idempotency
  IF EXISTS (SELECT 1 FROM idempotency_keys WHERE key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Duplicate request ignored');
  END IF;

  -- 2. Lock the room row to prevent concurrent assignment
  PERFORM 1 FROM rooms WHERE id = p_room_id AND property_id = p_property_id FOR UPDATE;

  -- 3. Perform atomic state changes
  UPDATE stays SET status = 'checked_in', room_id = p_room_id WHERE id = p_stay_id;
  INSERT INTO folio_charges (stay_id, amount, description) VALUES (p_stay_id, 0, 'Check-in confirmed');
  INSERT INTO idempotency_keys (key, action) VALUES (p_idempotency_key, 'check_in');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Mandatory Idempotency on Money & Checkout Routes

1. All Server Actions modifying money, posting laundry/POS charges, or issuing refunds MUST accept an `idempotencyKey: string` argument generated on the client.
2. In case of network stutter or user double-clicking, the server returns the cached response of the initial transaction rather than executing a duplicate charge.

---

## 3. Gapless Fiscal Invoicing (Bhutan DRC Compliance)

1. Never calculate fiscal invoice numbers via `SELECT count(*) + 1`. This leads to race conditions and duplicate invoice numbers under load.
2. Rely strictly on transactional sequences (`property_sequences`) locked per-property:
   ```sql
   UPDATE property_sequences
   SET last_number = last_number + 1
   WHERE property_id = p_property_id AND sequence_type = 'fiscal_invoice'
   RETURNING last_number;
   ```
3. Format as `INV-YYYY-XXXX` gaplessly.

---

## 4. Reversals Over Deletion

- Folios, posted charges, and payments are **immutable**.
- NEVER run `DELETE FROM folio_charges WHERE id = ...`.
- All adjustments and corrections MUST be recorded as a credit/void reversal row (`voidFolioLineWithReversal`) referencing the original charge ID with an audited operator reason.

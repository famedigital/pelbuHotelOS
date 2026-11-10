# Hotel OS v2 — Agent (partner) portal

> External face of module **12 · Agents**. Spec from Claude plan §3 module 12 + owner decisions.
> Related: [MODULES.md](./MODULES.md) · [SOURCE-MAP.md](./SOURCE-MAP.md) · [OPERATIONS-FLOW.md](./OPERATIONS-FLOW.md)

## Purpose

Tour operators (B2B) self-serve calendar, inventory, rates, booking, documents, change requests, and money — without calling the desk for routine work.

## Routes (`/partner/*`)

| Screen | What agents see / do |
|---|---|
| **Calendar** | Masked rack: room, date, state, `owner_agent_id` only via `v2.partner_calendar`. Guest name + ref **only** where `owner_agent_id = me`. Other parties' rows: grey, no names/ids. |
| **Inventory** | Availability table by room type × date (sellable counts after OOO/blocks). |
| **Rates** | Agent tier rate card (net display with live SC+GST totals from `quote()`). |
| **Book** | Multi-line Fast Book → `createReservation` (source `agent_portal`), status `held` until desk confirms. |
| **My bookings** | Own bookings only; multi-select → reports / XLSX export. |
| **Booking detail** | Guests, documents (passport/CID upload to `v2-docs`), guide, driver; **details save directly**; dates/rooms/meal plan → **change request** for desk approval. |
| **Change requests** | Queue of pending date/room/meal edits; status after desk decide. |
| **Money** | Agency invoices (PSBN), payments, payment-proof upload → desk verify. |

## Owner decisions (locked)

- Agent **edits**: profile/guest details save directly; **dates / rooms / meal plan** require desk approval (change request).
- Calendar: others' bookings **grey**; names only on own bookings.
- Auth: Supabase Auth with `app_metadata.app = 'v2'`, `tenant_id`, `role`; RLS scoped to agent. **No** v1 service-role bypass.

## Masking (`v2.partner_calendar`)

- Trigger-maintained from bookings / assignments / room status.
- Columns for others: room, date, state, `owner_agent_id` — **no** guest name, booking id, or agent identity beyond ownership bit for "mine".
- Realtime: agents subscribe **only** to `v2.partner_calendar` (+ own booking rows via RLS).

## Desk-side Agents module (owns the data)

- Screens: agent list, dossier (MoU, credit, portal users, AR ledger + aging, statements, proofs, comms).
- Actions: create agent + portal user (code + PIN), set tier/credit/MoU, verify proof → payment, statement, credit hold, approve/reject change requests.
- Emits: `agent.credit_hold`, `agent.payment_verified`, `agent.updated`.
- Listens: `fiscal_doc.issued`, `payment.received`, `booking.*`, `agent.payment_proof_uploaded`.

## Merge / Copy sources

See [SOURCE-MAP.md](./SOURCE-MAP.md) MERGE row **Agents + `/partner`** and COPY rows for AgentStaysTable / filters / XLSX / statements.

## Leave out from Waves

Do not port read-mostly Wave agent pages or service-role portal tokens. Reinvent masking + change requests.

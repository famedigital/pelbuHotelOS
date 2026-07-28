# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Do not ask clarifying questions.** If something is ambiguous, use the **Locked defaults** below and keep coding. **Edit the allowed files only.**

## Context (do not re-do)
- Check-in polish is **done** — do not touch `/erp/check-in`
- Finance / bank recon / HR / inventory / reports / channel are **Cursor-owned** — do not touch
- Fast-book grid/drawer/voucher files may already exist — polish to match acceptance, do not invent actions
- Do not invent schema, RLS, or new server actions

## Task (Fast book only — skip POS this round)
Rebuild `/erp/fast-book` UX:

1. Top: **date strip** — `check_in` + `check_out` + `adults` in one compact row
2. Middle: **Excel-like qty grid** — rows = room types (guest first, then guide/driver), one qty input/stepper per row (`name={`qty_${code}`}`), show `unit_count` as max hint
3. Right / bottom drawer: opens when any qty > 0 — fields for guest, agent, guide, source, payment, notes; primary **Save booking** button lives here
4. After `state.ok`: split view — **Desk invoice** (may show “totals pending desk” text only — **do not invent Nu amounts**) + **Agent voucher** (print-friendly) with **zero prices/rates**

## Locked defaults (no questions)
- Drawer: desktop = right side panel (~360px); mobile = full-width bottom sheet
- Grid: simple HTML table / CSS grid — no external spreadsheet lib
- Invoice amounts: if you have no totals from the action, show rooms + nights + “Rates applied on save — see folio” — never fake Nu
- Voucher: booking ref, dates, nights, guest name/phone, agent name (if any), room lines as `qty × name`, guide number — **no Nu, no rate tier money**
- Print: `window.print()` on voucher section with a print CSS class — good enough
- Widen `fast-book/page.tsx` max-width to `max-w-[1200px]` to fit grid + drawer
- Keep ivory/espresso/maroon/gold; no purple; minimal borders; no card soup
- Skip POS entirely this round

## Allowed files
- `web/src/components/erp/FastBookForm.tsx`
- `web/src/components/erp/FastBookGrid.tsx` (new if needed)
- `web/src/components/erp/FastBookDrawer.tsx` (new if needed)
- `web/src/components/erp/FastBookInvoice.tsx` (new if needed)
- `web/src/components/erp/FastBookVoucher.tsx` (new if needed)
- `web/src/app/erp/fast-book/page.tsx` (layout width only — keep loaders)

## Do not touch
- Any `web/src/app/actions/**`
- `supabase/**`, auth, RLS, `.env*`
- `/erp/finance/**`, `/erp/channel/**`, `/erp/hr/**`, `/erp/inventory/**`, `/erp/reports/**`, `/erp/rooms/**`
- `scripts/bank-recon/**`, check-in, POS, agents pages
- `DeskHeader.tsx` (leave nav alone)

## Contracts (must keep — same `createFastBooking` fields)
`check_in`, `check_out`, `adults`, `qty_<code>`, `contact_name`, `contact_phone`, `contact_email`, `guide_number`, `agent_id`, `source`, `payment_mode`, `notes`

Props unchanged: `roomTypes[]`, `agents[]`. Success: `state.ok` + `state.bookingId`.

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] Booking still saves via existing action
- [ ] Agent voucher has **no** rates/amounts
- [ ] Reply only: files changed + how to test `/erp/fast-book`

## Done means
Cursor reviews the diff; you do not merge unless asked. **Start implementing now.**

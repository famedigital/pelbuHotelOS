# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Edit the allowed files only.**

## Task
Polish the desk ERP UI for **Fast book + P2 order board / folios** — spacing, hierarchy, mobile — keep actions and field names intact.

## Goal
Desk staff can move fast between booking, kitchen status, and folio charge posting without parsing dense admin UI.

## Allowed files
- `web/src/components/erp/FastBookForm.tsx` (layout/copy only — keep `name=` attributes and `createFastBooking`)
- `web/src/app/erp/fast-book/page.tsx` (layout only — keep data loaders)
- `web/src/components/erp/DeskHeader.tsx` (nav visual only — keep Inbox / Fast book links)
- `web/src/app/erp/page.tsx` (presentation only — keep `updateOrderKotStatus` / `postOrderToBookingFolio`, keep data loaders and field names)

## Do not touch
- `web/src/app/actions/fast-book.ts`
- `web/src/app/actions/erp-pos.ts`
- `supabase/migrations/**`
- Auth / RLS / availability logic
- `.env*`

## Contracts
- Form field names must stay: `check_in`, `check_out`, `adults`, `qty_<code>`, `source`, `agent_id`, `guide_number`, `payment_mode`, `contact_name`, `contact_phone`, `contact_email`, `notes`
- Props: `roomTypes`, `agents` shapes unchanged
- In `/erp`, keep the KOT status buttons and folio-post form wired to the existing actions.

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] Desk can still submit a booking
- [ ] Desk can still change KOT status and post an order to a booking folio
- [ ] Reply: what changed / how to test (`/erp` and `/erp/fast-book`)

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.

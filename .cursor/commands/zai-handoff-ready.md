# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Edit the allowed files only.**

## Task
Polish desk **POS + folio detail + order board** UI — spacing, hierarchy, mobile — keep actions and field names intact.

## Goal
Cashiers can ring tickets and settle folios quickly without dense admin clutter.

## Allowed files
- `web/src/components/erp/DeskPosForm.tsx`
- `web/src/components/erp/GuestServiceForm.tsx`
- `web/src/components/erp/FolioPaymentForm.tsx`
- `web/src/components/erp/DeskHeader.tsx` (nav visual only — keep Inbox / POS / Fast book links)
- `web/src/app/erp/pos/page.tsx` (layout only)
- `web/src/app/erp/folios/[id]/page.tsx` (layout only)
- `web/src/app/erp/page.tsx` (presentation only — keep KOT/folio action wiring)
- `web/src/components/erp/FastBookForm.tsx` (optional polish)

## Do not touch
- `web/src/app/actions/erp-pos.ts`
- `web/src/app/actions/fast-book.ts`
- `supabase/migrations/**`
- Auth / RLS / GST math / availability
- `.env*`

## Contracts
- Keep form field names used by actions (`cart`, `outlet`, `settle_mode`, `booking_id`, `customer_name`, `phone`, `service_kind`, `amount_btn`, `method`, `folio_id`, etc.)
- Keep `createDeskOrder`, `postGuestServiceCharge`, `postFolioPayment`, `updateOrderKotStatus`, `postOrderToBookingFolio` wired

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] `/erp/pos` can still create a ticket
- [ ] `/erp/folios/[id]` can still post a payment
- [ ] Reply: what changed / how to test

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.

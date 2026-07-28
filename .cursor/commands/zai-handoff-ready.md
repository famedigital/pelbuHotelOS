# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Edit the allowed files only.**

## Task
Polish desk **Check-in** UI (`/erp/check-in`) — search list, form hierarchy, mobile — keep actions and field names intact.

## Goal
Front desk can find a booking and complete guide / SDF / driver / payment-mode check-in without dense clutter.

## Allowed files
- `web/src/components/erp/CheckInForm.tsx`
- `web/src/app/erp/check-in/page.tsx` (layout only — keep loaders)
- `web/src/components/erp/DeskHeader.tsx` (nav visual only — keep Inbox / Check-in / POS / Fast book)

## Do not touch
- `web/src/app/actions/erp-checkin.ts`
- `web/src/app/actions/erp-pos.ts`
- `supabase/migrations/**`
- Auth / RLS
- `.env*`

## Contracts
- Keep form fields: `booking_id`, `guide_number`, `guest_name`, `nationality`, `passport_or_cid`, `sdf_ref`, `sdf_doc_url`, `payment_mode`, `driver_*`, `allow_balance`
- Keep `confirmCheckIn` / `confirmCheckOut` wired

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] Check-in still opens folio and sets `checked_in`
- [ ] Reply: what changed / how to test `/erp/check-in`

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.

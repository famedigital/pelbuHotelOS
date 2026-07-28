# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Edit the allowed files only.**

## Task
Polish the desk **Fast book** UI (`/erp/fast-book`) — spacing, hierarchy, mobile — keep server action and field names intact.

## Goal
Staff can complete one-screen booking quickly on phone or desktop without hunting fields.

## Allowed files
- `web/src/components/erp/FastBookForm.tsx` (layout/copy only — keep `name=` attributes and `createFastBooking`)
- `web/src/app/erp/fast-book/page.tsx` (layout only — keep data loaders)
- `web/src/components/erp/DeskHeader.tsx` (nav visual only — keep Inbox / Fast book links)

## Do not touch
- `web/src/app/actions/fast-book.ts`
- `supabase/migrations/**`
- Auth / RLS / availability logic
- `.env*`

## Contracts
- Form field names must stay: `check_in`, `check_out`, `adults`, `qty_<code>`, `source`, `agent_id`, `guide_number`, `payment_mode`, `contact_name`, `contact_phone`, `contact_email`, `notes`
- Props: `roomTypes`, `agents` shapes unchanged

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] Desk can still submit a booking
- [ ] Reply: what changed / how to test (`/erp/fast-book`)

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.
